import { Activity, Clock3, UserRound } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const titleKeyByType = { created: "created", updated: "updated", status: "statusChanged", payment: "paymentRecorded", received: "itemsReceived", deleted: "deleted", sent: "sent", return: "returnProcessed" };
const fieldKeyByName = { "Subtotal": "subtotal", "Total discount": "discount", "Overall discount": "discount", "Discount": "discount", "Discount rate": "discountRate", "Overall discount rate": "discountRate", "Tax": "tax", "Total tax": "tax", "Tax rate": "taxRate", "Unit price": "unitPrice", "Quantity": "quantity", "Invoice total": "total", "Total": "total", "Status": "currentStatus" };
const timeOf = (event) => event.at || event.created_at || event.edited_at || event.date;
const isolate = (value) => `\u2068${String(value ?? "")}\u2069`;
const localizedStatus = (value, t) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  const invoiceStatusKey = normalized === "partially paid" ? "partiallyPaid" : normalized;
  const quoteStatuses = ["pending", "draft", "sent", "accepted", "rejected"];
  const invoiceStatuses = ["unpaid", "partiallyPaid", "paid", "overdue"];
  if (quoteStatuses.includes(invoiceStatusKey)) return t(`admin.quoteInvoice.status.${invoiceStatusKey}`);
  if (invoiceStatuses.includes(invoiceStatusKey)) return t(`admin.invoiceDetail.status.${invoiceStatusKey}`);
  return value;
};

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

export default function ActivityTimeline({ events = [], title = "Activity history", emptyText = "No activity has been recorded yet.", variant = "default" }) {
  const { t, locale } = useTranslation();
  const simple = variant === "simple";
  const sorted = [...events].filter(Boolean)
    .map((event) => ({ ...event, visibleChanges: changesFor(event) }))
    .filter((event) => !(event.type === "updated" && !event.visibleChanges.length))
    .sort((a, b) => new Date(timeOf(b) || 0).getTime() - new Date(timeOf(a) || 0).getTime());
  return <section className={`overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] ${simple ? "rounded-lg" : "rounded-2xl shadow-sm"}`}>
    <div className={`flex items-center gap-2.5 border-b border-[var(--border-color)] px-4 py-3 ${simple ? "" : "bg-[var(--bg-card-alt)]"}`}>
      {simple ? <Activity size={16} className="text-[var(--accent)]" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Activity size={15} /></span>}
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="ms-auto rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">{sorted.length}</span>
    </div>
    <div className={`max-h-[620px] space-y-0 overflow-y-auto ${simple ? "p-3" : "p-4"}`}>
      {sorted.length ? sorted.map((event, index) => <article key={event._id || `${timeOf(event)}-${index}`} className="relative border-s border-[var(--border-color)] pb-5 ps-5 last:border-0 last:pb-0">
        <span className="absolute -start-[6px] top-1 h-3 w-3 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-card)]" />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p dir="auto" className="text-[13px] font-semibold leading-5 text-[var(--text-primary)]">{event.summary || t(`admin.documentDetail.activity.type.${titleKeyByType[event.type] || "generic"}`)}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><UserRound size={13} /><bdi dir="auto">{event.actor_name || event.employee_name || event.actor_id?.name || event.employee_id?.name || t("admin.documentDetail.activity.staff")}</bdi></p></div>
          <time dir="auto" className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)]"><Clock3 size={13} /><bdi>{timeOf(event) ? new Date(timeOf(event)).toLocaleString(locale || undefined, { dateStyle: "medium", timeStyle: "short" }) : ""}</bdi></time>
        </div>
        {!!event.visibleChanges?.length && <div className="mt-3 space-y-2 rounded-lg bg-[var(--bg-card-alt)] px-3.5 py-3">
          {event.visibleChanges.map((change, changeIndex) => {
            const product = change.product_name ? `${change.product_name}${change.variant_title ? ` · ${change.variant_title}` : ""}` : "";
            const before = change.before ?? change.from ?? (change.from_quantity != null ? String(change.from_quantity) : "—");
            const afterValue = change.after ?? change.to ?? (change.to_quantity != null ? String(change.to_quantity) : "—");
            const fieldKey = fieldKeyByName[change.field] || "details";
            const field = t(`admin.documentDetail.field.${fieldKey}`);
            let message;
            if (change.action === "added") message = t("admin.documentDetail.activity.added", { product: isolate(product || change.field || t("admin.documentDetail.field.item")), quantity: isolate(change.to_quantity ?? afterValue) });
            else if (change.action === "removed") message = t("admin.documentDetail.activity.removed", { product: isolate(product || change.field || t("admin.documentDetail.field.item")), quantity: isolate(change.from_quantity ?? before) });
            else if (change.action === "quantity") message = t("admin.documentDetail.activity.quantityChanged", { product: isolate(product), before: isolate(change.from_quantity ?? before), after: isolate(change.to_quantity ?? afterValue) });
            else message = t("admin.documentDetail.activity.changed", { product: product ? `${isolate(product)} · ` : "", field: isolate(field === `admin.documentDetail.field.${fieldKey}` ? change.field || t("admin.documentDetail.field.details") : field), before: isolate(change.field === "Status" ? localizedStatus(before, t) : before || "—"), after: isolate(change.field === "Status" ? localizedStatus(afterValue, t) : afterValue || "—") });
            return <p dir="auto" key={`${event._id || index}-${changeIndex}`} className="break-words text-[13px] leading-5 text-[var(--text-secondary)]"><span className="me-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)] align-middle" /><span>{message}</span></p>;
          })}
        </div>}
      </article>) : <div className="flex flex-col items-center px-4 py-8 text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Activity size={18} /></span><p className="text-sm font-medium text-[var(--text-muted)]">{emptyText}</p></div>}
    </div>
  </section>;
}
