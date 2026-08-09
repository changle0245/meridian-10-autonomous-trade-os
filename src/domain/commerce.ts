import type { CostLedger, InventoryItem, QuoteInput, QuoteResult } from "./types";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function calculateQuote(input: QuoteInput): QuoteResult {
  const quoteRate = input.exchangeRates[input.currency];
  const cnyPerUsd = input.exchangeRates.CNY;
  if (!quoteRate || !cnyPerUsd) throw new Error("Missing exchange rate");
  if (input.lines.length === 0) throw new Error("Quote requires at least one line");
  if (input.discountRate < 0 || input.discountRate >= 0.5) throw new Error("Discount outside policy range");

  const goodsQuoteCurrency = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) * (1 - input.discountRate);
  const goodsUsd = goodsQuoteCurrency / quoteRate;
  const procurementUsd = input.lines.reduce((sum, line) => sum + (line.quantity * line.unitCostCny) / cnyPerUsd, 0);
  const includesFreight = input.incoterm === "CIF" || input.incoterm === "DDP";
  const includesInsurance = includesFreight;
  const includesDuty = input.incoterm === "DDP";
  const freightUsd = includesFreight ? input.freightUsd : 0;
  const insuranceUsd = includesInsurance ? (goodsUsd + freightUsd) * input.insuranceRate : 0;
  const dutyUsd = includesDuty ? (goodsUsd + freightUsd + insuranceUsd) * input.dutyRate : 0;
  const revenueUsd = goodsUsd + freightUsd + insuranceUsd + dutyUsd;
  const commissionUsd = revenueUsd * input.commissionRate;
  const landedCostUsd = procurementUsd + freightUsd + insuranceUsd + dutyUsd + commissionUsd + input.overheadUsd;
  const grossProfitUsd = revenueUsd - procurementUsd;
  const netProfitUsd = revenueUsd - landedCostUsd;
  const grossMargin = grossProfitUsd / revenueUsd;
  const netMargin = netProfitUsd / revenueUsd;
  const warnings: string[] = [];
  if (netMargin < 0.08) warnings.push("Net margin is below the 8% hard floor");
  else if (netMargin < 0.16) warnings.push("Net margin requires commercial review");
  if (input.incoterm === "DDP" && input.dutyRate === 0) warnings.push("DDP quote requires a non-zero duty assumption");
  if (input.discountRate > 0.08) warnings.push("Discount exceeds autonomous approval limit");
  const guardrail: QuoteResult["guardrail"] = netMargin < 0.08 || input.discountRate > 0.12 ? "BLOCK" : netMargin < 0.16 || warnings.length > 0 ? "REVIEW" : "PASS";

  return {
    quoteId: input.id,
    currency: input.currency,
    incoterm: input.incoterm,
    goodsUsd: round(goodsUsd),
    freightUsd: round(freightUsd),
    insuranceUsd: round(insuranceUsd),
    dutyUsd: round(dutyUsd),
    commissionUsd: round(commissionUsd),
    overheadUsd: round(input.overheadUsd),
    revenueUsd: round(revenueUsd),
    landedCostUsd: round(landedCostUsd),
    grossProfitUsd: round(grossProfitUsd),
    netProfitUsd: round(netProfitUsd),
    grossMargin: round(grossMargin, 4),
    netMargin: round(netMargin, 4),
    customerTotal: round(revenueUsd * quoteRate),
    guardrail,
    warnings,
  };
}

export interface ProfitResult {
  orderId: string;
  totalCostUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  netMargin: number;
  contributionMargin: number;
  status: "HEALTHY" | "WATCH" | "LOSS";
}

export function calculateProfit(ledger: CostLedger): ProfitResult {
  const variableCost = ledger.procurementUsd + ledger.freightUsd + ledger.insuranceUsd + ledger.dutyUsd + ledger.commissionUsd + ledger.bankFeesUsd;
  const totalCostUsd = variableCost + ledger.overheadUsd - ledger.fxGainLossUsd;
  const grossProfitUsd = ledger.revenueUsd - ledger.procurementUsd;
  const netProfitUsd = ledger.revenueUsd - totalCostUsd;
  const netMargin = netProfitUsd / ledger.revenueUsd;
  const contributionMargin = (ledger.revenueUsd - variableCost) / ledger.revenueUsd;
  return {
    orderId: ledger.orderId,
    totalCostUsd: round(totalCostUsd),
    grossProfitUsd: round(grossProfitUsd),
    netProfitUsd: round(netProfitUsd),
    netMargin: round(netMargin, 4),
    contributionMargin: round(contributionMargin, 4),
    status: netProfitUsd < 0 ? "LOSS" : netMargin < 0.12 ? "WATCH" : "HEALTHY",
  };
}

export function stressLedger(ledger: CostLedger, options: { cnyWeakeningRate: number; freightIncreaseRate: number }): CostLedger {
  return {
    ...ledger,
    procurementUsd: round(ledger.procurementUsd * (1 - options.cnyWeakeningRate)),
    freightUsd: round(ledger.freightUsd * (1 + options.freightIncreaseRate)),
    fxGainLossUsd: round(ledger.fxGainLossUsd + ledger.procurementUsd * options.cnyWeakeningRate * 0.3),
  };
}

export interface ReservationResult {
  inventory: InventoryItem[];
  status: "RESERVED" | "IDEMPOTENT_REPLAY" | "REJECTED";
  availableBefore: number;
  availableAfter: number;
  reason: string;
  requestId: string;
}

export function reserveInventory(
  inventory: InventoryItem[],
  request: { requestId: string; sku: string; quantity: number; expectedVersion?: number },
  appliedRequestIds: ReadonlySet<string> = new Set(),
): ReservationResult {
  const current = inventory.find((item) => item.sku === request.sku);
  if (!current) throw new Error(`Unknown SKU: ${request.sku}`);
  const availableBefore = current.onHand - current.reserved - current.safetyStock;
  if (appliedRequestIds.has(request.requestId)) {
    return { inventory, status: "IDEMPOTENT_REPLAY", availableBefore, availableAfter: availableBefore, reason: "Request already applied; no duplicate reservation created", requestId: request.requestId };
  }
  if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
    return { inventory, status: "REJECTED", availableBefore, availableAfter: availableBefore, reason: "Quantity must be a positive integer", requestId: request.requestId };
  }
  if (request.expectedVersion !== undefined && request.expectedVersion !== current.version) {
    return { inventory, status: "REJECTED", availableBefore, availableAfter: availableBefore, reason: `Version conflict: expected ${request.expectedVersion}, current ${current.version}`, requestId: request.requestId };
  }
  if (request.quantity > availableBefore) {
    return { inventory, status: "REJECTED", availableBefore, availableAfter: availableBefore, reason: `Oversell prevented; only ${availableBefore} units are available above safety stock`, requestId: request.requestId };
  }
  const next = inventory.map((item) => item.sku === request.sku ? { ...item, reserved: item.reserved + request.quantity, version: item.version + 1, updatedAt: "2026-08-09T10:00:00.000Z" } : item);
  return { inventory: next, status: "RESERVED", availableBefore, availableAfter: availableBefore - request.quantity, reason: "Atomic reservation accepted", requestId: request.requestId };
}

export function inventoryHealth(item: InventoryItem): { available: number; projected: number; status: "HEALTHY" | "WATCH" | "SHORTAGE" } {
  const available = item.onHand - item.reserved;
  const projected = available + item.inProduction + item.inbound;
  const status = available < 0 ? "SHORTAGE" : available < item.safetyStock ? "WATCH" : "HEALTHY";
  return { available, projected, status };
}
