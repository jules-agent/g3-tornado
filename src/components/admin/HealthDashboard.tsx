"use client";

import { SalesKPIs } from "./kpi/SalesKPIs";
import { CloseKPIs } from "./kpi/CloseKPIs";
import { FinancialKPIs } from "./kpi/FinancialKPIs";
import { OperationsKPIs } from "./kpi/OperationsKPIs";
import { TeamKPIs } from "./kpi/TeamKPIs";
import { InventoryKPIs } from "./kpi/InventoryKPIs";
import { PartsKPIs } from "./kpi/PartsKPIs";
import { VendorKPIs } from "./kpi/VendorKPIs";
import { CustomerKPIs } from "./kpi/CustomerKPIs";

export function HealthDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 -mx-4 -mt-4 px-6 py-8 sm:px-8 lg:px-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">CEO Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500 ml-[19px]">
          Real-time KPIs from Gigatron • Unplugged Performance
        </p>
      </div>

      {/* Dashboard Sections — CEO priority order */}
      <div className="space-y-10">
        <SalesKPIs />
        <div className="border-t border-slate-800" />
        <CloseKPIs />
        <div className="border-t border-slate-800" />
        <FinancialKPIs />
        <div className="border-t border-slate-800" />
        <OperationsKPIs />
        <div className="border-t border-slate-800" />
        <TeamKPIs />
        <div className="border-t border-slate-800" />
        <InventoryKPIs />
        <div className="border-t border-slate-800" />
        <PartsKPIs />
        <div className="border-t border-slate-800" />
        <VendorKPIs />
        <div className="border-t border-slate-800" />
        <CustomerKPIs />
      </div>

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-600">
          Data sourced from Gigatron ERP • Auto-refreshes every 30s • Retries on failure
        </p>
      </div>
    </div>
  );
}
