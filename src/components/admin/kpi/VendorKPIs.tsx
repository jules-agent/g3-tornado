"use client";

import { useVendors } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { demoVendors } from "./demoData";

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function VendorKPIs() {
  const { data: vendors, isLoading, error, mutate } = useVendors({ limit: 500 });

  const isDemo = !!error;
  const loading = isLoading && !isDemo;
  const effectiveVendors = vendors || (isDemo ? demoVendors : null);

  const activeVendors = (effectiveVendors?.data ?? []).filter((v) => v.active);
  const totalVendors = effectiveVendors?.total ?? 0;
  const activeCount = activeVendors.length;
  const inactiveCount = totalVendors - activeCount;
  const hasPaymentTerms = activeVendors.filter((v) => v.payment_terms).length;

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🏭</span> Vendors
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={() => mutate()} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Total Vendors"
              value={num(totalVendors)}
              subtitle={`${num(activeCount)} active`}
              trend="neutral"
            />
            <KPICard
              label="Active Rate"
              value={totalVendors > 0 ? `${Math.round((activeCount / totalVendors) * 100)}%` : "—"}
              subtitle={`${num(inactiveCount)} inactive`}
              trend={totalVendors > 0 && activeCount / totalVendors > 0.8 ? "good" : "warning"}
            />
            <KPICard
              label="With Payment Terms"
              value={num(hasPaymentTerms)}
              subtitle={`of ${num(activeCount)} active vendors`}
              trend="neutral"
            />
            <KPICard
              label="Vendor Coverage"
              value={activeCount >= 10 ? "Diversified" : activeCount >= 5 ? "Moderate" : "Concentrated"}
              subtitle={`${num(activeCount)} active suppliers`}
              trend={activeCount >= 10 ? "good" : activeCount >= 5 ? "warning" : "critical"}
            />
          </>
        )}
      </div>

      <ChartCard title="Vendor Directory" subtitle={`${num(activeCount)} active vendors`} loading={loading}>
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
          {activeVendors.slice(0, 20).map((vendor) => (
            <div key={vendor.id} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{vendor.vendor_name}</p>
                <p className="text-[10px] text-slate-500 truncate">{vendor.contact_name || vendor.email || "No contact"}</p>
              </div>
              <div className="text-right ml-3 flex items-center gap-2">
                {vendor.payment_terms && (
                  <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded">
                    {vendor.payment_terms}
                  </span>
                )}
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          ))}
          {activeVendors.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">No vendor data</p>
          )}
        </div>
      </ChartCard>
    </section>
  );
}
