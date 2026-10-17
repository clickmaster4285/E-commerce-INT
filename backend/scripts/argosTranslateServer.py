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

PREWARM = [
    item.strip().lower()
    for item in os.environ.get(
        "TRANSLATE_TARGET_LOCALES", "ur,ar,es,fr,de,hi,zh,pt,tr"
    ).split(",")
    if item.strip()
]

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
    global _TRANSLATOR, _TOKENIZER
    if _TRANSLATOR is not None:
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

        results = []
        with _LOCK:
            for item in query:
                try:
                    results.append({"text": _translate_one(src, tgt, str(item or ""))})
                except Exception as exc:
                    self._send(500, {"error": f"translation failed: {exc}"})
                    return

        self._send(200, {"translations": results})


def main():
    print("=" * 60, flush=True)
    print("  Local M2M100 translation bridge (LibreTranslate-compatible)", flush=True)
    print("=" * 60, flush=True)
    print(f"  Listening: http://{HOST}:{PORT}", flush=True)
    print(f"  Model: {MODEL_REPOSITORY} ({MODEL_REVISION})", flush=True)
    print(f"  Targets: {', '.join(PREWARM)}", flush=True)
    _load_model()
    prewarm()
    print("=" * 60, flush=True)
    print("  Ready. Ctrl+C se band karein.", flush=True)
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.", flush=True)


if __name__ == "__main__":
    main()
