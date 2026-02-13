"use client";

import { useCeoClose } from "@/hooks/useGigatron";
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444"];

export function CloseKPIs() {
  const { data, isLoading, error, mutate } = useCeoClose();

  const hasError = !!error;
  const loading = !hasError && isLoading;
  const isDemo = hasError;

  // Activity score (weighted: calls count more than emails)
  const activityScore = data
    ? (data.calls30d * 3) + (data.emailsSent30d * 1) + (data.smsSent30d * 2)
    : 0;

  // Activity breakdown for chart
  const activityData = [
    { name: "Calls", value: data?.calls30d || 0 },
    { name: "Emails", value: data?.emailsSent30d || 0 },
    { name: "SMS", value: data?.smsSent30d || 0 },
  ].filter(item => item.value > 0);

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📞</span> CRM / Sales Pipeline
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={() => mutate()} />}

      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Pipeline Value"
              value={fmt(data?.pipelineValue || 0)}
              subtitle={`${num(data?.activeOpps || 0)} active opportunities`}
              trend={
                (data?.pipelineValue || 0) > 500000
                  ? "good"
                  : (data?.pipelineValue || 0) > 200000
                  ? "warning"
                  : "critical"
              }
            />
            <KPICard
              label="Won Revenue (30d)"
              value={fmt(data?.wonRevenue30d || 0)}
              subtitle={`${num(data?.wonCount30d || 0)} deals closed`}
              trend={(data?.wonRevenue30d || 0) > 1000000 ? "good" : "warning"}
            />
            <KPICard
              label="Win Rate"
              value={`${(data?.winRate || 0).toFixed(1)}%`}
              subtitle={`${num(data?.wonCount30d || 0)} won / ${num(
                (data?.wonCount30d || 0) + (data?.lostCount30d || 0)
              )} decided`}
              trend={
                (data?.winRate || 0) > 50
                  ? "good"
                  : (data?.winRate || 0) > 30
                  ? "warning"
                  : "critical"
              }
            />
            <KPICard
              label="Activity Score"
              value={num(activityScore)}
              subtitle={`${num(data?.calls30d || 0)} calls, ${num(
                data?.emailsSent30d || 0
              )} emails, ${num(data?.smsSent30d || 0)} SMS`}
              trend={activityScore > 500 ? "good" : activityScore > 200 ? "warning" : "critical"}
            />
            <KPICard
              label="New Leads (30d)"
              value={num(data?.newLeads30d || 0)}
              subtitle={`${num(data?.leadsContacted30d || 0)} contacted`}
              trend={(data?.newLeads30d || 0) > 50 ? "good" : "warning"}
            />
          </>
        )}
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Breakdown */}
        <ChartCard title="Sales Activity (30 Days)" subtitle="Calls, emails, SMS sent" loading={loading}>
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={activityData} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tick={{ fill: "#94a3b8" }} />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(v: number | undefined) => [num(v ?? 0), "Count"]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {activityData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">No activity data available</p>
          )}
        </ChartCard>

        {/* Recent Wins */}
        <ChartCard title="Recent Wins (30 Days)" subtitle="Top 5 closed deals" loading={loading}>
          {data && data.recentWins.length > 0 ? (
            <div className="space-y-3 pt-2">
              {data.recentWins.map((win, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{win.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(win.date)} • {win.status}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-400">{fmt(win.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">No recent wins</p>
          )}
        </ChartCard>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Avg Call Duration"
              value={`${Math.round((data?.avgCallDuration || 0) / 60)} min`}
              subtitle={`${num(data?.calls30d || 0)} calls in last 30 days`}
              trend="neutral"
            />
            <KPICard
              label="Opportunities Created (30d)"
              value={num(data?.createdOpps30d || 0)}
              subtitle="New opps entering the funnel"
              trend="neutral"
            />
            <KPICard
              label="Lost Revenue (30d)"
              value={fmt(data?.lostRevenue30d || 0)}
              subtitle={`${num(data?.lostCount30d || 0)} deals lost`}
              trend="neutral"
            />
          </>
        )}
      </div>
    </section>
  );
}
