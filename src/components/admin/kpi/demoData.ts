/**
 * Demo/fallback data for the Health Dashboard when Gigatron API is unreachable.
 * Clearly labeled — used ONLY when the API connection fails.
 */

export const demoInventoryStats = {
  total_parts_tracked: 847,
  parts_in_stock: 712,
  parts_on_order: 43,
  total_qty_available: 3_241,
  total_value_on_hand: 1_847_320,
};

export const demoLowStock = {
  total: 14,
  data: [
    { part_id: 1, part_name: "Model S Plaid Front Lip", sku: "UP-MS-FL-001", qty_available: 1 },
    { part_id: 2, part_name: "Model 3 Carbon Rear Diffuser", sku: "UP-M3-RD-002", qty_available: 2 },
    { part_id: 3, part_name: "Model Y Performance Spoiler", sku: "UP-MY-SP-003", qty_available: 0 },
    { part_id: 4, part_name: "Model X Front Bumper Cover", sku: "UP-MX-FB-004", qty_available: 3 },
    { part_id: 5, part_name: "Cybertruck Rock Slider Kit", sku: "UP-CT-RS-005", qty_available: 1 },
    { part_id: 6, part_name: "Model S Ascension-R Hood", sku: "UP-MS-AH-006", qty_available: 0 },
    { part_id: 7, part_name: "Model 3 Street Fender Set", sku: "UP-M3-SF-007", qty_available: 2 },
  ],
};

export const demoTopInventoryItems = [
  { name: "Ascension-R Front Bumper", value: 142_800 },
  { name: "Carbon Fiber Hood – MS", value: 98_400 },
  { name: "Plaid Track Diffuser", value: 87_200 },
  { name: "Cybertruck Fender Flares", value: 76_500 },
  { name: "M3 Performance Front Lip", value: 64_300 },
  { name: "MY Wide Body Kit", value: 58_100 },
  { name: "MX Roof Spoiler CF", value: 45_200 },
  { name: "MS Side Skirts Carbon", value: 38_700 },
  { name: "M3 Rear Trunk Spoiler", value: 32_400 },
  { name: "CT Running Boards", value: 28_900 },
];

export const demoParts = {
  total: 847,
  data: [] as { brand: string; car: string; price_retail: number }[],
};
// Generate fake brand/car distribution
const brands = ["Unplugged Performance", "XPEL", "3M", "T Sportline", "RPM Tesla", "Mountain Pass", "Ingenext", "Abstract Ocean"];
const cars = ["Model S", "Model 3", "Model X", "Model Y", "Cybertruck"];
for (let i = 0; i < 200; i++) {
  demoParts.data.push({
    brand: brands[Math.floor(i * brands.length / 200) % brands.length],
    car: cars[Math.floor(i * cars.length / 200) % cars.length],
    price_retail: 200 + Math.floor(Math.random() * 4800),
  });
}

export const demoBrands = { total: brands.length, data: brands.map((b, i) => ({ id: i, brand_name: b })) };
export const demoCars = { total: cars.length, data: cars.map((c, i) => ({ id: i, car_name: c })) };
export const demoCustomParts = { total: 23, data: [] };

export const demoVendors = {
  total: 18,
  data: [
    { id: 1, vendor_name: "Advanced Composites Inc.", active: true, contact_name: "Mike Reynolds", email: "mike@advcomp.com", payment_terms: "Net 30" },
    { id: 2, vendor_name: "Carbon Revolution", active: true, contact_name: "Sarah Chen", email: "sarah@carbonrev.com", payment_terms: "Net 45" },
    { id: 3, vendor_name: "Precision Mold Co.", active: true, contact_name: "Tom Baker", email: "tom@precmold.com", payment_terms: "Net 30" },
    { id: 4, vendor_name: "Tesla Surplus Direct", active: true, contact_name: "", email: "orders@teslasurp.com", payment_terms: "" },
    { id: 5, vendor_name: "Aero Dynamics LLC", active: true, contact_name: "James Wu", email: "james@aerodyn.com", payment_terms: "Net 60" },
    { id: 6, vendor_name: "SoCal Vinyl Wraps", active: true, contact_name: "Ana Garcia", email: "ana@socalvinyl.com", payment_terms: "COD" },
    { id: 7, vendor_name: "Pacific Powder Coat", active: true, contact_name: "Dave Kim", email: "dave@pacpowder.com", payment_terms: "Net 30" },
    { id: 8, vendor_name: "Global Fasteners Corp", active: true, contact_name: "Linda Park", email: "linda@globalfast.com", payment_terms: "Net 15" },
    { id: 9, vendor_name: "EV Parts Wholesale", active: false, contact_name: "Rick Sanchez", email: "", payment_terms: "" },
    { id: 10, vendor_name: "CNC Masters USA", active: true, contact_name: "Paul Harris", email: "paul@cncmasters.com", payment_terms: "Net 30" },
  ],
};

export const demoCustomers = {
  total: 342,
  data: [
    { name: "Jay Leno's Garage", active: true, last_order_date: new Date(Date.now() - 5 * 86400000).toISOString(), total_spent: 187_400, total_orders: 12 },
    { name: "West Coast Customs", active: true, last_order_date: new Date(Date.now() - 12 * 86400000).toISOString(), total_spent: 142_800, total_orders: 8 },
    { name: "Tesla Owners SoCal", active: true, last_order_date: new Date(Date.now() - 30 * 86400000).toISOString(), total_spent: 98_200, total_orders: 24 },
    { name: "SpeedTech Performance", active: true, last_order_date: new Date(Date.now() - 45 * 86400000).toISOString(), total_spent: 76_500, total_orders: 6 },
    { name: "EV Modifiers Club", active: true, last_order_date: new Date(Date.now() - 8 * 86400000).toISOString(), total_spent: 64_100, total_orders: 15 },
    { name: "Plaid Performance Shop", active: true, last_order_date: new Date(Date.now() - 60 * 86400000).toISOString(), total_spent: 53_700, total_orders: 4 },
    { name: "Charged Up Motors", active: true, last_order_date: new Date(Date.now() - 20 * 86400000).toISOString(), total_spent: 42_300, total_orders: 7 },
    { name: "Elite Tesla Mods", active: true, last_order_date: new Date(Date.now() - 100 * 86400000).toISOString(), total_spent: 38_900, total_orders: 3 },
    { name: "Bay Area EV Works", active: false, last_order_date: new Date(Date.now() - 200 * 86400000).toISOString(), total_spent: 28_400, total_orders: 5 },
    { name: "Austin Tesla Club", active: true, last_order_date: new Date(Date.now() - 15 * 86400000).toISOString(), total_spent: 21_600, total_orders: 9 },
  ],
};
