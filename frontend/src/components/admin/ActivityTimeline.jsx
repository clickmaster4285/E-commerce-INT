import { Activity, Clock3, UserRound } from "lucide-react";

const titleByType = { created: "Record created", updated: "Record updated", status: "Status changed", payment: "Payment recorded", received: "Items received", deleted: "Record deleted", sent: "Sent to customer" };
const eventTitle = (event) => event.summary || titleByType[event.type] || String(event.type || "Activity").replaceAll("_", " ");
const actorOf = (event) => event.actor_name || event.employee_name || event.actor_id?.name || event.employee_id?.name || "Staff";
const timeOf = (event) => event.at || event.created_at || event.edited_at || event.date;

const changesFor = (event) => {
  const changes = Array.isArray(event?.changes) ? event.changes : [];
  if (event?.type === "created") return changes.filter((change) => change.action === "added");
  return changes.filter((change) => {
    if (["added", "removed", "returned"].includes(change.action)) return true;
    const before = change.before ?? change.from;
    const after = change.after ?? change.to;
    if (before === undefined || after === undefined) return true;
    return String(before).trim() !== String(after).trim();
  });
};

export default function ActivityTimeline({ events = [], title = "Activity history", emptyText = "No activity has been recorded yet." }) {
  const sorted = [...events].filter(Boolean)
    .map((event) => ({ ...event, visibleChanges: changesFor(event) }))
    .filter((event) => !(event.type === "updated" && !event.visibleChanges.length))
    .sort((a, b) => new Date(timeOf(b) || 0).getTime() - new Date(timeOf(a) || 0).getTime());
  return <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
    <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Activity size={15} /></span>
      <h2 className="text-sm font-bold">{title}</h2>
      <span className="ms-auto rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">{sorted.length}</span>
    </div>
    <div className="max-h-[620px] space-y-0 overflow-y-auto p-4">
      {sorted.length ? sorted.map((event, index) => <article key={event._id || `${timeOf(event)}-${index}`} className="relative border-s border-[var(--border-color)] pb-5 ps-5 last:border-0 last:pb-0">
        <span className="absolute -start-[6px] top-1 h-3 w-3 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-card)]" />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className="text-xs font-semibold text-[var(--text-primary)]">{eventTitle(event)}</p><p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><UserRound size={11} />{actorOf(event)}</p></div>
          <time className="inline-flex shrink-0 items-center gap-1 text-[10px] text-[var(--text-muted)]"><Clock3 size={11} />{timeOf(event) ? new Date(timeOf(event)).toLocaleString() : ""}</time>
        </div>
        {!!event.visibleChanges?.length && <div className="mt-2 space-y-1 rounded-lg bg-[var(--bg-card-alt)] px-3 py-2">
          {event.visibleChanges.map((change, changeIndex) => {
            const product = change.product_name ? `${change.product_name}${change.variant_title ? ` · ${change.variant_title}` : ""}` : "";
            const label = change.action === "added" ? `Added ${product}` : change.action === "removed" ? `Removed ${product}` : product ? `${product} — ${change.field || "Item"}` : change.field || "Details";
            const before = change.before ?? change.from ?? (change.from_quantity != null ? String(change.from_quantity) : "—");
            const afterValue = change.after ?? change.to ?? (change.to_quantity != null ? String(change.to_quantity) : "—");
            const after = change.action === "added" ? `${afterValue} qty` : afterValue;
            return <p key={`${event._id || index}-${changeIndex}`} className="break-words text-[10px] leading-4 text-[var(--text-secondary)]"><span className="font-semibold">{label}:</span> {before || "—"} <span aria-hidden="true">→</span> {after || "—"}</p>;
          })}
        </div>}
      </article>) : <div className="flex flex-col items-center px-4 py-8 text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Activity size={18} /></span><p className="text-xs font-medium text-[var(--text-muted)]">{emptyText}</p></div>}
    </div>
  </section>;
}
