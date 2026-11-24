"use client";

/* ==========================================================
   STORE EDITOR — Schedule publish + Share preview dialogs
   Schedule: draft ka SNAPSHOT chuni hui date par live (backend themeScheduler).
   Share: secret link (24h / 7 din) — bina login current draft dikhata hai.
   ========================================================== */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Check, Copy, Link2, Loader2, X } from "lucide-react";
import { themeApi, apiError } from "@/apis/admin/themeApi";

const fmt = (d) => {
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(d);
  }
};

// <input type="datetime-local"> ke liye local value (default: kal isi waqt)
const localValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-fg">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-fg-muted hover:bg-subtle" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ScheduleDialog({ onClose, onSaveDraft, onDone }) {
  const [at, setAt] = useState(() => localValue(new Date(Date.now() + 24 * 3600 * 1000)));
  const [note, setNote] = useState("");
  // Dialog khulte waqt ek baar (render me Date.now() nahi)
  const [minAt] = useState(() => localValue(new Date(Date.now() + 2 * 60 * 1000)));
  const mutation = useMutation({
    mutationFn: async () => {
      const ok = await onSaveDraft(); // pehle latest draft save, phir snapshot
      if (!ok) throw new Error("Save the draft first");
      return themeApi.schedule({ at: new Date(at).toISOString(), note });
    },
    onSuccess: (data) => {
      onDone(data);
      toast.success(`Scheduled for ${fmt(new Date(at))}`);
      onClose();
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  return (
    <Dialog title="Schedule publish" onClose={onClose}>
      <p className="mb-4 text-xs text-fg-muted">
        Your current draft is saved as a snapshot and goes live automatically at this time. Edits you make after scheduling are not included. Schedule again to update it.
      </p>
      <label className="mb-3 block space-y-1.5">
        <span className="text-xs font-semibold text-fg-secondary">Go live at</span>
        <input
          type="datetime-local"
          value={at}
          min={minAt}
          onChange={(e) => setAt(e.target.value)}
          className="h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="mb-5 block space-y-1.5">
        <span className="text-xs font-semibold text-fg-secondary">Note (optional)</span>
        <input
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Eid sale theme"
          className="h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent"
        />
      </label>
      <button
        type="button"
        disabled={mutation.isPending || !at}
        onClick={() => mutation.mutate()}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
        Schedule
      </button>
    </Dialog>
  );
}

export function ShareDialog({ onClose, onSaveDraft, activeLinks = 0, onChanged }) {
  const [hours, setHours] = useState(24);
  const [link, setLink] = useState(null); // { url, expiresAt }
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      await onSaveDraft(); // link hamesha latest draft dikhata hai
      return themeApi.createPreviewLink(hours);
    },
    onSuccess: (data) => {
      setLink({ url: `${window.location.origin}/?theme_preview=${encodeURIComponent(data.token)}`, expiresAt: data.expiresAt });
      onChanged(data.theme);
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  const revoke = useMutation({
    mutationFn: themeApi.revokePreviewLinks,
    onSuccess: (data) => {
      setLink(null);
      onChanged(data);
      toast.success("All preview links revoked");
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  return (
    <Dialog title="Share preview" onClose={onClose}>
      <p className="mb-4 text-xs text-fg-muted">
        Anyone with the link can see your unpublished draft on the real store, with no login needed. It always shows the latest saved draft.
      </p>
      {link ? (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-input px-3 text-xs text-fg" />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  toast.error("Copy failed. Select the link and copy it manually.");
                }
              }}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-fg-muted">Expires {fmt(link.expiresAt)}. This link is shown only once, so copy it now.</p>
        </div>
      ) : (
        <div className="mb-4 flex gap-2">
          {[
            { h: 24, label: "24 hours" },
            { h: 168, label: "7 days" },
          ].map((opt) => (
            <button
              key={opt.h}
              type="button"
              onClick={() => setHours(opt.h)}
              className={`h-9 flex-1 rounded-lg border text-xs font-semibold transition ${hours === opt.h ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-secondary hover:bg-subtle"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {!link ? (
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
        >
          {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
          Create link
        </button>
      ) : null}
      {activeLinks > 0 ? (
        <button
          type="button"
          disabled={revoke.isPending}
          onClick={() => window.confirm("Revoke all preview links? People with old links will see the live store.") && revoke.mutate()}
          className="mt-3 w-full text-center text-xs font-semibold text-danger hover:underline disabled:opacity-50"
        >
          Revoke all links ({activeLinks} active)
        </button>
      ) : null}
    </Dialog>
  );
}

/** Top bar ke neeche: scheduled publish / pichla schedule fail */
export function ScheduleBanner({ scheduled, lastError, onCancel, cancelling }) {
  if (scheduled) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-info/30 bg-info-soft px-4 py-2 text-sm text-info">
        <span className="inline-flex items-center gap-2">
          <CalendarClock size={15} />
          Scheduled to go live <strong>{fmt(scheduled.at)}</strong>
          {scheduled.note ? <span className="opacity-80">· {scheduled.note}</span> : null}
        </span>
        <button type="button" disabled={cancelling} onClick={onCancel} className="rounded-md px-2 py-0.5 text-xs font-bold hover:bg-info/10 disabled:opacity-50">
          Cancel schedule
        </button>
      </div>
    );
  }
  if (lastError?.message) {
    return (
      <div role="alert" className="flex items-center gap-2 border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger">
        <AlertTriangle size={15} /> Scheduled publish on {fmt(lastError.at)} failed: {lastError.message}
      </div>
    );
  }
  return null;
}
