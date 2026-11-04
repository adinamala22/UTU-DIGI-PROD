"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueChart({ data }: { data: { day: string; revenue: number; orders: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
          <Tooltip
            contentStyle={{ background: "#12121a", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#fff" }}
            formatter={(v, name) => (name === "revenue" ? [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"] : [v, "Orders"])}
          />
          <Area type="monotone" dataKey="revenue" stroke="var(--c-primary)" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
