import type {
  AutomationRun,
  CostLedger,
  Customer,
  DueDiligence,
  InventoryItem,
  Lead,
  Product,
  QuoteInput,
  ShipmentMilestone,
  Supplier,
  TradeOrder,
  WorkspaceState,
} from "./types";
import { createInitialEvents } from "./audit";

export const DEMO_NOW = "2026-08-09T09:30:00.000Z";
export const TENANT_ID = "tenant-meridian-demo";

const source = (
  sourceId: string,
  label: string,
  kind: Lead["provenance"][number]["kind"],
  observedAt = "2026-08-08T08:00:00.000Z",
) => ({ sourceId, label, kind, observedAt, synthetic: true as const });

export const products: Product[] = [
  { sku: "MT-DRL-18V", name: "18V Brushless Drill Set", category: "Power Tools", hsCode: "846721", unit: "set", baseCostCny: 286, listPriceUsd: 72, weightKg: 3.8, cartonQty: 4, leadTimeDays: 28 },
  { sku: "MT-GRN-125", name: "125mm Angle Grinder", category: "Power Tools", hsCode: "846729", unit: "pc", baseCostCny: 168, listPriceUsd: 43, weightKg: 2.4, cartonQty: 6, leadTimeDays: 24 },
  { sku: "MT-WRN-12", name: "12pc Ratchet Wrench Set", category: "Hand Tools", hsCode: "820411", unit: "set", baseCostCny: 112, listPriceUsd: 31, weightKg: 2.1, cartonQty: 8, leadTimeDays: 18 },
  { sku: "MT-SKT-108", name: "108pc Socket Tool Kit", category: "Hand Tools", hsCode: "820600", unit: "set", baseCostCny: 338, listPriceUsd: 86, weightKg: 7.4, cartonQty: 2, leadTimeDays: 30 },
  { sku: "MT-LSR-G", name: "Green Beam Laser Level", category: "Measuring Tools", hsCode: "901530", unit: "pc", baseCostCny: 214, listPriceUsd: 59, weightKg: 1.6, cartonQty: 8, leadTimeDays: 21 },
  { sku: "MT-PPE-01", name: "Industrial PPE Starter Kit", category: "Safety", hsCode: "650610", unit: "kit", baseCostCny: 96, listPriceUsd: 29, weightKg: 1.2, cartonQty: 10, leadTimeDays: 15 },
  { sku: "MT-CBL-25", name: "25m Heavy-duty Cable Reel", category: "Electrical", hsCode: "854442", unit: "pc", baseCostCny: 142, listPriceUsd: 39, weightKg: 3.2, cartonQty: 4, leadTimeDays: 20 },
  { sku: "MT-ORG-36", name: "36-bin Modular Organizer", category: "Storage", hsCode: "392690", unit: "pc", baseCostCny: 78, listPriceUsd: 24, weightKg: 2.6, cartonQty: 4, leadTimeDays: 16 },
];

