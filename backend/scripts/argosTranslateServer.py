#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
==========================================================
ARGOS TRANSLATE BRIDGE  (minimal LibreTranslate-compatible API)
==========================================================
Node backend ke `utils/libreTranslate.js` ko chahiye tha, wo exactly
LibreTranslate ka contract bolta hai — `POST /translate` + `GET /languages`.
LibreTranslate ki direct API error de rahi thi, to ye chhota sa stdlib-only
bridge wahi contract implement karta hai, seedha local Argos Translate
engine ke upar.

Isi wajah se **Node side ka ek bhi line change nahi hua** — `libreTranslate.js`
ko ye service LibreTranslate jaisi lagti hai aur use pata bhi nahi chalta.

  POST /translate  { q: str | [str], source, target, format }
                 -> { "translations": [{ "text": ... }] }   (list input)
                 -> { "translations":   { "text": ... } }   (string input)
  GET  /languages  -> [ { code, name, targets: [...] } ]

PORT 5055 default hai. Ye port jaan-boojh kar 5000 (is project ka Express
server) aur 5005 (jo LibreTranslate aksar apna default port rakhta hai) se
ALAG rakha gaya hai — teenon ek hi port par aa gaye to connections galat
server par jaa kar "ur is not supported" jaisi errors dete hain.

Run:
    py backend/scripts/argosTranslateServer.py

Ya env se:
    $env:ARGOS_PORT = "5055"
    py backend/scripts/argosTranslateServer.py

