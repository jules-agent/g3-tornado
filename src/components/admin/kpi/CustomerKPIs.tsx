"use client";

import { useCustomers } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { demoCustomers } from "./demoData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function CustomerKPIs() {
  const { data: customers, isLoading, error, mutate } = useCustomers({ limit: 500 });

  const isDemo = !!error && !isLoading;
  const effectiveCustomers = customers || (isDemo ? demoCustomers : null);

  const allCustomers = effectiveCustomers?.data ?? [];
  const totalCustomers = effectiveCustomers?.total ?? 0;
  const activeCustomers = allCustomers.filter((c) => c.active);

  // Recent orders (within 90 days)
  const now = Date.now();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  const recentCustomers = allCustomers.filter(
    (c) => c.last_order_date && now - new Date(c.last_order_date).getTime() < ninetyDays
  );

  // Total revenue
  const totalRevenue = allCustomers.reduce((s, c) => s + (c.total_spent || 0), 0);
  const totalOrders = allCustomers.reduce((s, c) => s + (c.total_orders || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top 10 customers by spend
  const topCustomers = [...allCustomers]
    .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
    .slice(0, 10)
    .map((c) => ({
      name: c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name,
      spent: c.total_spent || 0,
    }));

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">👥</span> Customers
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={() => mutate()} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Total Customers"
              value={num(totalCustomers)}
              subtitle={`${num(activeCustomers.length)} active`}
              trend="neutral"
            />
            <KPICard
              label="Recent Orders (90d)"
              value={num(recentCustomers.length)}
              subtitle="Customers with recent activity"
              trend={recentCustomers.length > totalCustomers * 0.3 ? "good" : "warning"}
            />
            <KPICard
              label="Total Revenue"
              value={fmt(totalRevenue)}
              subtitle={`${num(totalOrders)} total orders`}
              trend="good"
            />
            <KPICard
              label="Avg Order Value"
              value={fmt(avgOrderValue)}
              subtitle="Revenue per order"
              trend="neutral"
            />
          </>
        )}
      </div>

      <ChartCard title="Top 10 Customers by Revenue" subtitle="Lifetime spend" loading={isLoading}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topCustomers} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#475569" fontSize={10} />
            <YAxis type="category" dataKey="name" width={130} stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(v: number | undefined) => [fmt(v ?? 0), "Revenue"]}
            />
            <Bar dataKey="spent" fill="#06b6d4" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}
