"use client";

import { useCeoTeam } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"];

export function TeamKPIs() {
  const { data, isLoading, error, mutate } = useCeoTeam();

  const hasError = !!error;
  const loading = !hasError && isLoading;
  const isDemo = hasError;

  const leaderboard = data?.sales_leaderboard ?? [];
  const depts = data?.departments ?? [];
  const newCust = data?.new_customers;
  const custChange = newCust && newCust.last_month > 0
    ? ((newCust.this_month - newCust.last_month) / newCust.last_month) * 100
    : 0;

  // Leaderboard chart data (exclude Unassigned)
  const repData = leaderboard
    .filter(r => r.rep !== "Unassigned" && r.revenue > 0)
    .map(r => ({
      name: r.rep.split(" ").map(n => n[0]).join("") + " " + r.rep.split(" ").slice(-1)[0],
      revenue: r.revenue,
      orders: r.orders,
    }));

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">👥</span> Team & Customers
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={() => mutate()} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /></>
        ) : (
          <>
            <KPICard
              label="Active Staff"
              value={num(data?.staff_count ?? 0)}
              subtitle={`${depts.length} departments`}
              trend="neutral"
            />
            <KPICard
              label="Total Customers"
              value={num(data?.total_customers ?? 0)}
              subtitle="All-time customer base"
              trend="neutral"
            />
            <KPICard
              label="New Customers (MTD)"
              value={num(newCust?.this_month ?? 0)}
              subtitle={`${custChange >= 0 ? "+" : ""}${custChange.toFixed(0)}% vs last month (${num(newCust?.last_month ?? 0)})`}
              trend={custChange >= 0 ? "good" : "warning"}
            />
            <KPICard
              label="Top Rep Revenue"
              value={fmt(leaderboard[0]?.revenue ?? 0)}
              subtitle={leaderboard[0]?.rep ?? "—"}
              trend="good"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Sales Rep Leaderboard (This Month)" subtitle="Revenue by rep" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={repData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#475569" fontSize={10} />
              <YAxis type="category" dataKey="name" width={100} stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number | undefined) => [fmt(v ?? 0), "Revenue"]}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {repData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Staff by Department" subtitle={`${num(data?.staff_count ?? 0)} active employees`} loading={loading}>
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
            {depts.map((d, i) => {
              const pct = data?.staff_count ? (d.count / data.staff_count) * 100 : 0;
              return (
                <div key={d.dept} className="flex items-center gap-2">
                  <div className="w-24 text-[10px] text-slate-400 truncate text-right">{d.dept}</div>
                  <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <div className="w-8 text-[10px] text-slate-400 font-bold">{d.count}</div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