export const leads: Lead[] = [
  {
    id: "LEAD-1048", tenantId: TENANT_ID, company: "NordWerk Distribution GmbH", country: "Germany", region: "EU", industry: "Industrial Distribution", employees: 118, revenueBand: "USD 25M-50M", channels: ["dealer network", "e-commerce"], productsWanted: ["Power Tools", "Hand Tools"], certifications: ["ISO 9001", "CE channel compliance"], contact: { name: "Mara Klein", title: "Category Sourcing Lead", email: "mara.klein@example.invalid" }, stage: "RESEARCHED", score: 91, scoreReasons: ["High category fit", "Recent sourcing signal", "Multi-channel reach"], provenance: [source("SRC-EXPO-18", "Cologne Tool Fair exhibitor fixture", "exhibition"), source("SRC-DIR-33", "European industrial directory fixture", "trade-directory")], lastSignalAt: "2026-08-08T06:20:00.000Z",
  },
  {
    id: "LEAD-1049", tenantId: TENANT_ID, company: "Atlas Gulf Tools LLC", country: "United Arab Emirates", region: "Middle East", industry: "Construction Supply", employees: 74, revenueBand: "USD 10M-25M", channels: ["projects", "retail"], productsWanted: ["Safety", "Power Tools"], certifications: ["ISO 45001"], contact: { name: "Omar Rahal", title: "Procurement Director", email: "omar.rahal@example.invalid" }, stage: "QUALIFIED", score: 87, scoreReasons: ["Strong regional demand", "Fast payment history fixture", "Project channel"], provenance: [source("SRC-DIR-41", "Gulf construction buyers fixture", "trade-directory")], lastSignalAt: "2026-08-07T16:10:00.000Z",
  },
  {
    id: "LEAD-1050", tenantId: TENANT_ID, company: "Pacifica Equipment Chile SpA", country: "Chile", region: "LATAM", industry: "Mining Equipment", employees: 62, revenueBand: "USD 10M-25M", channels: ["mining projects", "service centers"], productsWanted: ["Measuring Tools", "Safety"], certifications: ["ISO 9001"], contact: { name: "Sofia Rojas", title: "Supply Chain Manager", email: "sofia.rojas@example.invalid" }, stage: "RESEARCHED", score: 84, scoreReasons: ["Mining segment fit", "Service footprint", "Long lead-time tolerance"], provenance: [source("SRC-EXPO-25", "Santiago mining expo fixture", "exhibition")], lastSignalAt: "2026-08-06T11:00:00.000Z",
  },
  {
    id: "LEAD-1051", tenantId: TENANT_ID, company: "Harbor & Field Supply Ltd", country: "United Kingdom", region: "EU", industry: "Home Improvement Retail", employees: 210, revenueBand: "USD 50M-100M", channels: ["retail", "marketplace"], productsWanted: ["Hand Tools", "Storage"], certifications: ["FSC retail policy"], contact: { name: "Elliot Ward", title: "Commercial Buyer", email: "elliot.ward@example.invalid" }, stage: "QUALIFIED", score: 82, scoreReasons: ["Large channel", "Private-label intent", "Category adjacency"], provenance: [source("SRC-SITE-72", "Company catalogue fixture", "company-site")], lastSignalAt: "2026-08-05T13:35:00.000Z",
  },
  {
    id: "LEAD-1052", tenantId: TENANT_ID, company: "Kibo Industrial Partners Ltd", country: "Kenya", region: "Africa", industry: "Industrial Distribution", employees: 43, revenueBand: "USD 5M-10M", channels: ["dealer network"], productsWanted: ["Electrical", "Safety"], certifications: [], contact: { name: "Nia Kamau", title: "Managing Buyer", email: "nia.kamau@example.invalid" }, stage: "NEW", score: 75, scoreReasons: ["Emerging market fit", "Dealer reach", "Limited evidence depth"], provenance: [source("SRC-DIR-57", "East Africa distributor fixture", "trade-directory")], lastSignalAt: "2026-08-04T09:25:00.000Z",
  },
  {
    id: "LEAD-1053", tenantId: TENANT_ID, company: "MaplePro Hardware Inc", country: "Canada", region: "North America", industry: "Hardware Wholesale", employees: 96, revenueBand: "USD 25M-50M", channels: ["wholesale", "e-commerce"], productsWanted: ["Power Tools", "Storage"], certifications: ["CSA channel readiness"], contact: { name: "Lucas Bennett", title: "VP Merchandising", email: "lucas.bennett@example.invalid" }, stage: "CONTACT_READY", score: 89, scoreReasons: ["High margin market", "Private-label signal", "Strong category overlap"], provenance: [source("SRC-EXPO-31", "Toronto hardware show fixture", "exhibition"), source("SRC-SITE-81", "Company catalogue fixture", "company-site")], lastSignalAt: "2026-08-08T02:15:00.000Z",
  },
  {
    id: "LEAD-1054", tenantId: TENANT_ID, company: "Bosphorus Teknik AS", country: "Türkiye", region: "Middle East", industry: "Industrial Distribution", employees: 151, revenueBand: "USD 25M-50M", channels: ["dealer network", "projects"], productsWanted: ["Power Tools", "Measuring Tools"], certifications: ["ISO 9001"], contact: { name: "Deniz Kaya", title: "Import Manager", email: "deniz.kaya@example.invalid" }, stage: "QUALIFIED", score: 80, scoreReasons: ["Category fit", "Currency volatility", "Dense dealer network"], provenance: [source("SRC-REG-12", "Business registry fixture", "registry")], lastSignalAt: "2026-08-03T10:40:00.000Z",
  },
  {
    id: "LEAD-1055", tenantId: TENANT_ID, company: "Caspian Bridge Trading FZE", country: "United Arab Emirates", region: "Middle East", industry: "General Trading", employees: 11, revenueBand: "USD 1M-5M", channels: ["re-export"], productsWanted: ["Power Tools"], certifications: [], contact: { name: "Samir Noor", title: "Director", email: "samir.noor@example.invalid" }, stage: "NEW", score: 46, scoreReasons: ["Thin operating footprint", "Unclear end market", "Potential name match review"], provenance: [source("SRC-REG-19", "Free-zone registry fixture", "registry")], lastSignalAt: "2026-07-27T09:00:00.000Z",
  },
];

