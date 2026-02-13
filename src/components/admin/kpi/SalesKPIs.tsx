"use client";

import { useSalesSummary, useSalesMonthly } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"];

// Demo data for when API is unreachable
const demoSummary = {
  current_month: { orders: 62, revenue: 236836, avg_order_value: 4362 },
  previous_month: { orders: 549, revenue: 1017959, avg_order_value: 3190 },
  ytd: { orders: 611, revenue: 1254795 },
  active_orders: 16167,
  top_parts: [],
};

const demoMonthly = {
  data: [
    { month: "2025-03", orders: 479, revenue: 1529541, completed: 0, in_progress: 479 },
    { month: "2025-06", orders: 472, revenue: 918159, completed: 0, in_progress: 472 },
    { month: "2025-09", orders: 500, revenue: 905038, completed: 0, in_progress: 500 },
    { month: "2025-12", orders: 627, revenue: 962324, completed: 0, in_progress: 627 },
  ],
  months: 12,
};

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

export function SalesKPIs() {
  const { data: summary, isLoading: sumLoading, error: sumErr, mutate: mutateSummary } = useSalesSummary();
  const { data: monthly, isLoading: monthLoading, error: monthErr, mutate: mutateMonthly } = useSalesMonthly(12);

  const hasError = !!(sumErr || monthErr);
  const loading = !hasError && (sumLoading || monthLoading);
  const isDemo = hasError;

  const effectiveSummary = summary || (isDemo ? demoSummary : null);
  const effectiveMonthly = monthly || (isDemo ? demoMonthly : null);

  // Revenue change % (current vs previous month)
  const revChange = effectiveSummary && effectiveSummary.previous_month.revenue > 0
    ? ((effectiveSummary.current_month.revenue - effectiveSummary.previous_month.revenue) / effectiveSummary.previous_month.revenue) * 100
    : 0;

  // Order count change
  const ordChange = effectiveSummary && effectiveSummary.previous_month.orders > 0
    ? ((effectiveSummary.current_month.orders - effectiveSummary.previous_month.orders) / effectiveSummary.previous_month.orders) * 100
    : 0;

  // AOV change
  const aovChange = effectiveSummary && effectiveSummary.previous_month.avg_order_value > 0
    ? ((effectiveSummary.current_month.avg_order_value - effectiveSummary.previous_month.avg_order_value) / effectiveSummary.previous_month.avg_order_value) * 100
    : 0;

  // Chart data
  const chartData = (effectiveMonthly?.data ?? []).map(row => ({
    month: formatMonth(row.month),
    revenue: row.revenue,
    orders: row.orders,
  }));

  // Top parts (truncate names)
  const topParts = (effectiveSummary?.top_parts ?? [])
    .filter(p => !p.sku?.startsWith("SHIPPING") && !p.sku?.startsWith("SPECIALITEM"))
    .slice(0, 8)
    .map(p => ({
      name: p.part_name.split("\n")[0].length > 35 ? p.part_name.split("\n")[0].slice(0, 35) + "…" : p.part_name.split("\n")[0],
      revenue: p.total_revenue,
      orders: p.order_count,
    }));

  const handleRetry = () => { mutateSummary(); mutateMonthly(); };

  // Note: Feb is partial month — provide context
  const isPartialMonth = new Date().getDate() < 28;

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">💰</span> Sales & Revenue
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={handleRetry} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /></>
        ) : (
          <>
            <KPICard
              label="Revenue (This Month)"
              value={fmt(effectiveSummary?.current_month.revenue ?? 0)}
              subtitle={isPartialMonth ? `Month to date • ${revChange >= 0 ? "+" : ""}${revChange.toFixed(0)}% vs last month` : `${revChange >= 0 ? "+" : ""}${revChange.toFixed(0)}% vs last month`}
              trend={revChange >= 0 ? "good" : "critical"}
            />
            <KPICard
              label="Orders (This Month)"
              value={num(effectiveSummary?.current_month.orders ?? 0)}
              subtitle={`${ordChange >= 0 ? "+" : ""}${ordChange.toFixed(0)}% vs last month`}
              trend={ordChange >= 0 ? "good" : "critical"}
            />
            <KPICard
              label="Avg Order Value"
              value={fmt(effectiveSummary?.current_month.avg_order_value ?? 0)}
              subtitle={`${aovChange >= 0 ? "+" : ""}${aovChange.toFixed(0)}% vs last month`}
              trend={aovChange >= 0 ? "good" : "warning"}
            />
            <KPICard
              label="YTD Revenue"
              value={fmt(effectiveSummary?.ytd.revenue ?? 0)}
              subtitle={`${num(effectiveSummary?.ytd.orders ?? 0)} orders year to date`}
              trend="neutral"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue Trend (12 Months)" subtitle="Monthly revenue trendline" loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#475569" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number | undefined) => [fmt(v ?? 0), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Selling Products (This Month)" subtitle="By revenue" loading={loading}>
          {topParts.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topParts} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#475569" fontSize={10} />
                <YAxis type="category" dataKey="name" width={160} stroke="#475569" fontSize={9} tick={{ fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(v: number | undefined) => [fmt(v ?? 0), "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {topParts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">No sales data for this month yet</p>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
