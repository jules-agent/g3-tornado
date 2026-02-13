"use client";

import { useCeoOperations } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

const PIPELINE_COLORS: Record<string, string> = {
  "In Progress": "#06b6d4",
  "Hot": "#ef4444",
  "Completed": "#10b981",
  "Estimate": "#f59e0b",
  "Cancelled": "#6b7280",
};

const PATH_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export function OperationsKPIs() {
  const { data, isLoading, error, mutate } = useCeoOperations();

  const hasError = !!error;
  const loading = !hasError && isLoading;
  const isDemo = hasError;

  const pipeline = data?.pipeline ?? [];
  const hot = data?.hot_orders;
  const paths = data?.order_paths ?? [];
  const fulfil = data?.fulfillment;
  const vendors = data?.vendors;

  const fulfillRate = fulfil && fulfil.total > 0 ? (fulfil.completed / fulfil.total) * 100 : 0;
  const inProgressValue = pipeline.find(p => p.status === "In Progress")?.value ?? 0;

  // Pipeline for pie chart (exclude Cancelled)
  const pieData = pipeline
    .filter(p => p.status !== "Cancelled" && p.value > 0)
    .map(p => ({ name: p.status, value: p.value, count: p.count }));

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">⚙️</span> Operations
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={() => mutate()} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /></>
        ) : (
          <>
            <KPICard
              label="Active Pipeline"
              value={fmt(inProgressValue)}
              subtitle={`${num(pipeline.find(p => p.status === "In Progress")?.count ?? 0)} orders in progress`}
              trend="neutral"
            />
            <KPICard
              label="🔥 Hot Orders"
              value={num(hot?.count ?? 0)}
              subtitle={fmt(hot?.value ?? 0) + " total value"}
              trend={(hot?.count ?? 0) > 100 ? "warning" : "neutral"}
            />
            <KPICard
              label="Fulfillment Rate"
              value={`${fulfillRate.toFixed(1)}%`}
              subtitle={`${num(fulfil?.pending ?? 0)} items pending`}
              trend={fulfillRate > 95 ? "good" : fulfillRate > 80 ? "warning" : "critical"}
            />
            <KPICard
              label="Active Vendors"
              value={num(vendors?.active_vendors ?? 0)}
              subtitle={`${num(vendors?.open_pos ?? 0)} open POs`}
              trend="neutral"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Order Pipeline" subtitle="By status and value" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={PIPELINE_COLORS[entry.name] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: number | undefined, name?: string) => [fmt(v ?? 0), name ?? ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Order Paths (Last 3 Months)" subtitle="Ship vs Install vs Will Call" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={paths.filter(p => p.value > 0)} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#475569" fontSize={10} />
              <YAxis type="category" dataKey="path" width={80} stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: number | undefined) => [fmt(v ?? 0), "Value"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {paths.filter(p => p.value > 0).map((_, i) => (
                  <Cell key={i} fill={PATH_COLORS[i % PATH_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
