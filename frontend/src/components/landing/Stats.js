import { Rocket, Languages, Banknote, RotateCcw, FileCheck, KeyRound } from "lucide-react";
import CountUp from "./CountUp";

/* Honest product facts — no fake analytics. */
const FACTS = [
  { icon: Rocket, count: 15, suffix: " min", label: "Average setup", desc: "Go live the same day" },
  { icon: Languages, text: "EN + اردو", label: "Full Urdu RTL", desc: "Nastaliq + RTL layout" },
  { icon: Banknote, text: "COD · Bank · Card", label: "Payment methods", desc: "One reconciled ledger" },
  { icon: RotateCcw, count: 7, suffix: " days", label: "Easy returns", desc: "Auto-restock on refund" },
  { icon: FileCheck, text: "QT → INV", label: "Quote to invoice", desc: "One click, no re-typing" },
  { icon: KeyRound, count: 28, prefix: "~", suffix: "", label: "Staff permissions", desc: "Granular roles, live changes" },
];

export default function Stats() {
  return (
    <section aria-label="Click Master Store at a glance" className="pf-stats">
      <dl className="pf-stats-grid">
        {FACTS.map(({ icon: Icon, count, prefix = "", text, suffix, label, desc }) => (
          <div key={label} className="pf-stat-item">
            <Icon size={16} className="pf-stat-icon" aria-hidden="true" />
            <dd className={`pf-stat-num order-2 ${text ? "pf-stat-num-text" : ""}`}>
              {typeof count === "number" ? (
                <CountUp value={count} prefix={prefix} suffix={suffix} duration={1.2} />
              ) : (
                text
              )}
            </dd>
            <dt className="pf-stat-label order-3">{label}</dt>
            <p className="pf-stat-desc order-4">{desc}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