ZERO naya dependency — sirf Python stdlib (`http.server`) + jo Argos pehle
se installed hai.
"""

import json
import os
import sys
import threading

# ---- Windows console (cp1252) par Arabic/Urdu print crash karta hai -------
# Bina iske `print()` UnicodeEncodeError de deta hai. Bridge ka startup log
# bhi Urdu likhta hai, is liye stdout/stderr dono UTF-8 par force karte hain.
for _stream in ("stdout", "stderr"):
    try:
        getattr(sys, _stream).reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("ARGOS_PORT", "5055"))
HOST = os.environ.get("ARGOS_HOST", "127.0.0.1")
MAX_BODY_BYTES = 4 * 1024 * 1024

# Ye sirf startup par models ko memory me load karwane ke liye hai (pre-warm).
# Service khud har installed pair ko serve kar sakti hai.
PREWARM = [
    t.strip().lower()
    for t in os.environ.get("TRANSLATE_TARGET_LOCALES", "ur,ar").split(",")
    if t.strip()
]
SOURCE_LANG = os.environ.get("TRANSLATE_SOURCE_LANG", "en")

LANGUAGE_NAMES = {
    "en": "English", "ar": "Arabic", "ur": "Urdu",
    "az": "Azerbaijani", "sq": "Albanian", "fr": "French",
    "de": "German", "es": "Spanish", "tr": "Turkish",
    "zh": "Chinese", "ru": "Russian", "hi": "Hindi",
}

# ---- Engine load ---------------------------------------------------------
import argostranslate.package as package  # noqa: E402
import argostranslate.translate as translate  # noqa: E402

_LOCK = threading.Lock()     # Argos model thread-safe nahi — serialize karo
_CACHE = {}                  # (from, to) -> CachedTranslation


def _installed_pairs():
    """Installed (from, to) pairs. `update()` unhe translate registry me
    register karta hai — iske bina `get_translation_from_codes` None deta hai."""
    pairs = set()
    for pkg in package.get_installed_packages():
        pairs.add((pkg.from_code, pkg.to_code))
        if (pkg.from_code, pkg.to_code) in (
            (SOURCE_LANG, t) for t in PREWARM
        ):
            pkg.update()
    return sorted(pairs)


PAIRS = _installed_pairs()


def _targets_from(code):
    return sorted({to for (frm, to) in PAIRS if frm == code})


def _get_translation(src, tgt):
    """CachedTranslation object (model already memory me). Argos har call par
    model reload karta hai, is liye cache zaroori hai — ~3x speed difference."""
    key = (src, tgt)
    if key in _CACHE:
        return _CACHE[key]
    if key not in PAIRS:
        return None
    obj = translate.get_translation_from_codes(src, tgt)
    if obj is not None:
        _CACHE[key] = obj
    return obj


def _translate_one(src, tgt, text):
    if text == "":
        return ""
    engine = _get_translation(src, tgt)
    if engine is None:
        raise LookupError(f"no {src}->{tgt} model")
    return engine.translate(text)


def prewarm():
    for tgt in PREWARM:
        try:
            engine = _get_translation(SOURCE_LANG, tgt)
            if engine is None:
                print(f"  [argos] {SOURCE_LANG}->{tgt} : model nahi hai", flush=True)
            else:
                out = engine.translate("Welcome to our store")
                print(f"  [argos] {SOURCE_LANG}->{tgt} : ready  ({out})", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  [argos] {SOURCE_LANG}->{tgt} : FAILED ({exc})", flush=True)


# ---- HTTP handler --------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "ArgosBridge/1.0"
    protocol_version = "HTTP/1.1"

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Default log stderr par ascii-escape karta hai; Urdu crash karta hai.
        try:
            print(f"  [http] {fmt % args}", flush=True)
        except Exception:
            print("  [http] (request)", flush=True)

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path == "/languages":
            self._send(200, [
                {
                    "code": code,
                    "name": LANGUAGE_NAMES.get(code, code),
                    "targets": _targets_from(code),
                }
                for code in sorted({frm for (frm, _) in PAIRS} | {to for (_, to) in PAIRS})
                if _targets_from(code)
            ])
            return
        if path in ("/", "/healthz"):
            self._send(200, {"status": "ok", "pairs": [f"{a}->{b}" for a, b in PAIRS]})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
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

        src = str(data.get("source") or SOURCE_LANG).lower()
        tgt = str(data.get("target") or "").lower()
        q = data.get("q")

        if not tgt:
            self._send(400, {"error": "target is required"})
            return
        if (src, tgt) not in PAIRS:
            # 400 = non-retryable. Node client 4xx par retry nahi karta —
            # sahi behaviour, kyunki missing model retry se nahi aayega.
            self._send(400, {
                "error": f"no installed model for {src}->{tgt}",
                "installed": [f"{a}->{b}" for a, b in PAIRS],
            })
            return

        if isinstance(q, str):
            with _LOCK:
                try:
                    out = _translate_one(src, tgt, q)
                except LookupError as exc:
                    self._send(400, {"error": str(exc)})
                    return
                except Exception as exc:  # noqa: BLE001
                    self._send(500, {"error": f"translation failed: {exc}"})
                    return
            # LibreTranslate string input par object deta hai.
            self._send(200, {"translations": {"text": out}})
            return

        if not isinstance(q, list):
            self._send(400, {"error": "q must be a string or a list of strings"})
            return

        results = []
        with _LOCK:
            for item in q:
                try:
                    results.append({"text": _translate_one(src, tgt, str(item or ""))})
                except Exception as exc:  # noqa: BLE001
                    # Count/order banna zaroori hai — Node client length match
                    # verify karta hai. Is liye ek failure par poora request fail.
                    self._send(500, {"error": f"translation failed: {exc}"})
                    return
        self._send(200, {"translations": results})


def main():
    print("=" * 60, flush=True)
    print("  Argos Translate bridge (LibreTranslate-compatible)", flush=True)
    print("=" * 60, flush=True)
    print(f"  Listening : http://{HOST}:{PORT}", flush=True)
    print(f"  Models    : {', '.join(f'{a}->{b}' for a, b in PAIRS)}", flush=True)
    print(f"  Pre-warming {SOURCE_LANG}->{', '.join(PREWARM)} (first load slow hota hai)…", flush=True)
    prewarm()
    print("=" * 60, flush=True)
    print("  Ready. Ctrl+C se band karein.", flush=True)
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.", flush=True)


if __name__ == "__main__":
    main()