const evidenceFor = (lead: Lead, riskNote: string) => [
  { id: `${lead.id}-EV1`, label: "Business registry", result: "Active synthetic record", confidence: 0.94, observedAt: "2026-08-08T08:00:00.000Z", expiresInDays: 30, provenance: source(`${lead.id}-REG`, "Synthetic corporate registry", "registry") },
  { id: `${lead.id}-EV2`, label: "Domain and catalogue", result: "Consistent product footprint", confidence: 0.86, observedAt: "2026-08-07T08:00:00.000Z", expiresInDays: 14, provenance: source(`${lead.id}-WEB`, "Synthetic company website", "company-site") },
  { id: `${lead.id}-EV3`, label: "Risk screen", result: riskNote, confidence: 0.91, observedAt: "2026-08-08T08:00:00.000Z", expiresInDays: 7, provenance: source(`${lead.id}-RISK`, "Synthetic screening fixture", "synthetic-fixture") },
];

export const dueDiligence: DueDiligence[] = leads.slice(0, 6).map((lead, index) => ({
  leadId: lead.id,
  legalName: lead.company,
  registration: "ACTIVE",
  sanctionsScreen: index === 4 ? "POTENTIAL_MATCH" : "CLEAR",
  adverseMedia: index === 4 ? "REVIEW" : "NONE",
  domainAgeYears: 4 + index * 2,
  paymentRisk: index === 4 ? 58 : 18 + index * 4,
  riskScore: index === 4 ? 61 : 14 + index * 5,
  tier: index === 4 ? "HIGH" : index > 2 ? "MEDIUM" : "LOW",
  flags: index === 4 ? ["Potential name match requires human review", "Limited financial evidence"] : [],
  evidence: evidenceFor(lead, index === 4 ? "Potential match - hold, not a confirmed match" : "No synthetic matches"),
  reviewedAt: "2026-08-08T09:00:00.000Z",
  validUntil: "2026-08-15T09:00:00.000Z",
  humanReviewRequired: index === 4,
}));

