"use client";

import { useInventoryStats, useInventory } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { demoInventoryStats, demoTopInventoryItems } from "./demoData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"];

export function InventoryKPIs() {
  const { data: stats, isLoading: statsLoading, error: statsErr, mutate: mutateStats } = useInventoryStats();
  const { data: inventory, isLoading: invLoading, error: invErr, mutate: mutateInv } = useInventory({ limit: 500 });

  const hasError = !!(statsErr || invErr);
  const loading = !hasError && (statsLoading || invLoading);
  const isDemo = hasError;

  // Use real data or demo fallback
  const effectiveStats = stats || (isDemo ? demoInventoryStats : null);

  // Compute top 10 highest value items
  const topItems = inventory?.data
    ? [...inventory.data]
        .sort((a, b) => (Number(b.value_on_hand) || 0) - (Number(a.value_on_hand) || 0))
        .slice(0, 10)
        .map((item) => ({
          name: item.part_name.length > 25 ? item.part_name.slice(0, 25) + "…" : item.part_name,
          value: Number(item.value_on_hand) || 0,
        }))
    : isDemo
    ? demoTopInventoryItems
    : [];

  const availabilityRate = effectiveStats
    ? Math.round((effectiveStats.parts_in_stock / effectiveStats.total_parts_tracked) * 100)
    : 0;

  const availTrend = availabilityRate >= 90 ? "good" : availabilityRate >= 70 ? "warning" : "critical";

  const handleRetry = () => {
    mutateStats();
    mutateInv();
  };

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📦</span> Inventory
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={handleRetry} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Inventory Value"
              value={fmt(effectiveStats?.total_value_on_hand ?? 0)}
              subtitle={`${num(effectiveStats?.total_qty_available ?? 0)} units on hand`}
              trend="neutral"
            />
            <KPICard
              label="Stock Availability"
              value={`${availabilityRate}%`}
              subtitle={`${num(effectiveStats?.parts_in_stock ?? 0)} of ${num(effectiveStats?.total_parts_tracked ?? 0)} in stock`}
              trend={availTrend}
            />
            <KPICard
              label="On Order"
              value={num(effectiveStats?.parts_on_order ?? 0)}
              subtitle="Parts awaiting delivery"
              trend="neutral"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ChartCard title="Top 10 Highest Value Items" subtitle="By inventory value on hand" loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topItems} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#475569" fontSize={10} />
              <YAxis type="category" dataKey="name" width={140} stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number | undefined) => [fmt(v ?? 0), "Value"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {topItems.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
