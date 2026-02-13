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
