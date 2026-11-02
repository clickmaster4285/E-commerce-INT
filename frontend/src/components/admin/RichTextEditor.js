"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, LineHeight, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
  Undo2, Redo2,
  Palette, RemoveFormatting,
} from "lucide-react";

const FONT_FAMILIES = [
  { label: "Default font", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
];

const FONT_SIZES = [
  { label: "Default size", value: "" },
  { label: "10", value: "10px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
];

/* --------------------------------------------------------------------------
 * Legacy-content normalization.
 * Terms saved before the rich editor (plain text with markdown-style
 * markers such as **bold**, # headings, - bullets) must load AS formatted
 * rich text — not render literally. Runs only on non-HTML content.
 * ------------------------------------------------------------------------ */
const containsHtml = /<[a-z][\s\S]*>/i;
const escapeHtmlText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inlineBold = (s) => s.replace(/\*\*([^*]+(?:\*(?!\*)[^*]*)*)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
const inlineItalic = (s) => s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s.,;:!?)])/g, "$1<em>$2</em>").replace(/(^|[\s(])_([^_\s][^_]*)_(?=$|[\s.,;:!?)])/g, "$1<em>$2</em>");
const inlineCode = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>");

function legacyMarkdownToHtml(raw) {
  const lines = String(raw || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let list = null; // "ul" | "ol" | "task"
  const flushList = () => {
    if (!list) return;
    out.push(list === "task" ? "</ul>" : `</${list}>`);
    list = null;
  };
  const pushTaskItem = (checked, text) => {
    if (list !== "task") { flushList(); list = "task"; out.push('<ul data-type="taskList">'); }
    out.push(`<li data-type="taskItem" data-checked="${checked ? "true" : "false"}"><label><input type="checkbox" ${checked ? "checked" : ""}><span></span></label><p>${text}</p></li>`);
  };
  const pushListItem = (text) => {
    if (list !== "ul") { flushList(); list = "ul"; out.push("<ul>"); }
    out.push(`<li><p>${text}</p></li>`);
  };
  const pushOrderedItem = (text) => {
    if (list !== "ol") { flushList(); list = "ol"; out.push("<ol>"); }
    out.push(`<li><p>${text}</p></li>`);
  };
  const inline = (line) => inlineCode(inlineItalic(inlineBold(escapeHtmlText(line))));

  lines.forEach((original) => {
    const line = original.trim();
    if (!line) { flushList(); return; }
    const task = /^\[([xX ])\]\s*(.*)$/.exec(line);
    if (task) { pushTaskItem(task[1].toLowerCase() === "x", inline(task[2])); return; }
    const numbered = /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (numbered) { pushOrderedItem(inline(numbered[2])); return; }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) { pushListItem(inline(bullet[1])); return; }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) { flushList(); out.push(`<h${heading[1].length}>${inline(heading[2].replace(/\s*#+\s*$/, ""))}</h${heading[1].length}>`); return; }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  });
  flushList();
  return out.join("");
}

/** Wrap value passed by the parent so old plain/markdown content opens formatted. */
function prepareIncomingContent(value) {
  const raw = String(value ?? "");
  if (!raw.trim() || containsHtml.test(raw)) return raw; // already rich HTML (or empty)
  return legacyMarkdownToHtml(raw);
}


