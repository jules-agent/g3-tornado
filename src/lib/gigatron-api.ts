// =============================================================================
// Gigatron API Client — Server-side only
// DO NOT import this in client components (API key would be exposed)
// =============================================================================

import type {
  PartsResponse,
  PartDetail,
  BrandsResponse,
  CarsResponse,
  GroupsResponse,
  OptionsResponse,
  CustomPartsResponse,
  PartsFilters,
  VendorsResponse,
  VendorDetail,
  VendorPartsResponse,
  VendorSearchResponse,
  VendorsFilters,
  InventoryResponse,
  InventoryDetail,
  LowStockResponse,
  InventoryStats,
  InventoryFilters,
  CustomersResponse,
  CustomerDetail,
  CustomerOrdersResponse,
  CustomersFilters,
  PaginationParams,
  SalesSummary,
  SalesMonthly,
  CeoFinancial,
  CeoOperations,
  CeoTeam,
  CeoClose,
} from "@/types/gigatron";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.GIGATRON_API_URL || "http://35.215.122.92/api/tornado";
const API_KEY = process.env.GIGATRON_API_KEY || "";

if (!API_KEY && typeof window === "undefined") {
  console.warn("[gigatron-api] GIGATRON_API_KEY is not set");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function fetchGigatron<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = buildUrl(path, params);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    // No caching by default — let the proxy routes decide
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GigatronApiError(res.status, body || res.statusText);
  }

  return res.json() as Promise<T>;
}

export class GigatronApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(`Gigatron API error ${statusCode}: ${message}`);
    this.name = "GigatronApiError";
  }
}

// ---------------------------------------------------------------------------
// Parts API (7 endpoints)
// ---------------------------------------------------------------------------

export async function getParts(filters?: PartsFilters): Promise<PartsResponse> {
  return fetchGigatron<PartsResponse>("/parts", filters as Record<string, string | number | undefined>);
}

export async function getPartById(id: number): Promise<PartDetail> {
  return fetchGigatron<PartDetail>(`/parts/${id}`);
}

export async function getBrands(): Promise<BrandsResponse> {
  return fetchGigatron<BrandsResponse>("/brands");
}

export async function getCars(): Promise<CarsResponse> {
  return fetchGigatron<CarsResponse>("/cars");
}

export async function getGroups(): Promise<GroupsResponse> {
  return fetchGigatron<GroupsResponse>("/groups");
}

export async function getOptions(): Promise<OptionsResponse> {
  return fetchGigatron<OptionsResponse>("/options");
}

export async function getCustomParts(params?: PaginationParams): Promise<CustomPartsResponse> {
  return fetchGigatron<CustomPartsResponse>("/custom-parts", params as Record<string, number | undefined>);
}

// ---------------------------------------------------------------------------
// Vendors API (4 endpoints)
// ---------------------------------------------------------------------------

export async function getVendors(filters?: VendorsFilters): Promise<VendorsResponse> {
  return fetchGigatron<VendorsResponse>("/vendors", filters as Record<string, string | number | undefined>);
}

export async function getVendorById(id: number): Promise<VendorDetail> {
  return fetchGigatron<VendorDetail>(`/vendors/${id}`);
}

export async function getVendorParts(vendorId: number, params?: PaginationParams): Promise<VendorPartsResponse> {
  return fetchGigatron<VendorPartsResponse>(`/vendors/${vendorId}/parts`, params as Record<string, number | undefined>);
}

export async function searchVendors(q: string): Promise<VendorSearchResponse> {
  return fetchGigatron<VendorSearchResponse>("/vendors/search", { q });
}

// ---------------------------------------------------------------------------
// Inventory API (4 endpoints)
// ---------------------------------------------------------------------------

export async function getInventory(filters?: InventoryFilters): Promise<InventoryResponse> {
  return fetchGigatron<InventoryResponse>("/inventory", filters as Record<string, string | number | boolean | undefined>);
}

export async function getInventoryByPartId(partId: number): Promise<InventoryDetail> {
  return fetchGigatron<InventoryDetail>(`/inventory/${partId}`);
}

export async function getLowStock(threshold?: number): Promise<LowStockResponse> {
  return fetchGigatron<LowStockResponse>("/inventory/low-stock", threshold ? { threshold } : undefined);
}

export async function getInventoryStats(): Promise<InventoryStats> {
  return fetchGigatron<InventoryStats>("/inventory/stats");
}

// ---------------------------------------------------------------------------
// Customers API (3 endpoints)
// ---------------------------------------------------------------------------

export async function getCustomers(filters?: CustomersFilters): Promise<CustomersResponse> {
  return fetchGigatron<CustomersResponse>("/customers", filters as Record<string, string | number | undefined>);
}

export async function getCustomerById(id: number): Promise<CustomerDetail> {
  return fetchGigatron<CustomerDetail>(`/customers/${id}`);
}

export async function getCustomerOrders(customerId: number, params?: PaginationParams): Promise<CustomerOrdersResponse> {
  return fetchGigatron<CustomerOrdersResponse>(`/customers/${customerId}/orders`, params as Record<string, number | undefined>);
}