export const customers: Customer[] = [
  { id: "CUS-2401", tenantId: TENANT_ID, leadId: "LEAD-1048", company: "NordWerk Distribution GmbH", country: "Germany", industry: "Industrial Distribution", segment: "STRATEGIC", owner: "Lin Chen", preferredCurrency: "EUR", preferredIncoterm: "DDP", creditLimitUsd: 180000, paymentTerms: "30% deposit, 70% before shipment", products: ["Power Tools", "Hand Tools"], tags: ["private label", "EU", "high fit"], nextAction: "Approve revised DDP quotation", nextActionAt: "2026-08-10T08:00:00.000Z", lifetimeValueUsd: 328000 },
  { id: "CUS-2402", tenantId: TENANT_ID, leadId: "LEAD-1049", company: "Atlas Gulf Tools LLC", country: "United Arab Emirates", industry: "Construction Supply", segment: "GROWTH", owner: "Mei Zhou", preferredCurrency: "USD", preferredIncoterm: "CIF", creditLimitUsd: 120000, paymentTerms: "20% deposit, 80% against copy B/L", products: ["Safety", "Power Tools"], tags: ["project channel", "GCC"], nextAction: "Share quality inspection plan", nextActionAt: "2026-08-11T06:00:00.000Z", lifetimeValueUsd: 186000 },
  { id: "CUS-2403", tenantId: TENANT_ID, leadId: "LEAD-1050", company: "Pacifica Equipment Chile SpA", country: "Chile", industry: "Mining Equipment", segment: "GROWTH", owner: "Alex Wu", preferredCurrency: "USD", preferredIncoterm: "CIF", creditLimitUsd: 95000, paymentTerms: "T/T before shipment", products: ["Measuring Tools", "Safety"], tags: ["mining", "LATAM"], nextAction: "Confirm Spanish packaging artwork", nextActionAt: "2026-08-12T15:00:00.000Z", lifetimeValueUsd: 142000 },
  { id: "CUS-2404", tenantId: TENANT_ID, leadId: "LEAD-1053", company: "MaplePro Hardware Inc", country: "Canada", industry: "Hardware Wholesale", segment: "STRATEGIC", owner: "Lin Chen", preferredCurrency: "USD", preferredIncoterm: "FOB", creditLimitUsd: 220000, paymentTerms: "Open account 30 days after pilot", products: ["Power Tools", "Storage"], tags: ["private label", "North America"], nextAction: "Complete pilot assortment", nextActionAt: "2026-08-13T16:00:00.000Z", lifetimeValueUsd: 412000 },
];

export const suppliers: Supplier[] = [
  { id: "SUP-301", name: "Ningbo Nova Motors Co.", region: "Zhejiang", categories: ["Power Tools"], qualityScore: 94, deliveryScore: 91, responseScore: 89, sustainabilityScore: 82, defectRate: 0.006, onTimeRate: 0.96, activePos: 3, risk: "LOW" },
  { id: "SUP-302", name: "Jinhua Precision Handtools Ltd.", region: "Zhejiang", categories: ["Hand Tools"], qualityScore: 91, deliveryScore: 95, responseScore: 92, sustainabilityScore: 78, defectRate: 0.009, onTimeRate: 0.98, activePos: 2, risk: "LOW" },
  { id: "SUP-303", name: "Suzhou OptiMeasure Technology", region: "Jiangsu", categories: ["Measuring Tools"], qualityScore: 96, deliveryScore: 86, responseScore: 90, sustainabilityScore: 88, defectRate: 0.004, onTimeRate: 0.91, activePos: 2, risk: "LOW" },
  { id: "SUP-304", name: "Qingdao SafeGuard Products", region: "Shandong", categories: ["Safety"], qualityScore: 87, deliveryScore: 82, responseScore: 85, sustainabilityScore: 91, defectRate: 0.014, onTimeRate: 0.88, activePos: 1, risk: "MEDIUM" },
  { id: "SUP-305", name: "Taizhou Modular Plastics", region: "Zhejiang", categories: ["Storage", "Electrical"], qualityScore: 83, deliveryScore: 79, responseScore: 81, sustainabilityScore: 76, defectRate: 0.021, onTimeRate: 0.84, activePos: 2, risk: "MEDIUM" },
];

export const inventory: InventoryItem[] = products.map((product, index) => ({
  sku: product.sku,
  warehouse: index % 2 === 0 ? "Ningbo FTZ" : "Yiwu Consolidation",
  onHand: [640, 420, 880, 210, 360, 1260, 510, 730][index],
  reserved: [320, 190, 240, 96, 144, 500, 220, 260][index],
  inProduction: [800, 600, 400, 360, 480, 700, 420, 600][index],
  inbound: [240, 120, 200, 80, 160, 300, 140, 160][index],
  safetyStock: [160, 120, 180, 60, 80, 260, 110, 150][index],
  updatedAt: DEMO_NOW,
  version: 7 + index,
}));

