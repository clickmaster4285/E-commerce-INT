"use client";

import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="sa-card px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
      <p className="font-semibold text-fg">{label}</p>
      <p className="mt-0.5 text-fg-muted">
        <span className="font-semibold tabular-nums text-fg">{payload[0].value}</span> signup{payload[0].value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export default function SignupChart({ series }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="saRegFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="3 5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11.5} stroke="var(--text-muted)" dy={6} />
          <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="var(--text-muted)" allowDecimals={false} width={40} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} />
          <Area type="monotone" dataKey="count" name="Signups" stroke="var(--accent)" strokeWidth={2} fill="url(#saRegFill)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--bg-card)", fill: "var(--accent)" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
