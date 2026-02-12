"use client";

import { useParts, useBrands, useCars, useCustomParts } from "@/hooks/useGigatron";
import { KPICard, KPICardSkeleton } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { ConnectionError, DemoBadge } from "./ConnectionError";
import { demoParts, demoBrands, demoCars, demoCustomParts } from "./demoData";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

const BRAND_COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"];

export function PartsKPIs() {
  const { data: parts, isLoading: partsLoading, error: partsErr, mutate: mutateParts } = useParts({ limit: 1000 });
  const { data: brands, isLoading: brandsLoading, error: brandsErr, mutate: mutateBrands } = useBrands();
  const { data: cars, isLoading: carsLoading, error: carsErr, mutate: mutateCars } = useCars();
  const { data: customParts, isLoading: customLoading, error: customErr, mutate: mutateCustom } = useCustomParts({ limit: 1 });

  const hasError = !!(partsErr || brandsErr || carsErr || customErr);
  const loading = !hasError && (partsLoading || brandsLoading || carsLoading || customLoading);
  const isDemo = hasError;

  const effectiveParts = parts || (isDemo ? demoParts : null);
  const effectiveBrands = brands || (isDemo ? demoBrands : null);
  const effectiveCars = cars || (isDemo ? demoCars : null);
  const effectiveCustomParts = customParts || (isDemo ? demoCustomParts : null);

  // Compute brand distribution
  const brandCounts: Record<string, number> = {};
  (effectiveParts?.data ?? []).forEach((p: { brand: string }) => {
    brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
  });
  const brandData = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // Compute car distribution
  const carCounts: Record<string, number> = {};
  (effectiveParts?.data ?? []).forEach((p: { car: string }) => {
    carCounts[p.car] = (carCounts[p.car] || 0) + 1;
  });
  const carData = Object.entries(carCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // Average price
  const allPrices = (effectiveParts?.data ?? []).map((p: { price_retail: number | string }) => Number(p.price_retail) || 0).filter((p: number) => p > 0);
  const avgPrice = allPrices.length > 0 ? allPrices.reduce((s: number, p: number) => s + p, 0) / allPrices.length : 0;

  const totalParts = effectiveParts?.total ?? 0;

  const handleRetry = () => {
    mutateParts();
    mutateBrands();
    mutateCars();
    mutateCustom();
  };

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🔧</span> Parts Catalog
        {isDemo && <DemoBadge />}
      </h2>

      {isDemo && <ConnectionError onRetry={handleRetry} />}

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
              label="Total Active Parts"
              value={num(totalParts)}
              subtitle={`Across ${effectiveBrands?.total ?? 0} brands`}
              trend="neutral"
            />
            <KPICard
              label="Vehicle Models"
              value={num(effectiveCars?.total ?? 0)}
              subtitle="Supported vehicle types"
              trend="neutral"
            />
            <KPICard
              label="Custom Parts"
              value={num(effectiveCustomParts?.total ?? 0)}
              subtitle="Made-to-order items"
              trend="neutral"
            />
            <KPICard
              label="Avg Part Price"
              value={fmt(avgPrice)}
              subtitle="Retail average"
              trend="neutral"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Parts by Brand" subtitle="Top 8 brands by part count" loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={brandData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {brandData.map((_, i) => (
                  <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Parts by Vehicle" subtitle="Distribution across Tesla models" loading={loading}>
          <div className="space-y-3">
            {carData.map((car, i) => {
              const pct = totalParts ? Math.round((car.value / totalParts) * 100) : 0;
              return (
                <div key={car.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-300">{car.name}</span>
                    <span className="text-xs text-slate-500">{num(car.value)} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {carData.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-8">No vehicle data</p>
            )}
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