export const quotes: QuoteInput[] = [
  {
    id: "QT-2026-0819", customerId: "CUS-2401", currency: "EUR", incoterm: "DDP",
    lines: [
      { sku: "MT-DRL-18V", quantity: 480, unitPrice: 69, unitCostCny: 286, weightKg: 3.8 },
      { sku: "MT-GRN-125", quantity: 600, unitPrice: 41, unitCostCny: 168, weightKg: 2.4 },
      { sku: "MT-WRN-12", quantity: 800, unitPrice: 29, unitCostCny: 112, weightKg: 2.1 },
    ],
    exchangeRates: { USD: 1, EUR: 0.92, CNY: 7.18 }, discountRate: 0.025, freightUsd: 7200, insuranceRate: 0.004, dutyRate: 0.047, commissionRate: 0.02, overheadUsd: 1650,
  },
  {
    id: "QT-2026-0820", customerId: "CUS-2402", currency: "USD", incoterm: "CIF",
    lines: [
      { sku: "MT-PPE-01", quantity: 1200, unitPrice: 27.5, unitCostCny: 96, weightKg: 1.2 },
      { sku: "MT-DRL-18V", quantity: 240, unitPrice: 70, unitCostCny: 286, weightKg: 3.8 },
    ],
    exchangeRates: { USD: 1, EUR: 0.92, CNY: 7.18 }, discountRate: 0.015, freightUsd: 3900, insuranceRate: 0.0035, dutyRate: 0, commissionRate: 0.015, overheadUsd: 980,
  },
];

const milestones = (prefix: string, currentIndex: number): ShipmentMilestone[] => [
  ["Production release", "2026-07-18", "Supplier", "PO and artwork locked"],
  ["Inline inspection", "2026-07-29", "Quality", "AQL 1.5 fixture passed"],
  ["Final inspection", "2026-08-08", "Quality", "612 cartons released"],
  ["Vessel booking", "2026-08-10", "Logistics", "Booking fixture received"],
  ["Export customs", "2026-08-13", "Trade ops", "Draft documents prepared"],
  ["Departure", "2026-08-15", "Carrier", "Synthetic vessel schedule"],
  ["Arrival", "2026-09-12", "Carrier", "Synthetic ETA"],
  ["Delivery", "2026-09-16", "Destination agent", "Awaiting POD"],
].map(([label, plannedAt, owner, evidence], index) => ({
  id: `${prefix}-M${index + 1}`,
  label,
  status: index < currentIndex ? "DONE" : index === currentIndex ? "CURRENT" : "UPCOMING",
  plannedAt,
  actualAt: index < currentIndex ? `${plannedAt}T08:30:00.000Z` : undefined,
  owner,
  evidence,
  customerMessage: index < currentIndex ? `${label} completed and evidence attached.` : `${label} remains on the current plan.`,
} as ShipmentMilestone));

export const orders: TradeOrder[] = [
  { id: "SO-260731", tenantId: TENANT_ID, customerId: "CUS-2401", quoteId: "QT-2026-0819", poNumber: "NW-PO-7718", stage: "BOOKED", currency: "EUR", incoterm: "DDP", amountUsd: 79240, destination: "Hamburg, Germany", etd: "2026-08-15", eta: "2026-09-12", container: "1 x 40HQ", milestones: milestones("SO-260731", 3) },
  { id: "SO-260724", tenantId: TENANT_ID, customerId: "CUS-2402", quoteId: "QT-2026-0820", poNumber: "AGT-8821", stage: "QUALITY_CHECK", currency: "USD", incoterm: "CIF", amountUsd: 49800, destination: "Jebel Ali, UAE", etd: "2026-08-22", eta: "2026-09-11", container: "1 x 20GP", milestones: milestones("SO-260724", 2) },
  { id: "SO-260706", tenantId: TENANT_ID, customerId: "CUS-2403", quoteId: "QT-2026-0819", poNumber: "PEC-2026-418", stage: "IN_TRANSIT", currency: "USD", incoterm: "CIF", amountUsd: 36420, destination: "San Antonio, Chile", etd: "2026-07-28", eta: "2026-09-02", container: "LCL 18.6 CBM", milestones: milestones("SO-260706", 6) },
];

