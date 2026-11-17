import CountUp from "./CountUp";
import { STATS } from "./data";

export default function Stats() {
  return (
    <section
      aria-label="Click Master Store in numbers"
      className="border-y border-[var(--user-border)] bg-[var(--user-bg-card)]"
    >
      <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-[var(--user-border)] px-2 sm:grid-cols-4 sm:px-6 lg:px-8">
        {STATS.map(({ value, suffix, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 px-2 py-8 text-center sm:py-10">
            <dt className="order-2 mt-1 max-w-[10rem] text-[10px] font-bold uppercase tracking-wider text-[var(--user-text-muted)] sm:text-[11px]">
              {label}
            </dt>
            <dd className="order-1 text-2xl font-extrabold tabular-nums text-[var(--user-accent)] sm:text-4xl">
              <CountUp value={value} suffix={suffix} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