export default function RichTextEditor({ value, onChange, placeholder, minHeight = 260 }) {
  const [fontFamily, setFontFamily] = useState("");
  const [fontSize, setFontSize] = useState("");
  // HTML the editor itself last produced. Lets us tell "the parent echoed our
  // own output back" (echo — ignore) from "the parent supplied external
  // content" (a real document load/save — apply it). This is what keeps
  // clicks, selections, and in-flight edits from being clobbered.
  const lastEmittedRef = useRef(value || "");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      Placeholder.configure({ placeholder: placeholder || "Start typing…" }),
    ],
    content: prepareIncomingContent(value),
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      onChange?.(html);
    },
  });

  // Apply external value changes only (saved terms loaded from the API, a
  // saved document reopened, etc.). Echoes of the editor's own output are
  // ignored, so typing, deleting, and select→format on existing text always
  // operate on the live document instead of having it rewritten underneath.
  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? "";
    if (incoming === lastEmittedRef.current) return;
    // Convert legacy plain/markdown content so it opens formatted; the
    // converter is a no-op for anything that is already rich HTML.
    lastEmittedRef.current = incoming;
    editor.commands.setContent(prepareIncomingContent(incoming), { emitUpdate: false });
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
        Loading editor…
      </div>
    );
  }

  const handleFontFamily = (v) => {
    setFontFamily(v);
    if (v) editor.chain().focus().setFontFamily(v).run();
    else editor.chain().focus().unsetFontFamily().run();
  };

  const handleFontSize = (v) => {
    setFontSize(v);
    if (v) editor.chain().focus().setFontSize(v).run();
    else editor.chain().focus().unsetFontSize().run();
  };

  const handleTextColor = (v) => {
    // Selection is preserved: the chain refocuses and re-applies to the
    // stored selection after the native color dialog closes.
    editor.chain().focus().setColor(v).run();
  };

  const headingValue =
    editor.isActive("heading", { level: 1 }) ? "h1"
    : editor.isActive("heading", { level: 2 }) ? "h2"
    : editor.isActive("heading", { level: 3 }) ? "h3"
    : "p";

  const toolButtonClass = (active) =>
    `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
      active ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Single-row, responsive toolbar (horizontal scroll on narrow screens) */}
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-1.5 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)" aria-label="Undo"
          className={`${toolButtonClass(false)} disabled:opacity-40 disabled:cursor-not-allowed`}>
          <Undo2 size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)" aria-label="Redo"
          className={`${toolButtonClass(false)} disabled:opacity-40 disabled:cursor-not-allowed`}>
          <Redo2 size={14} />
        </button>

        <select
          value={headingValue}
          onChange={(event) => {
            const v = event.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) }).run();
          }}
          title="Paragraph style" aria-label="Paragraph style"
          className="h-7 w-28 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <select
          value={fontFamily}
          onChange={(event) => handleFontFamily(event.target.value)}
          title="Font family" aria-label="Font family"
          className="h-7 w-32 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500"
        >
          {FONT_FAMILIES.map((opt) => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
        </select>

        <select
          value={fontSize}
          onChange={(event) => handleFontSize(event.target.value)}
          title="Font size" aria-label="Font size"
          className="h-7 w-24 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500"
        >
          {FONT_SIZES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)" aria-label="Bold" aria-pressed={editor.isActive("bold")}
          className={toolButtonClass(editor.isActive("bold"))}>
          <Bold size={14} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed={editor.isActive("italic")}
          className={toolButtonClass(editor.isActive("italic"))}>
          <Italic size={14} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)" aria-label="Underline" aria-pressed={editor.isActive("underline")}
          className={toolButtonClass(editor.isActive("underline"))}>
          <UnderlineIcon size={14} />
        </button>

        <label
          className="relative inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          title="Text color" aria-label="Text color"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Palette size={14} />
          <input
            type="color"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => handleTextColor(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        {[["left", AlignLeft, "Align left"], ["center", AlignCenter, "Align center"], ["right", AlignRight, "Align right"]].map(
          ([dirKey, Icon, title]) => (
            <button
              key={dirKey}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setTextAlign(dirKey).run()}
              title={title} aria-label={title} aria-pressed={editor.isActive({ textAlign: dirKey })}
              className={toolButtonClass(editor.isActive({ textAlign: dirKey }))}
            >
              <Icon size={14} />
            </button>
          )
        )}

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bulleted list" aria-label="Bulleted list" aria-pressed={editor.isActive("bulletList")}
          className={toolButtonClass(editor.isActive("bulletList"))}>
          <List size={14} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list" aria-label="Numbered list" aria-pressed={editor.isActive("orderedList")}
          className={toolButtonClass(editor.isActive("orderedList"))}>
          <ListOrdered size={14} />
        </button>

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear formatting" aria-label="Clear formatting"
          className={toolButtonClass(false)}>
          <RemoveFormatting size={14} />
        </button>
      </div>

      {/* Editor surface */}
      <EditorContent
        editor={editor}
        className="max-w-none px-4 py-3 focus:outline-none"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .ProseMirror {
          min-height: ${minHeight}px;
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #94a3b8;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror ul { list-style: disc; padding-left: 1.5rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; }
        .ProseMirror h1 { font-size: 1.75rem; font-weight: 700; margin: 0.75rem 0; }
        .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin: 0.6rem 0; }
        .ProseMirror h3 { font-size: 1.15rem; font-weight: 600; margin: 0.5rem 0; }
        .ProseMirror a { color: #2563eb; text-decoration: underline; }
        .ProseMirror img { max-width: 100%; height: auto; }
        .ProseMirror p { margin: 0.25rem 0; }
      ` }} />
    </div>
  );
}
