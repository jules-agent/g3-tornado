"use client";

import useSWR, { type SWRConfiguration } from "swr";
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
} from "@/types/gigatron";

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function buildQuery(base: string, params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return base;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

const defaultOpts: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000,
};

// ---------------------------------------------------------------------------
// Parts hooks
// ---------------------------------------------------------------------------

export function useParts(filters?: PartsFilters, opts?: SWRConfiguration) {
  return useSWR<PartsResponse>(
    buildQuery("/api/gigatron/parts", filters as Record<string, string | number | undefined>),
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function usePart(id: number | null, opts?: SWRConfiguration) {
  return useSWR<PartDetail>(
    id != null ? `/api/gigatron/parts/${id}` : null,
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useBrands(opts?: SWRConfiguration) {
  return useSWR<BrandsResponse>("/api/gigatron/brands", fetcher, { ...defaultOpts, ...opts });
}

export function useCars(opts?: SWRConfiguration) {
  return useSWR<CarsResponse>("/api/gigatron/cars", fetcher, { ...defaultOpts, ...opts });
}

export function useGroups(opts?: SWRConfiguration) {
  return useSWR<GroupsResponse>("/api/gigatron/groups", fetcher, { ...defaultOpts, ...opts });
}

export function useOptions(opts?: SWRConfiguration) {
  return useSWR<OptionsResponse>("/api/gigatron/options", fetcher, { ...defaultOpts, ...opts });
}

export function useCustomParts(params?: { limit?: number; offset?: number }, opts?: SWRConfiguration) {
  return useSWR<CustomPartsResponse>(
    buildQuery("/api/gigatron/custom-parts", params),
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

// ---------------------------------------------------------------------------
// Vendor hooks
// ---------------------------------------------------------------------------

export function useVendors(filters?: VendorsFilters, opts?: SWRConfiguration) {
  return useSWR<VendorsResponse>(
    buildQuery("/api/gigatron/vendors", filters as Record<string, string | number | undefined>),
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useVendor(id: number | null, opts?: SWRConfiguration) {
  return useSWR<VendorDetail>(
    id != null ? `/api/gigatron/vendors/${id}` : null,
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useVendorParts(vendorId: number | null, params?: { limit?: number; offset?: number }, opts?: SWRConfiguration) {
  return useSWR<VendorPartsResponse>(
    vendorId != null ? buildQuery(`/api/gigatron/vendors/${vendorId}/parts`, params) : null,
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useVendorSearch(q: string | null, opts?: SWRConfiguration) {
  return useSWR<VendorSearchResponse>(
    q ? `/api/gigatron/vendors/search?q=${encodeURIComponent(q)}` : null,
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

// ---------------------------------------------------------------------------
// Inventory hooks (admin only — will 403 for non-admin users)
// ---------------------------------------------------------------------------

export function useInventory(filters?: InventoryFilters, opts?: SWRConfiguration) {
  return useSWR<InventoryResponse>(
    buildQuery("/api/gigatron/inventory", filters as Record<string, string | number | boolean | undefined>),
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useInventoryPart(partId: number | null, opts?: SWRConfiguration) {
  return useSWR<InventoryDetail>(
    partId != null ? `/api/gigatron/inventory/${partId}` : null,
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useLowStock(threshold?: number, opts?: SWRConfiguration) {
  return useSWR<LowStockResponse>(
    buildQuery("/api/gigatron/inventory/low-stock", threshold ? { threshold } : undefined),
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useInventoryStats(opts?: SWRConfiguration) {
  return useSWR<InventoryStats>("/api/gigatron/inventory/stats", fetcher, { ...defaultOpts, ...opts });
}

// ---------------------------------------------------------------------------
// Customer hooks (admin only)
// ---------------------------------------------------------------------------

export function useCustomers(filters?: CustomersFilters, opts?: SWRConfiguration) {
  return useSWR<CustomersResponse>(
    buildQuery("/api/gigatron/customers", filters as Record<string, string | number | undefined>),
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useCustomer(id: number | null, opts?: SWRConfiguration) {
  return useSWR<CustomerDetail>(
    id != null ? `/api/gigatron/customers/${id}` : null,
    fetcher,
    { ...defaultOpts, ...opts }
  );
}

export function useCustomerOrders(customerId: number | null, params?: { limit?: number; offset?: number }, opts?: SWRConfiguration) {
  return useSWR<CustomerOrdersResponse>(
    customerId != null ? buildQuery(`/api/gigatron/customers/${customerId}/orders`, params) : null,
    fetcher,
    { ...defaultOpts, ...opts }
  );
}
