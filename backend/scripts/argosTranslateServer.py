#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
LOCAL MT TRANSLATE BRIDGE (minimal LibreTranslate-compatible API)

Node backend ke utils/libreTranslate.js ke liye local CTranslate2 bridge.
Endpoints:
  GET  /languages
  GET  /healthz
  POST /translate

Default port: 5055
The pinned, MIT-licensed M2M100 model is downloaded once to the user cache.
"""

import hashlib
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

# Windows console par Urdu/Arabic output ko safely print karne ke liye.
for _stream in ("stdout", "stderr"):
    try:
        getattr(sys, _stream).reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PORT = int(os.environ.get("ARGOS_PORT", "5055"))
HOST = os.environ.get("ARGOS_HOST", "127.0.0.1")
MAX_BODY_BYTES = 4 * 1024 * 1024
SOURCE_LANG = os.environ.get("TRANSLATE_SOURCE_LANG", "en")

REQUIRED_TARGETS = {"ur", "ar", "es", "fr", "de", "hi", "zh", "pt", "tr"}
PREWARM = sorted(
    REQUIRED_TARGETS
    | {
        item.strip().lower()
        for item in os.environ.get("TRANSLATE_TARGET_LOCALES", "").split(",")
        if item.strip()
    }
)

LANGUAGE_NAMES = {
    "en": "English",
    "ar": "Arabic",
    "ur": "Urdu",
    "az": "Azerbaijani",
    "sq": "Albanian",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "tr": "Turkish",
    "zh": "Chinese",
    "ru": "Russian",
    "hi": "Hindi",
    "pt": "Portuguese",
}

import ctranslate2
import sentencepiece
try:
    import argostranslate.translate as argos_translate
except ImportError:
    argos_translate = None

_LOCK = threading.Lock()
MODEL_REPOSITORY = "JustFrederik/m2m_100_418m_ct2_int8"
MODEL_REVISION = "1aeed44db4dd61a486bba44acf54c76507082a2c"
MODEL_FILES = {
    "model.bin": (490667638, "6c8ef4e814a02d5947ab80710f93f3d4e776bf4b668ab3bb7996ff050b69d111"),
    "shared_vocabulary.txt": (1159930, "bd440aa21b8ca3453fc792a0018a1f3fe68b3464aadddd4d16a4b72f73c86d8c"),
    "spm.128k.model": (2423393, "d8f7c76ed2a5e0822be39f0a4f95a55eb19c78f4593ce609e2edbc2aea4d380a"),
    "config.json": (158, "531f7f8d8bf8b73a1580b73c04b58bf134ac490284f4f7af6c20ad238499ae37"),
}
_cache_root = Path(
    os.environ.get("TRANSLATION_MODEL_CACHE")
    or os.environ.get("LOCALAPPDATA")
    or (Path.home() / ".cache")
)
MODEL_DIR = Path(
    os.environ.get("TRANSLATION_MODEL_DIR")
    or (_cache_root / "ecommerce-translation" / "m2m100-ct2-int8")
)

SUPPORTED_TARGETS = {"ur", "ar", "es", "fr", "de", "hi", "zh", "pt", "tr"}
unsupported_targets = sorted(set(PREWARM) - SUPPORTED_TARGETS)
if unsupported_targets:
    raise RuntimeError(
        "The local M2M100 model does not support configured target(s): "
        + ", ".join(unsupported_targets)
    )
if SOURCE_LANG != "en":
    raise RuntimeError("The local M2M100 model requires English source text")

PAIRS = [("en", target) for target in sorted(set(PREWARM))]
_TRANSLATOR = None
_TOKENIZER = None
_ARGOS_TRANSLATIONS = {}


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_model_file(name, expected_size, expected_hash):
    path = MODEL_DIR / name
    if path.exists() and path.stat().st_size == expected_size:
        if _sha256(path) == expected_hash:
            return

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    url = (
        f"https://huggingface.co/{MODEL_REPOSITORY}/resolve/"
        f"{MODEL_REVISION}/{name}"
    )
    request = Request(url, headers={"User-Agent": "ecommerce-local-translator/1.0"})
    temp_path = path.with_suffix(path.suffix + ".download")
    for attempt in range(3):
        offset = temp_path.stat().st_size if temp_path.exists() else 0
        headers = {"User-Agent": "ecommerce-local-translator/1.0"}
        if offset:
            headers["Range"] = f"bytes={offset}-"
        request = Request(url, headers=headers)

        try:
            with urlopen(request, timeout=60) as response:
                if offset and response.status != 206:
                    offset = 0
                if response.status == 206:
                    content_range = response.headers.get("Content-Range", "")
                    if not content_range.startswith(f"bytes {offset}-"):
                        raise RuntimeError(f"Invalid model download range for {name}")
                with temp_path.open("ab" if offset else "wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
        except Exception:
            if attempt == 2:
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

    if argos_translate is not None:
        try:
            installed = {
                pair: argos_translate.get_translation_from_codes(*pair)
                for pair in PAIRS
            }
        except Exception:
            installed = {}
        if PAIRS and all(installed.values()):
            _ARGOS_TRANSLATIONS = installed
            print("  [model] using installed Argos Translate packages", flush=True)
            return

    for name, (expected_size, expected_hash) in MODEL_FILES.items():
        print(f"  [model] checking {name}", flush=True)
        _download_model_file(name, expected_size, expected_hash)

    translator = ctranslate2.Translator(
        str(MODEL_DIR),
        device="cpu",
        compute_type="int8",
        inter_threads=1,
        intra_threads=max(1, min(4, os.cpu_count() or 1)),
    )
    tokenizer = sentencepiece.SentencePieceProcessor(
        model_file=str(MODEL_DIR / "spm.128k.model")
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

    source_tokens = ["__en__", *_TOKENIZER.encode(text, out_type=str), "</s>"]
    result = _TRANSLATOR.translate_batch(
        [source_tokens],
        target_prefix=[[f"__{tgt}__"]],
        beam_size=4,
        max_decoding_length=256,
    )[0]
    output_tokens = result.hypotheses[0]
    if output_tokens and output_tokens[0] == f"__{tgt}__":
        output_tokens = output_tokens[1:]
    output_tokens = [token for token in output_tokens if token not in ("</s>", "<s>")]
    return _TOKENIZER.decode(output_tokens).strip()


def _translate_many(src, tgt, texts):
    if (src, tgt) not in PAIRS:
        raise LookupError(f"no {src}->{tgt} model")

    if src == "en" and (src, tgt) in _ARGOS_TRANSLATIONS:
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
            max_batch_size=argos_translate.settings.batch_size,
            batch_type="tokens",
            beam_size=max(1, argos_translate.settings.beam_size),
            num_hypotheses=1,
            length_penalty=0.2,
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
        ["__en__", *_TOKENIZER.encode(text, out_type=str), "</s>"]
        for _, text in nonempty
    ]
    translated = _TRANSLATOR.translate_batch(
        source_tokens,
        target_prefix=[[f"__{tgt}__"]] * len(source_tokens),
        beam_size=4,
        max_decoding_length=256,
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
            _translate_one(SOURCE_LANG, target, "Welcome to our store")
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
                    "name": LANGUAGE_NAMES[SOURCE_LANG],
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
    if _ARGOS_TRANSLATIONS:
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