export const ledgers: CostLedger[] = [
  { orderId: "SO-260731", revenueUsd: 79240, procurementUsd: 48760, freightUsd: 7200, insuranceUsd: 317, dutyUsd: 3724, commissionUsd: 1585, bankFeesUsd: 182, fxGainLossUsd: 640, overheadUsd: 1650 },
  { orderId: "SO-260724", revenueUsd: 49800, procurementUsd: 29840, freightUsd: 3900, insuranceUsd: 174, dutyUsd: 0, commissionUsd: 747, bankFeesUsd: 136, fxGainLossUsd: -210, overheadUsd: 980 },
  { orderId: "SO-260706", revenueUsd: 36420, procurementUsd: 21680, freightUsd: 5080, insuranceUsd: 144, dutyUsd: 0, commissionUsd: 546, bankFeesUsd: 118, fxGainLossUsd: 295, overheadUsd: 760 },
];

export const automations: AutomationRun[] = [
  { id: "RUN-9F12", name: "Lead radar daily sweep", status: "SUCCEEDED", trigger: "SCHEDULE", startedAt: "2026-08-09T01:15:00.000Z", finishedAt: "2026-08-09T01:16:12.000Z", savedMinutes: 86, steps: [
    { label: "Collect synthetic signals", status: "DONE", detail: "48 public-style fixtures normalized" },
    { label: "Resolve duplicates", status: "DONE", detail: "6 duplicate entities merged" },
    { label: "Score ICP fit", status: "DONE", detail: "8 leads ranked, 3 above threshold" },
    { label: "Open research tasks", status: "DONE", detail: "2 due-diligence refreshes queued" },
  ] },
  { id: "RUN-9F11", name: "Delivery milestone digest", status: "SUCCEEDED", trigger: "EVENT", startedAt: "2026-08-08T12:30:00.000Z", finishedAt: "2026-08-08T12:30:18.000Z", savedMinutes: 42, steps: [
    { label: "Read order events", status: "DONE", detail: "3 orders evaluated" },
    { label: "Detect changed milestones", status: "DONE", detail: "2 customer updates drafted" },
    { label: "Policy check", status: "DONE", detail: "No supplier cost exposed" },
    { label: "Place in outbox", status: "DONE", detail: "Draft only - no real message sent" },
  ] },
  { id: "RUN-9F10", name: "Risk evidence freshness", status: "HELD", trigger: "SCHEDULE", startedAt: "2026-08-08T03:00:00.000Z", savedMinutes: 24, steps: [
    { label: "Check evidence TTL", status: "DONE", detail: "31 records evaluated" },
    { label: "Resolve potential match", status: "HELD", detail: "Kibo fixture requires human review" },
    { label: "Release contact plan", status: "SKIPPED", detail: "Blocked by compliance policy" },
  ] },
];

export function createSeedState(): WorkspaceState {
  return {
    schemaVersion: 3,
    tenantId: TENANT_ID,
    leads: structuredClone(leads),
    dueDiligence: structuredClone(dueDiligence),
    customers: structuredClone(customers),
    products: structuredClone(products),
    suppliers: structuredClone(suppliers),
    inventory: structuredClone(inventory),
    quotes: structuredClone(quotes),
    orders: structuredClone(orders),
    ledgers: structuredClone(ledgers),
    events: createInitialEvents(TENANT_ID),
    automations: structuredClone(automations),
    updatedAt: DEMO_NOW,
  };
}
