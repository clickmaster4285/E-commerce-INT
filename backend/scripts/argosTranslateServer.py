#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
LOCAL MT TRANSLATE BRIDGE (minimal LibreTranslate-compatible API)

Node backend ke utils/libreTranslate.js ke liye local CTranslate2 bridge.
Endpoints:
  GET  /languages
  GET  /healthz
  POST /translate

Configure bridge and model settings in backend/.env.
The configured M2M100 model is downloaded once to TRANSLATION_MODEL_DIR.
"""

import hashlib
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen


def _load_bridge_env():
    """Read Argos configuration from backend/.env only."""
    env_file = Path(__file__).resolve().parents[1] / ".env"
    values = {}
    if not env_file.is_file():
        raise FileNotFoundError(f"Backend environment file not found: {env_file}")
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


CONFIG = _load_bridge_env()

# Windows console par Urdu/Arabic output ko safely print karne ke liye.gbhghg
for _stream in ("stdout", "stderr"):
    try:
        getattr(sys, _stream).reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def _required_config(key):
    value = CONFIG.get(key, "").strip()
    if not value:
        raise RuntimeError(f"Missing required Argos setting in backend/.env: {key}")
    return value


def _int_config(key):
    try:
        value = int(_required_config(key))
    except ValueError as exc:
        raise RuntimeError(f"Argos setting {key} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"Argos setting {key} must be a positive integer")
    return value


def _float_config(key):
    try:
        return float(_required_config(key))
    except ValueError as exc:
        raise RuntimeError(f"Argos setting {key} must be numeric") from exc


HOST = _required_config("ARGOS_HOST")
PORT = _int_config("ARGOS_PORT")
MAX_BODY_BYTES = _int_config("TRANSLATION_MAX_BODY_BYTES")
SOURCE_LANG = _required_config("TRANSLATE_SOURCE_LANG").lower()
SOURCE_LANG_NAME = _required_config("TRANSLATE_SOURCE_LANGUAGE_NAME")
TRANSLATION_BATCH_SIZE = _int_config("TRANSLATE_BATCH_SIZE")
PREWARM = sorted({
    item.strip().lower()
    for item in _required_config("TRANSLATE_TARGET_LOCALES").split(",")
    if item.strip()
})
if not PREWARM:
    raise RuntimeError("TRANSLATE_TARGET_LOCALES must contain at least one language")

import ctranslate2
import sentencepiece
try:
    import argostranslate.translate as argos_translate
except ImportError:
    argos_translate = None

_LOCK = threading.Lock()
MODEL_REPOSITORY = _required_config("TRANSLATION_MODEL_REPOSITORY")
MODEL_REVISION = _required_config("TRANSLATION_MODEL_REVISION")
MODEL_DOWNLOAD_TIMEOUT_SECONDS = _int_config("TRANSLATION_MODEL_DOWNLOAD_TIMEOUT_SECONDS")
MODEL_DOWNLOAD_RETRIES = _int_config("TRANSLATION_MODEL_DOWNLOAD_RETRIES")
MODEL_DOWNLOAD_CHUNK_BYTES = _int_config("TRANSLATION_MODEL_DOWNLOAD_CHUNK_BYTES")
TRANSLATION_DEVICE = _required_config("TRANSLATION_DEVICE")
TRANSLATION_ENGINE = _required_config("TRANSLATION_ENGINE").lower()
TRANSLATION_COMPUTE_TYPE = _required_config("TRANSLATION_COMPUTE_TYPE")
TRANSLATION_INTER_THREADS = _int_config("TRANSLATION_INTER_THREADS")
TRANSLATION_INTRA_THREADS = _int_config("TRANSLATION_INTRA_THREADS")
TRANSLATION_BEAM_SIZE = _int_config("TRANSLATION_BEAM_SIZE")
TRANSLATION_MAX_DECODING_LENGTH = _int_config("TRANSLATION_MAX_DECODING_LENGTH")
TRANSLATION_USER_AGENT = _required_config("TRANSLATION_USER_AGENT")
TRANSLATION_MODEL_BASE_URL = _required_config("TRANSLATION_MODEL_BASE_URL").rstrip("/")
TRANSLATION_PREWARM_TEXT = _required_config("TRANSLATION_PREWARM_TEXT")
TRANSLATION_LENGTH_PENALTY = _float_config("TRANSLATION_LENGTH_PENALTY")
TRANSLATION_TOKENIZER_MODEL_FILE = _required_config("TRANSLATION_TOKENIZER_MODEL_FILE")
MODEL_FILES = {}
for _entry in _required_config("TRANSLATION_MODEL_FILES").split(";"):
    _parts = [part.strip() for part in _entry.split(",")]
    if len(_parts) != 3 or not _parts[0] or not _parts[1].isdigit():
        raise RuntimeError("TRANSLATION_MODEL_FILES entries must be name,size,sha256")
    _name, _size, _sha = _parts
    if len(_sha) != 64 or any(char not in "0123456789abcdefABCDEF" for char in _sha):
        raise RuntimeError(f"Invalid SHA-256 configured for translation model file {_name}")
    MODEL_FILES[_name] = (int(_size), _sha.lower())
if not MODEL_FILES:
    raise RuntimeError("TRANSLATION_MODEL_FILES must contain at least one file")
if TRANSLATION_TOKENIZER_MODEL_FILE not in MODEL_FILES:
    raise RuntimeError("TRANSLATION_TOKENIZER_MODEL_FILE must be listed in TRANSLATION_MODEL_FILES")
if TRANSLATION_ENGINE not in {"ct2", "argos"}:
    raise RuntimeError("TRANSLATION_ENGINE must be either 'ct2' or 'argos'")

_model_dir_config = Path(_required_config("TRANSLATION_MODEL_DIR")).expanduser()
MODEL_DIR = (
    _model_dir_config if _model_dir_config.is_absolute()
    else Path(__file__).resolve().parents[1] / _model_dir_config
)

PAIRS = [(SOURCE_LANG, target) for target in PREWARM]
_TRANSLATOR = None
_TOKENIZER = None
_ARGOS_TRANSLATIONS = {}


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(MODEL_DOWNLOAD_CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_model_file(name, expected_size, expected_hash):
    path = MODEL_DIR / name
    if path.exists() and path.stat().st_size == expected_size:
        if _sha256(path) == expected_hash:
            return

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    url = f"{TRANSLATION_MODEL_BASE_URL}/{MODEL_REPOSITORY}/resolve/{MODEL_REVISION}/{name}"
    temp_path = path.with_suffix(path.suffix + ".download")
    for attempt in range(MODEL_DOWNLOAD_RETRIES):
        offset = temp_path.stat().st_size if temp_path.exists() else 0
        headers = {"User-Agent": TRANSLATION_USER_AGENT}
        if offset:
            headers["Range"] = f"bytes={offset}-"
        request = Request(url, headers=headers)

        try:
            with urlopen(request, timeout=MODEL_DOWNLOAD_TIMEOUT_SECONDS) as response:
                if offset and response.status != 206:
                    offset = 0
                if response.status == 206:
                    content_range = response.headers.get("Content-Range", "")
                    if not content_range.startswith(f"bytes {offset}-"):
                        raise RuntimeError(f"Invalid model download range for {name}")
                with temp_path.open("ab" if offset else "wb") as output:
                    while True:
                        chunk = response.read(MODEL_DOWNLOAD_CHUNK_BYTES)
                        if not chunk:
                            break
                        output.write(chunk)
        except Exception:
            if attempt == MODEL_DOWNLOAD_RETRIES - 1:
                raise
            continue

        size = temp_path.stat().st_size
        if size > expected_size:
            temp_path.unlink(missing_ok=True)
            raise RuntimeError(f"Downloaded translation model asset is oversized: {name}")
        if size < expected_size:
            continue
        break
    else:
        raise RuntimeError(f"Incomplete translation model download: {name}")

    if _sha256(temp_path) != expected_hash:
        temp_path.unlink(missing_ok=True)
        raise RuntimeError(f"Downloaded translation model asset failed verification: {name}")

    temp_path.replace(path)


def _load_model():
    global _TRANSLATOR, _TOKENIZER, _ARGOS_TRANSLATIONS
    if _TRANSLATOR is not None or _ARGOS_TRANSLATIONS:
        return

    if TRANSLATION_ENGINE == "argos":
        if argos_translate is None:
            raise RuntimeError("TRANSLATION_ENGINE=argos requires argostranslate to be installed")
        try:
            installed = {
                pair: argos_translate.get_translation_from_codes(*pair)
                for pair in PAIRS
            }
        except Exception:
            installed = {}
        if not PAIRS or not all(installed.values()):
            raise RuntimeError("Argos Translate packages are not installed for every configured language pair")
        _ARGOS_TRANSLATIONS = installed
        print("  [model] using installed Argos Translate packages", flush=True)
        return

    for name, (expected_size, expected_hash) in MODEL_FILES.items():
        print(f"  [model] checking {name}", flush=True)
        _download_model_file(name, expected_size, expected_hash)

    translator = ctranslate2.Translator(
        str(MODEL_DIR),
        device=TRANSLATION_DEVICE,
        compute_type=TRANSLATION_COMPUTE_TYPE,
        inter_threads=TRANSLATION_INTER_THREADS,
        intra_threads=TRANSLATION_INTRA_THREADS,
    )
    tokenizer = sentencepiece.SentencePieceProcessor(
        model_file=str(MODEL_DIR / TRANSLATION_TOKENIZER_MODEL_FILE)
    )

    _TRANSLATOR = translator
    _TOKENIZER = tokenizer


def _targets_from(code):
    return sorted({target for source, target in PAIRS if source == code})


def _translate_one(src, tgt, text):
    if text == "":
        return ""
    if (src, tgt) not in PAIRS:
        raise LookupError(f"no {src}->{tgt} model")
    argos_translation = _ARGOS_TRANSLATIONS.get((src, tgt))
    if argos_translation is not None:
        return argos_translation.translate(text).strip()

    source_tokens = [f"__{src}__", *_TOKENIZER.encode(text, out_type=str), "</s>"]
    result = _TRANSLATOR.translate_batch(
        [source_tokens],
        target_prefix=[[f"__{tgt}__"]],
        beam_size=TRANSLATION_BEAM_SIZE,
        max_decoding_length=TRANSLATION_MAX_DECODING_LENGTH,
    )[0]
    output_tokens = result.hypotheses[0]
    if output_tokens and output_tokens[0] == f"__{tgt}__":
        output_tokens = output_tokens[1:]
    output_tokens = [token for token in output_tokens if token not in ("</s>", "<s>")]
    return _TOKENIZER.decode(output_tokens).strip()


def _translate_many(src, tgt, texts):
    if (src, tgt) not in PAIRS:
        raise LookupError(f"no {src}->{tgt} model")

    if (src, tgt) in _ARGOS_TRANSLATIONS:
        argos_translation = _ARGOS_TRANSLATIONS[(src, tgt)]
        package_translation = getattr(argos_translation, "underlying", None)
        package = getattr(package_translation, "pkg", None)
        translator = getattr(package_translation, "translator", None)
        sentencizer = getattr(package_translation, "sentencizer", None)
        if package is None or translator is None or sentencizer is None:
            return [_translate_one(src, tgt, text) for text in texts]

        paragraph_records = []
        sentences = []
        paragraph_counts = [0] * len(texts)
        for text_index, text in enumerate(texts):
            for paragraph_index, paragraph in enumerate(
                argos_translate.ITranslation.split_into_paragraphs(text)
            ):
                paragraph_sentences = sentencizer.split_sentences(paragraph)
                sentence_indexes = list(
                    range(len(sentences), len(sentences) + len(paragraph_sentences))
                )
                sentences.extend(paragraph_sentences)
                paragraph_records.append(
                    (text_index, paragraph_index, sentence_indexes)
                )
                paragraph_counts[text_index] += 1

        if not sentences:
            return ["" for _ in texts]

        tokenized = [package.tokenizer.encode(sentence) for sentence in sentences]
        target_prefix = (
            [[package.target_prefix]] * len(tokenized)
            if package.target_prefix
            else None
        )
        translated = translator.translate_batch(
            tokenized,
            target_prefix=target_prefix,
            replace_unknowns=True,
            max_batch_size=TRANSLATION_BATCH_SIZE,
            batch_type="tokens",
            beam_size=TRANSLATION_BEAM_SIZE,
            num_hypotheses=1,
            length_penalty=TRANSLATION_LENGTH_PENALTY,
            return_scores=True,
        )

        paragraphs = {}
        for text_index, paragraph_index, sentence_indexes in paragraph_records:
            output_tokens = []
            for sentence_index in sentence_indexes:
                output_tokens.extend(translated[sentence_index].hypotheses[0])
            output = package.tokenizer.decode(output_tokens)
            if package.target_prefix and output.startswith(package.target_prefix):
                output = output[len(package.target_prefix) :]
            if output.startswith(" "):
                output = output[1:]
            paragraphs[(text_index, paragraph_index)] = output

        results = []
        for text_index, paragraph_count in enumerate(paragraph_counts):
            output = ""
            for paragraph_index in range(paragraph_count):
                output = argos_translate.ITranslation.combine_paragraphs(
                    [output, paragraphs.get((text_index, paragraph_index), "")]
                )
            results.append(output.strip())
        return results

    nonempty = [
        (index, text)
        for index, text in enumerate(texts)
        if text
    ]
    if not nonempty:
        return ["" for _ in texts]

    source_tokens = [
        [f"__{src}__", *_TOKENIZER.encode(text, out_type=str), "</s>"]
        for _, text in nonempty
    ]
    translated = _TRANSLATOR.translate_batch(
        source_tokens,
        target_prefix=[[f"__{tgt}__"]] * len(source_tokens),
        beam_size=TRANSLATION_BEAM_SIZE,
        max_decoding_length=TRANSLATION_MAX_DECODING_LENGTH,
    )
    results = ["" for _ in texts]
    for (index, _), result in zip(nonempty, translated):
        output_tokens = result.hypotheses[0]
        if output_tokens and output_tokens[0] == f"__{tgt}__":
            output_tokens = output_tokens[1:]
        output_tokens = [
            token for token in output_tokens if token not in ("</s>", "<s>")
        ]
        results[index] = _TOKENIZER.decode(output_tokens).strip()
    return results


def prewarm():
    for target in PREWARM:
        try:
            _translate_one(SOURCE_LANG, target, TRANSLATION_PREWARM_TEXT)
            print(f"  [model] {SOURCE_LANG}->{target}: ready", flush=True)
        except Exception as exc:
            print(f"  [model] {SOURCE_LANG}->{target}: FAILED ({exc})", flush=True)
            raise


class Handler(BaseHTTPRequestHandler):
    server_version = "ArgosBridge/1.0"
    protocol_version = "HTTP/1.1"

    def _send(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        try:
            print(f"  [http] {fmt % args}", flush=True)
        except Exception:
            print("  [http] (request)", flush=True)

    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"

        if path == "/languages":
            self._send(
                200,
                [{
                    "code": SOURCE_LANG,
                    "name": SOURCE_LANG_NAME,
                    "targets": _targets_from(SOURCE_LANG),
                }],
            )
            return

        if path in ("/", "/healthz"):
            self._send(
                200,
                {"status": "ok", "pairs": [f"{src}->{tgt}" for src, tgt in PAIRS]},
            )
            return

        self._send(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        if path != "/translate":
            self._send(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0

        if length <= 0 or length > MAX_BODY_BYTES:
            self._send(400, {"error": "invalid body length"})
            return

        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._send(400, {"error": f"invalid json: {exc}"})
            return

        if not isinstance(data, dict):
            self._send(400, {"error": "request body must be a JSON object"})
            return

        src = str(data.get("source") or SOURCE_LANG).lower()
        tgt = str(data.get("target") or "").lower()
        query = data.get("q")

        if not tgt:
            self._send(400, {"error": "target is required"})
            return

        if (src, tgt) not in PAIRS:
            self._send(
                400,
                {
                    "error": f"no installed model for {src}->{tgt}",
                    "installed": [f"{a}->{b}" for a, b in PAIRS],
                },
            )
            return

        if isinstance(query, str):
            with _LOCK:
                try:
                    output = _translate_one(src, tgt, query)
                except LookupError as exc:
                    self._send(400, {"error": str(exc)})
                    return
                except Exception as exc:
                    self._send(500, {"error": f"translation failed: {exc}"})
                    return
            self._send(200, {"translations": {"text": output}})
            return

        if not isinstance(query, list):
            self._send(400, {"error": "q must be a string or a list of strings"})
            return

        with _LOCK:
            try:
                results = _translate_many(src, tgt, [str(item or "") for item in query])
            except Exception as exc:
                self._send(500, {"error": f"translation failed: {exc}"})
                return

        self._send(200, {"translations": [{"text": text} for text in results]})


def main():
    print("=" * 60, flush=True)
    print("  Local Argos translation bridge (LibreTranslate-compatible)", flush=True)
    print("=" * 60, flush=True)
    print(f"  Listening: http://{HOST}:{PORT}", flush=True)
    print(f"  Targets: {', '.join(PREWARM)}", flush=True)
    _load_model()
    if TRANSLATION_ENGINE == "argos":
        print("  Engine: installed Argos Translate packages", flush=True)
    else:
        print(f"  Engine: M2M100 CTranslate2 ({MODEL_REVISION})", flush=True)
    prewarm()
    print("=" * 60, flush=True)
    print("  Ready. Ctrl+C se band karein.", flush=True)
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.", flush=True)


if __name__ == "__main__":
    main()
