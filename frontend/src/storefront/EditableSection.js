"use client";

/* ==========================================================
   STORE EDITOR PREVIEW — section wrapper (sirf ?preview=1 iframe me)
   • Hover / selected → outline + top toolbar (naam, move, hide,
     duplicate, remove, "+" add below). Actions postMessage se editor
     ko jate hain — draft editor hi badalta hai (single source of truth).
   • Preview ke bahar sirf children (koi extra DOM nahi).
   ========================================================== */

import { ArrowDown, ArrowUp, Copy, EyeOff, Plus, Trash2 } from "lucide-react";
import { selectSectionInEditor, sendSectionAction, useStoreTheme } from "./ThemeProvider";

const btn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-user-accent-fg/90 transition hover:bg-black/15 hover:text-user-accent-fg disabled:pointer-events-none disabled:opacity-40";

export default function EditableSection({ id, isPreview, selected, isFirst = false, isLast = false, children }) {
  const { sectionLabels, editorMode } = useStoreTheme();
  if (!isPreview) return children;
  // View mode: asli store jaisa (links chalte, koi outline/toolbar nahi).
  // DOM structure same (toolbar ki jagah null) → toggle par section remount nahi hota
  const editing = editorMode !== "view";
  const label = sectionLabels?.[id] || "Section";

  const act = (action) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    sendSectionAction(action, id);
  };

  return (
    <div
      data-section-id={id}
      onClickCapture={(event) => {
        if (!editing) return;
        // Toolbar ke buttons apna kaam karein; baaki click sirf select (links navigate nahi)
        if (event.target.closest?.("[data-editor-toolbar]")) return;
        if (event.target.closest?.("a")) event.preventDefault();
        selectSectionInEditor(id);
      }}
      className={`group/editable relative rounded-2xl outline-offset-4 transition-[outline-color] ${
        !editing ? "" : selected ? "outline outline-2 outline-user-accent" : "hover:outline hover:outline-1 hover:outline-user-accent/60"
      }`}
    >
      {editing ? (
      <div
        data-editor-toolbar=""
        className={`pointer-events-none absolute start-2 top-2 z-30 flex items-center gap-0.5 rounded-lg bg-user-accent p-0.5 text-user-accent-fg shadow-lg transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover/editable:opacity-100"
        }`}
      >
        <span className="max-w-[14rem] truncate px-2 text-xs font-semibold">{label}</span>
        <span className="pointer-events-auto flex items-center">
          <button type="button" className={btn} disabled={isFirst} onClick={act("moveUp")} title="Move up" aria-label="Move up">
            <ArrowUp size={14} />
          </button>
          <button type="button" className={btn} disabled={isLast} onClick={act("moveDown")} title="Move down" aria-label="Move down">
            <ArrowDown size={14} />
          </button>
          <button type="button" className={btn} onClick={act("duplicate")} title="Duplicate" aria-label="Duplicate">
            <Copy size={13} />
          </button>
          <button type="button" className={btn} onClick={act("hide")} title="Hide" aria-label="Hide">
            <EyeOff size={14} />
          </button>
          <button type="button" className={btn} onClick={act("remove")} title="Remove" aria-label="Remove">
            <Trash2 size={13} />
          </button>
        </span>
      </div>
      ) : null}

      {children}

      {/* Section ke neeche "+" → isi jagah naya section */}
      {editing ? (
      <div
        data-editor-toolbar=""
        className={`pointer-events-none absolute inset-x-0 -bottom-3.5 z-30 flex justify-center transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover/editable:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={act("addBelow")}
          className="pointer-events-auto inline-flex h-7 items-center gap-1 rounded-full bg-user-accent px-3 text-xs font-semibold text-user-accent-fg shadow-lg hover:bg-user-accent-hover"
        >
          <Plus size={13} /> Add section
        </button>
      </div>
      ) : null}
    </div>
  );
}
