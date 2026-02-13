"use client";

import { useCeoFinancial } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

export function FinancialKPIs() {
  const { data, isLoading, error, mutate } = useCeoFinancial();

  const hasError = !!error;
  const loading = !hasError && isLoading;
  const isDemo = hasError;

  const ar = data?.accounts_receivable;
  const pmts = data?.payments;
  const gp = data?.gross_profit;
  const gpMargin = gp && gp.revenue > 0 ? (gp.gross_profit / gp.revenue) * 100 : 0;

  const pmtChange = pmts && pmts.last_month > 0
    ? ((pmts.this_month - pmts.last_month) / pmts.last_month) * 100
    : 0;

  const chartData = (data?.payment_trend ?? []).map(row => ({
    month: formatMonth(row.month),
    collected: row.collected,
  }));

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">💵</span> Financial Health
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={() => mutate()} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /></>
        ) : (
          <>
            <KPICard
              label="Accounts Receivable"
              value={fmt(ar?.total_ar ?? 0)}
              subtitle={`${ar?.open_invoices ?? 0} open invoices`}
              trend={(ar?.total_ar ?? 0) > 1000000 ? "warning" : "neutral"}
            />
            <KPICard
              label="Payments Collected (MTD)"
              value={fmt(pmts?.this_month ?? 0)}
              subtitle={`${pmtChange >= 0 ? "+" : ""}${pmtChange.toFixed(0)}% vs last month`}
              trend={pmtChange >= 0 ? "good" : "critical"}
            />
            <KPICard
              label="Gross Profit (MTD)"
              value={fmt(gp?.gross_profit ?? 0)}
              subtitle={`${gpMargin.toFixed(1)}% margin on ${fmt(gp?.revenue ?? 0)} revenue`}
              trend={gpMargin > 30 ? "good" : gpMargin > 15 ? "warning" : "critical"}
            />
            <KPICard
              label="COGS (MTD)"
              value={fmt(gp?.cost ?? 0)}
              subtitle="Cost of goods sold this month"
              trend="neutral"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ChartCard title="Payments Collected (6 Months)" subtitle="Cash inflow trend" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
              <XAxis dataKey="month" stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#475569" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number | undefined) => [fmt(v ?? 0), "Collected"]}
              />
              <Bar dataKey="collected" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