// ---------------------------------------------------------------------------
// Sales API (2 endpoints)
// ---------------------------------------------------------------------------

export async function getSalesSummary(): Promise<SalesSummary> {
  return fetchGigatron<SalesSummary>("/sales/summary");
}

export async function getSalesMonthly(months?: number): Promise<SalesMonthly> {
  return fetchGigatron<SalesMonthly>("/sales/monthly", months ? { months } : undefined);
}

// ---------------------------------------------------------------------------
// CEO Dashboard API (3 endpoints)
// ---------------------------------------------------------------------------

export async function getCeoFinancial(): Promise<CeoFinancial> {
  return fetchGigatron<CeoFinancial>("/ceo/financial");
}

export async function getCeoOperations(): Promise<CeoOperations> {
  return fetchGigatron<CeoOperations>("/ceo/operations");
}

export async function getCeoTeam(): Promise<CeoTeam> {
  return fetchGigatron<CeoTeam>("/ceo/team");
}

// ---------------------------------------------------------------------------
// Close.io CRM API
// ---------------------------------------------------------------------------

const CLOSE_API_KEY = process.env.CLOSE_API_KEY || "";
const CLOSE_BASE_URL = "https://api.close.com/api/v1";
const CLOSE_ORG_ID = "orga_vahlY4qpnhBRNLfIaB5dlRLDvBkMNmI7CkFbBrowGka";

async function fetchClose<T>(path: string): Promise<T> {
  const url = `${CLOSE_BASE_URL}${path}`;
  const auth = Buffer.from(`${CLOSE_API_KEY}:`).toString("base64");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Close.io API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function getCeoClose(): Promise<CeoClose> {
  const today = new Date();
  const date30dAgo = new Date(today);
  date30dAgo.setDate(today.getDate() - 30);

  const dateStart = date30dAgo.toISOString().split("T")[0];
  const dateEnd = today.toISOString().split("T")[0];

  // Parallel API calls
  const [activityReport, activeOpps, wonOpps, lostOpps, allLeads] = await Promise.all([
    fetchClose<any>(`/report/activity/${CLOSE_ORG_ID}/?date_start=${dateStart}&date_end=${dateEnd}`),
    fetchClose<any>(`/opportunity/?query=status_type:"active"`),
    fetchClose<any>(`/opportunity/?query=status_type:"won" date_won>="${dateStart}"&_order_by=-date_won&_limit=100`),
    fetchClose<any>(`/opportunity/?query=status_type:"lost" date_lost>="${dateStart}"&_limit=100`),
    fetchClose<any>(`/lead/?query=date_created>="${dateStart}"&_limit=1000`),
  ]);

  // Calculate metrics
  const pipelineValue = (activeOpps.data || []).reduce((sum: number, opp: any) => sum + (opp.value || 0), 0);
  const activeOppsCount = activeOpps.data?.length || 0;

  const wonRevenue30d = (wonOpps.data || []).reduce((sum: number, opp: any) => sum + (opp.value || 0), 0);
  const wonCount30d = wonOpps.data?.length || 0;

  const lostRevenue30d = (lostOpps.data || []).reduce((sum: number, opp: any) => sum + (opp.value || 0), 0);
  const lostCount30d = lostOpps.data?.length || 0;

  const totalDecided = wonCount30d + lostCount30d;
  const winRate = totalDecided > 0 ? (wonCount30d / totalDecided) * 100 : 0;

  const newLeads30d = allLeads.data?.length || 0;

  // Activity metrics (from activity report)
  const calls30d = activityReport.calls?.total || 0;
  const emailsSent30d = activityReport.emails_sent?.total || 0;
  const smsSent30d = activityReport.sms_sent?.total || 0;
  const avgCallDuration = activityReport.calls?.average_duration || 0;

  // Contacted leads (leads with at least one activity)
  const leadsContacted30d = activityReport.leads_contacted?.total || 0;

  // Recent wins (top 5)
  const recentWins = (wonOpps.data || []).slice(0, 5).map((opp: any) => ({
    name: opp.lead_name || "Unknown",
    value: opp.value || 0,
    status: opp.status_label || "Won",
    date: opp.date_won || "",
  }));

  // Opportunities created in last 30 days
  const createdOpps30d = (wonOpps.data || []).filter((opp: any) => {
    const created = new Date(opp.date_created);
    return created >= date30dAgo;
  }).length + (lostOpps.data || []).filter((opp: any) => {
    const created = new Date(opp.date_created);
    return created >= date30dAgo;
  }).length + activeOppsCount;

  return {
    pipelineValue: pipelineValue / 100, // Close.io values are in cents
    activeOpps: activeOppsCount,
    wonRevenue30d: wonRevenue30d / 100,
    wonCount30d,
    lostRevenue30d: lostRevenue30d / 100,
    lostCount30d,
    winRate,
    newLeads30d,
    leadsContacted30d,
    calls30d,
    emailsSent30d,
    smsSent30d,
    avgCallDuration,
    recentWins: recentWins.map((w: any) => ({ ...w, value: w.value / 100 })),
    createdOpps30d,
  };
}
