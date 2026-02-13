// =============================================================================
// Gigatron API Type Definitions
// All types based on actual API response shapes from dev server
// =============================================================================

// --- Parts ---

export interface Part {
  id: number;
  part_name: string;
  part_description: string;
  brand: string;
  car: string;
  group: string;
  price_retail: number;
  weight: number;
  sku: string;
}

export interface PartDetail extends Part {
  price_cost: number;
  notes: string;
}

export interface CustomPart {
  id: number;
  part_name: string;
  part_description: string;
  price_retail: number;
  is_custom: boolean;
  lead_time_days: number;
}

export interface PartsResponse {
  data: Part[];
  total: number;
  limit: number;
  offset: number;
}

export interface CustomPartsResponse {
  data: CustomPart[];
  total: number;
  limit: number;
  offset: number;
}

export interface BrandsResponse {
  brands: string[];
  total: number;
}

export interface CarsResponse {
  cars: string[];
  total: number;
}

export interface GroupsResponse {
  groups: string[];
  total: number;
}

export interface OptionsResponse {
  options: string[];
  total: number;
}

export interface PartsFilters {
  limit?: number;
  offset?: number;
  brand?: string;
  car?: string;
  group?: string;
  search?: string;
}

// --- Vendors ---

export interface Vendor {
  id: number;
  vendor_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  payment_terms: string;
  active: boolean;
}

export interface VendorDetail extends Vendor {
  notes: string;
}

export interface VendorPart {
  id: number;
  part_name: string;
  sku: string;
  price_cost: number;
  price_retail: number;
}

export interface VendorsResponse {
  data: Vendor[];
  total: number;
  limit: number;
  offset: number;
}

export interface VendorPartsResponse {
  vendor: { id: number; vendor_name: string };
  parts: VendorPart[];
  total: number;
}

export interface VendorSearchResult {
  id: number;
  vendor_name: string;
  email: string;
  phone: string;
}

export interface VendorSearchResponse {
  query: string;
  results: VendorSearchResult[];
  total: number;
}

export interface VendorsFilters {
  limit?: number;
  offset?: number;
  search?: string;
}

// --- Inventory ---

export interface InventoryItem {
  part_id: number;
  part_name: string;
  sku: string;
  qty_available: number;
  qty_future: number;
  qty_on_order: number;
  qty_sold_ytd: number;
  value_on_hand: number;
  last_updated: string;
}

export interface InventoryDetail extends InventoryItem {
  qty_reserved: number;
  qty_sold_mtd: number;
  last_sale_date: string;
  last_received_date: string;
}

export interface LowStockItem {
  part_id: number;
  part_name: string;
  sku: string;
  qty_available: number;
  qty_future: number;
  estimated_arrival: string;
}

export interface InventoryResponse {
  data: InventoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface LowStockResponse {
  threshold: number;
  data: LowStockItem[];
  total: number;
}

export interface InventoryStats {
  total_parts_tracked: number;
  total_value_on_hand: number;
  parts_in_stock: number;
  parts_low_stock: number;
  parts_out_of_stock: number;
  parts_on_order: number;
  total_qty_available: number;
  last_updated: string;
}

export interface InventoryFilters {
  limit?: number;
  offset?: number;
  low_stock?: boolean;
}

// --- Customers ---

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
  active: boolean;
}

export interface CustomerDetail extends Customer {
  address: string;
  car_models: string[];
  average_order_value: number;
  first_order_date: string;
  notes: string;
}

export interface OrderItem {
  part_name: string;
  qty: number;
  price: number;
}

export interface Order {
  order_id: number;
  order_date: string;
  total: number;
  status: string;
  items: OrderItem[];
}

export interface CustomersResponse {
  data: Customer[];
  total: number;
  limit: number;
  offset: number;
}

export interface CustomerOrdersResponse {
  customer: { id: number; name: string };
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

export interface CustomersFilters {
  limit?: number;
  offset?: number;
  search?: string;
}

// --- Generic ---

export interface GigatronError {
  statusCode: number;
  message: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// --- Sales ---

export interface SalesSummary {
  current_month: { orders: number; revenue: number; avg_order_value: number };
  previous_month: { orders: number; revenue: number; avg_order_value: number };
  ytd: { orders: number; revenue: number };
  active_orders: number;
  top_parts: Array<{ part_name: string; sku: string; order_count: number; total_revenue: number }>;
}

export interface SalesMonthlyRow {
  month: string;
  orders: number;
  revenue: number;
  completed: number;
  in_progress: number;
}

export interface SalesMonthly {
  data: SalesMonthlyRow[];
  months: number;
}

// --- CEO Dashboard ---

export interface CeoFinancial {
  accounts_receivable: { open_invoices: number; total_ar: number };
  payments: { this_month: number; last_month: number };
  gross_profit: { revenue: number; cost: number; gross_profit: number };
  payment_trend: Array<{ month: string; collected: number }>;
}

export interface CeoOperations {
  pipeline: Array<{ status: string; count: number; value: number }>;
  hot_orders: { count: number; value: number };
  order_paths: Array<{ path: string; count: number; value: number }>;
  fulfillment: { total: number; completed: number; pending: number };
  vendors: { active_vendors: number; open_pos: number };
}

export interface CeoTeam {
  sales_leaderboard: Array<{ rep: string; orders: number; revenue: number }>;
  departments: Array<{ dept: string; count: number }>;
  staff_count: number;
  new_customers: { this_month: number; last_month: number };
  total_customers: number;
}
