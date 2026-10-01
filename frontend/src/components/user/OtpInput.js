"use client";

import { useEffect, useRef, useState } from "react";

/**
 * OtpInput — 6 (ya custom length) digit OTP input.
 * ✅ Paste support, auto-advance, backspace, arrow keys
 * ✅ Reset ke liye parent `key` prop badal de (remount) — controlled prop ki zaroorat nahi
 */
export default function OtpInput({
  defaultValue = "",
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
}) {
  const inputsRef = useRef([]);
  const [cells, setCells] = useState(() => {
    const arr = Array(length).fill("");
    String(defaultValue || "")
      .replace(/\D/g, "")
      .slice(0, length)
      .split("")
      .forEach((ch, i) => {
        arr[i] = ch;
      });
    return arr;
  });

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const commit = (nextCells) => {
    setCells(nextCells);
    onChange?.(nextCells.join(""));
  };

  const setDigit = (index, digit) => {
    const next = [...cells];
    next[index] = digit;
    commit(next);
  };

  const fillFrom = (text, startIndex) => {
    const clean = String(text || "").replace(/\D/g, "");
    if (!clean) return;
    const next = [...cells];
    let cursor = startIndex;
    for (const ch of clean) {
      if (cursor >= length) break;
      next[cursor] = ch;
      cursor += 1;
    }
    commit(next);
    inputsRef.current[Math.min(cursor, length - 1)]?.focus();
  };

  const handleChange = (index, raw) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigit(index, "");
      return;
    }
    if (clean.length > 1) {
      fillFrom(clean, index);
      return;
    }
    setDigit(index, clean);
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (cells[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5">
      {cells.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => {
            e.preventDefault();
            fillFrom(e.clipboardData.getData("text"), i);
          }}
          onFocus={(e) => e.target.select()}
          aria-label={`Code digit ${i + 1}`}
          className="w-10 h-12 sm:w-12 sm:h-14 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] text-center text-xl font-black text-[var(--user-text)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        />
      ))}
    </div>
  );
}
