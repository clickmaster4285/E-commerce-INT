"use client";

/* ==========================================================
   STORE EDITOR STATE (zustand)
   draft (theme JSON) + selection + undo/redo + save status.
   Server sync (autosave / publish) page.js me hota hai; yahan sirf
   pure state transitions — har change ek naya immutable draft.
   ========================================================== */

import { create } from "zustand";

const HISTORY_LIMIT = 50;

const clone = (v) => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const randomId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

export const defaultsOf = (fields = []) =>
  Object.fromEntries(fields.map((f) => [f.key, f.default === undefined ? null : clone(f.default)]));

export const useThemeEditorStore = create((set, get) => ({
  draft: null,
  revision: 0,
  selected: null, // { kind: "section", id } | { kind: "theme", group } | { kind: "menus" }
  past: [],
  future: [],
  dirty: false,
  saveState: "idle", // idle | saving | saved | error | conflict
  saveError: null,

  // Server se load / reload (history reset)
  load: ({ draft, revision }) =>
    set({ draft: clone(draft), revision, past: [], future: [], dirty: false, saveState: "idle", saveError: null }),

  select: (selected) => set({ selected }),

  // Har edit yahan se — updater(draftCopy) mutate kar sakta hai
  update: (updater) => {
    const { draft, past } = get();
    if (!draft) return;
    const next = clone(draft);
    updater(next);
    set({ draft: next, past: [...past, draft].slice(-HISTORY_LIMIT), future: [], dirty: true });
  },

  undo: () => {
    const { past, draft, future } = get();
    if (!past.length) return;
    set({ draft: past[past.length - 1], past: past.slice(0, -1), future: [draft, ...future], dirty: true });
  },

  redo: () => {
    const { past, draft, future } = get();
    if (!future.length) return;
    set({ draft: future[0], future: future.slice(1), past: [...past, draft], dirty: true });
  },

  markSaving: () => set({ saveState: "saving", saveError: null }),
  markSaved: (revision, savedDraft) =>
    set((s) => ({
      revision,
      saveState: "saved",
      // Save ke dauran naya edit hua ho to dirty rehne do
      dirty: s.draft !== savedDraft ? s.dirty : false,
    })),
  markSaveError: (saveState, saveError) => set({ saveState, saveError }),

  // ── Section helpers ──
  addSection: (type, schemaType) => {
    const { draft } = get();
    if (!draft) return;
    const id = schemaType.limit === 1 && !draft.sections[type] ? type : randomId(type);
    get().update((d) => {
      d.sections[id] = { type, disabled: false, settings: defaultsOf(schemaType.settings), blocks: [] };
      d.order.push(id);
    });
    set({ selected: { kind: "section", id } });
  },

  removeSection: (id) => {
    get().update((d) => {
      delete d.sections[id];
      d.order = d.order.filter((x) => x !== id);
    });
    if (get().selected?.id === id) set({ selected: null });
  },

  duplicateSection: (id) =>
    get().update((d) => {
      const src = d.sections[id];
      if (!src) return;
      const copyId = randomId(src.type);
      d.sections[copyId] = clone(src);
      d.order.splice(d.order.indexOf(id) + 1, 0, copyId);
    }),

  toggleSection: (id) =>
    get().update((d) => {
      if (d.sections[id]) d.sections[id].disabled = !d.sections[id].disabled;
    }),

  moveSection: (id, delta) =>
    get().update((d) => {
      const i = d.order.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.order.length) return;
      [d.order[i], d.order[j]] = [d.order[j], d.order[i]];
    }),

  setOrder: (order) =>
    get().update((d) => {
      d.order = order;
    }),

  setSectionSetting: (id, key, value) =>
    get().update((d) => {
      if (d.sections[id]) d.sections[id].settings = { ...d.sections[id].settings, [key]: value };
    }),

  setBlocks: (id, blocks) =>
    get().update((d) => {
      if (d.sections[id]) d.sections[id].blocks = blocks;
    }),

  setSectionStyle: (id, key, value) =>
    get().update((d) => {
      if (d.sections[id]) d.sections[id].style = { ...(d.sections[id].style || {}), [key]: value };
    }),

  // Theme preset → sirf colors / typography / layout replace (sections ka content same)
  applyPreset: (preset) =>
    get().update((d) => {
      for (const [group, values] of Object.entries(preset?.settings || {})) {
        d.settings[group] = { ...(d.settings[group] || {}), ...clone(values) };
      }
    }),

  setGlobalSetting: (group, key, value) =>
    get().update((d) => {
      d.settings[group] = { ...(d.settings[group] || {}), [key]: value };
    }),

  setMenu: (menuKey, items) =>
    get().update((d) => {
      d.menus = { ...(d.menus || {}), [menuKey]: items };
    }),
}));

export { randomId };
