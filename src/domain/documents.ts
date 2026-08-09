import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { customers, orders, products, quotes } from "./seed";
import { calculateQuote } from "./commerce";
import type { Customer, DocumentType, Product, QuoteInput, TradeOrder } from "./types";

export interface TradeDocumentSnapshot {
  order: TradeOrder;
  quote: QuoteInput;
  customer: Customer;
  products: Product[];
  synthetic: boolean;
}

const BRAND = rgb(0.08, 0.18, 0.25);
const ACCENT = rgb(0.03, 0.62, 0.47);
const MUTED = rgb(0.37, 0.43, 0.47);
const LIGHT = rgb(0.94, 0.96, 0.96);
const RED = rgb(0.75, 0.16, 0.2);

export const documentLabels: Record<DocumentType, string> = {
  quotation: "QUOTATION",
  "proforma-invoice": "PROFORMA INVOICE",
  "commercial-invoice": "COMMERCIAL INVOICE",
  "purchase-order": "PURCHASE ORDER",
  "packing-list": "PACKING LIST",
  "customs-draft": "CUSTOMS DECLARATION DRAFT",
  "origin-draft": "CERTIFICATE OF ORIGIN DRAFT",
  "shipping-update": "SHIPMENT PROGRESS REPORT",
};

const documentNumbers: Record<DocumentType, (order: TradeOrder) => string> = {
  quotation: (order) => order.quoteId,
  "proforma-invoice": (order) => `PI-${order.id.slice(3)}`,
  "commercial-invoice": (order) => `CI-${order.id.slice(3)}`,
  "purchase-order": (order) => order.poNumber,
  "packing-list": (order) => `PL-${order.id.slice(3)}`,
  "customs-draft": (order) => `CUS-${order.id.slice(3)}`,
  "origin-draft": (order) => `CO-${order.id.slice(3)}`,
  "shipping-update": (order) => `SR-${order.id.slice(3)}`,
};

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines;
}

function drawHeader(page: PDFPage, bold: PDFFont, regular: PDFFont, type: DocumentType, number: string, synthetic: boolean) {
  const { width, height } = page.getSize();
  const label = documentLabels[type];
  const labelSize = Math.min(13, 205 / bold.widthOfTextAtSize(label, 1));
  const labelWidth = bold.widthOfTextAtSize(label, labelSize);
  const labelX = width - 44 - labelWidth;
  page.drawRectangle({ x: 0, y: height - 116, width, height: 116, color: BRAND });
  page.drawText("MERIDIAN INDUSTRIAL EXPORTS", { x: 44, y: height - 54, size: 14.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText(synthetic ? "Synthetic demonstration exporter | Ningbo, China" : "Controlled trade-document workspace | Professional review required", { x: 44, y: height - 75, size: 9, font: regular, color: rgb(0.77, 0.86, 0.88) });
  page.drawText(label, { x: labelX, y: height - 54, size: labelSize, font: bold, color: rgb(1, 1, 1) });
  page.drawText(number, { x: labelX, y: height - 76, size: 10, font: regular, color: rgb(0.77, 0.86, 0.88) });
  page.drawText(synthetic ? "SYNTHETIC DEMO - NOT FOR FILING" : "CONTROLLED DRAFT - NOT FOR FILING", { x: synthetic ? 148 : 118, y: height / 2, size: 32, font: bold, color: rgb(0.92, 0.92, 0.92), rotate: degrees(38), opacity: 0.34 });
}

function drawFooter(page: PDFPage, regular: PDFFont, pageNumber: number) {
  page.drawLine({ start: { x: 44, y: 42 }, end: { x: 551, y: 42 }, thickness: 0.7, color: rgb(0.82, 0.85, 0.86) });
  page.drawText("Generated from fictional data. Requires customs, tax, legal and banking review before real use.", { x: 44, y: 26, size: 7.4, font: regular, color: MUTED });
  page.drawText(`Page ${pageNumber}`, { x: 518, y: 26, size: 7.4, font: regular, color: MUTED });
}

function drawPartyBlock(page: PDFPage, regular: PDFFont, bold: PDFFont, order: TradeOrder, customer: Customer, y: number) {
  page.drawText("EXPORTER", { x: 44, y, size: 8, font: bold, color: ACCENT });
  page.drawText("Meridian Industrial Exports (Synthetic)", { x: 44, y: y - 18, size: 10.5, font: bold, color: BRAND });
  page.drawText("88 Harbor Innovation Road, Ningbo, China", { x: 44, y: y - 34, size: 8.5, font: regular, color: MUTED });
  page.drawText("BUYER / CONSIGNEE", { x: 326, y, size: 8, font: bold, color: ACCENT });
  page.drawText(customer.company, { x: 326, y: y - 18, size: 10.5, font: bold, color: BRAND });
  page.drawText(`${order.destination} | ${customer.paymentTerms}`, { x: 326, y: y - 34, size: 8.2, font: regular, color: MUTED, maxWidth: 225 });
}

function drawSummary(page: PDFPage, regular: PDFFont, bold: PDFFont, order: TradeOrder, y: number) {
  const items = [
    ["Order", order.id], ["Incoterm", `${order.incoterm} 2020`], ["Currency", order.currency], ["Container", order.container],
    ["ETD", order.etd], ["ETA", order.eta], ["Destination", order.destination], ["Status", order.stage.replaceAll("_", " ")],
  ];
  page.drawRectangle({ x: 44, y: y - 61, width: 507, height: 68, color: LIGHT });
  items.forEach(([label, value], index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 56 + column * 124;
    const yy = y - row * 31;
    page.drawText(label.toUpperCase(), { x, y: yy, size: 6.8, font: bold, color: MUTED });
    page.drawText(value, { x, y: yy - 14, size: 8.5, font: regular, color: BRAND, maxWidth: 112 });
  });
}

function drawLineTable(page: PDFPage, regular: PDFFont, bold: PDFFont, quote: QuoteInput, catalog: Product[], y: number, packing = false) {
  const headers = packing ? ["SKU / DESCRIPTION", "QTY", "CARTONS", "NET KG", "GROSS KG"] : ["SKU / DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"];
  const widths = packing ? [230, 60, 70, 72, 75] : [275, 62, 84, 86];
  page.drawRectangle({ x: 44, y: y - 21, width: 507, height: 24, color: BRAND });
  let x = 52;
  headers.forEach((header, index) => {
    page.drawText(header, { x, y: y - 13, size: 7.3, font: bold, color: rgb(1, 1, 1) });
    x += widths[index];
  });
  let cursor = y - 45;
  quote.lines.forEach((line, index) => {
    const product = catalog.find((item) => item.sku === line.sku)!;
    if (index % 2 === 0) page.drawRectangle({ x: 44, y: cursor - 10, width: 507, height: 27, color: rgb(0.97, 0.98, 0.98) });
    page.drawText(`${line.sku} | ${product.name}`, { x: 52, y: cursor, size: 8, font: regular, color: BRAND, maxWidth: packing ? 220 : 265 });
    if (packing) {
      const cartons = Math.ceil(line.quantity / product.cartonQty);
      const net = line.quantity * product.weightKg;
      const gross = net * 1.08;
      page.drawText(String(line.quantity), { x: 282, y: cursor, size: 8, font: regular, color: BRAND });
      page.drawText(String(cartons), { x: 342, y: cursor, size: 8, font: regular, color: BRAND });
      page.drawText(net.toFixed(1), { x: 412, y: cursor, size: 8, font: regular, color: BRAND });
      page.drawText(gross.toFixed(1), { x: 484, y: cursor, size: 8, font: regular, color: BRAND });
    } else {
      page.drawText(String(line.quantity), { x: 327, y: cursor, size: 8, font: regular, color: BRAND });
      page.drawText(money(line.unitPrice, quote.currency), { x: 389, y: cursor, size: 8, font: regular, color: BRAND });
      page.drawText(money(line.quantity * line.unitPrice, quote.currency), { x: 473, y: cursor, size: 8, font: regular, color: BRAND });
    }
    cursor -= 28;
  });
  return cursor;
}

function drawTotals(page: PDFPage, regular: PDFFont, bold: PDFFont, quote: QuoteInput, y: number) {
  const result = calculateQuote(quote);
  const rows = [
    ["Goods value", result.goodsUsd],
    ["Freight included", result.freightUsd],
    ["Insurance included", result.insuranceUsd],
    ["Duty assumption", result.dutyUsd],
    ["TOTAL", result.customerTotal],
  ] as const;
  rows.forEach(([label, value], index) => {
    const yy = y - index * 18;
    const isTotal = label === "TOTAL";
    page.drawText(label, { x: 380, y: yy, size: isTotal ? 10 : 8, font: isTotal ? bold : regular, color: isTotal ? BRAND : MUTED });
    page.drawText(isTotal ? money(value, quote.currency) : money(value * quote.exchangeRates[quote.currency], quote.currency), { x: 468, y: yy, size: isTotal ? 10 : 8, font: isTotal ? bold : regular, color: isTotal ? ACCENT : BRAND });
  });
  page.drawText(`Margin policy: ${result.guardrail} | Validity: 14 days | Payment subject to final approval`, { x: 44, y: y - 80, size: 8, font: regular, color: result.guardrail === "BLOCK" ? RED : MUTED });
}

function drawCustoms(page: PDFPage, regular: PDFFont, bold: PDFFont, quote: QuoteInput, order: TradeOrder, catalog: Product[], y: number) {
  const rows = quote.lines.map((line) => {
    const product = catalog.find((item) => item.sku === line.sku)!;
    return [product.hsCode, product.name, "CN", String(line.quantity), (line.quantity * product.weightKg).toFixed(1), money(line.quantity * line.unitPrice, quote.currency)];
  });
  const headers = ["HS CODE", "DESCRIPTION", "ORIGIN", "QTY", "NET KG", "VALUE"];
  const widths = [65, 188, 52, 45, 60, 85];
  page.drawRectangle({ x: 44, y: y - 21, width: 507, height: 24, color: BRAND });
  let x = 51;
  headers.forEach((header, index) => { page.drawText(header, { x, y: y - 13, size: 6.8, font: bold, color: rgb(1, 1, 1) }); x += widths[index]; });
  rows.forEach((row, rowIndex) => {
    let xx = 51;
    const yy = y - 45 - rowIndex * 31;
    if (rowIndex % 2 === 0) page.drawRectangle({ x: 44, y: yy - 10, width: 507, height: 28, color: LIGHT });
    row.forEach((value, index) => { page.drawText(value, { x: xx, y: yy, size: 7.2, font: regular, color: BRAND, maxWidth: widths[index] - 6 }); xx += widths[index]; });
  });
  page.drawText(`Port of loading: Ningbo, China | Port of discharge: ${order.destination} | Export mode: Synthetic test only`, { x: 44, y: y - 160, size: 8, font: regular, color: MUTED });
  page.drawText("DECLARATION STATUS: DRAFT. An authorized customs broker must verify classification, origin, value and filing data.", { x: 44, y: y - 184, size: 8.2, font: bold, color: RED, maxWidth: 500 });
}

function drawOrigin(page: PDFPage, regular: PDFFont, bold: PDFFont, quote: QuoteInput, order: TradeOrder, customer: Customer, y: number) {
  const fields = [
    ["Exporter", "Meridian Industrial Exports (Synthetic), Ningbo, China"],
    ["Consignee", `${customer.company}, ${order.destination}`],
    ["Means of transport", `${order.container}; synthetic ocean fixture`],
    ["Country of origin", "China (fixture; supplier declarations not attached)"],
    ["Destination", order.destination],
    ["Goods", quote.lines.map((line) => `${line.sku} x ${line.quantity}`).join("; ")],
  ];
  fields.forEach(([label, value], index) => {
    const yy = y - index * 52;
    page.drawText(label.toUpperCase(), { x: 44, y: yy, size: 7.2, font: bold, color: ACCENT });
    wrap(value, 82).slice(0, 2).forEach((line, lineIndex) => page.drawText(line, { x: 44, y: yy - 17 - lineIndex * 12, size: 9, font: regular, color: BRAND }));
    page.drawLine({ start: { x: 44, y: yy - 35 }, end: { x: 551, y: yy - 35 }, thickness: 0.5, color: rgb(0.84, 0.87, 0.88) });
  });
  page.drawText("DRAFT ONLY - Chamber certification and preferential-origin rules are outside this demonstration.", { x: 44, y: y - 328, size: 9, font: bold, color: RED, maxWidth: 500 });
}

function drawShippingUpdate(page: PDFPage, regular: PDFFont, bold: PDFFont, order: TradeOrder, y: number) {
  page.drawText(`Current status: ${order.stage.replaceAll("_", " ")}`, { x: 44, y, size: 14, font: bold, color: ACCENT });
  page.drawText(`ETD ${order.etd} | ETA ${order.eta} | ${order.container} | ${order.destination}`, { x: 44, y: y - 21, size: 9, font: regular, color: MUTED });
  let cursor = y - 62;
  order.milestones.forEach((milestone, index) => {
    const color = milestone.status === "DONE" ? ACCENT : milestone.status === "CURRENT" ? rgb(0.92, 0.55, 0.09) : rgb(0.75, 0.78, 0.79);
    page.drawCircle({ x: 54, y: cursor + 3, size: 5, color });
    if (index < order.milestones.length - 1) page.drawLine({ start: { x: 54, y: cursor - 5 }, end: { x: 54, y: cursor - 34 }, thickness: 1.2, color: rgb(0.84, 0.87, 0.88) });
    page.drawText(milestone.label, { x: 72, y: cursor, size: 9.5, font: bold, color: BRAND });
    page.drawText(`${milestone.status} | planned ${milestone.plannedAt} | ${milestone.owner}`, { x: 275, y: cursor, size: 7.6, font: regular, color: MUTED });
    page.drawText(milestone.customerMessage, { x: 72, y: cursor - 16, size: 8, font: regular, color: MUTED, maxWidth: 465 });
    cursor -= 48;
  });
}

export async function generateTradeDocument(type: DocumentType, orderId = "SO-260731"): Promise<Uint8Array> {
  const order = orders.find((item) => item.id === orderId);
  if (!order) throw new Error(`Unknown order: ${orderId}`);
  const quote = quotes.find((item) => item.id === order.quoteId) ?? quotes[0];
  const customer = customers.find((item) => item.id === order.customerId) ?? customers[0];
  return generateTradeDocumentFromSnapshot(type, { order, quote, customer, products, synthetic: true });
}

export async function generateTradeDocumentFromSnapshot(type: DocumentType, snapshot: TradeDocumentSnapshot): Promise<Uint8Array> {
  const { order, quote, customer, products: catalog, synthetic } = snapshot;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${documentLabels[type]} ${documentNumbers[type](order)}`);
  pdf.setAuthor("MERIDIAN 10 Autonomous Trade OS");
  pdf.setSubject("Synthetic demonstration trade document - not for filing");
  pdf.setKeywords(["synthetic", "demo", "foreign trade", type]);
  pdf.setCreationDate(new Date("2026-08-09T09:30:00.000Z"));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(1, 1, 1) });
  drawHeader(page, bold, regular, type, documentNumbers[type](order), synthetic);
  drawPartyBlock(page, regular, bold, order, customer, 690);
  drawSummary(page, regular, bold, order, 612);

  if (type === "packing-list") {
    const cursor = drawLineTable(page, regular, bold, quote, catalog, 515, true);
    page.drawText("Packaging declaration", { x: 44, y: cursor - 12, size: 9, font: bold, color: ACCENT });
    page.drawText("Export cartons on heat-treated synthetic pallets. Final weights require warehouse scale tickets.", { x: 44, y: cursor - 30, size: 8.2, font: regular, color: MUTED });
  } else if (type === "customs-draft") {
    drawCustoms(page, regular, bold, quote, order, catalog, 515);
  } else if (type === "origin-draft") {
    drawOrigin(page, regular, bold, quote, order, customer, 515);
  } else if (type === "shipping-update") {
    drawShippingUpdate(page, regular, bold, order, 515);
  } else {
    const cursor = drawLineTable(page, regular, bold, quote, catalog, 515);
    drawTotals(page, regular, bold, quote, cursor - 10);
    const label = type === "purchase-order" ? "PURCHASE CONDITIONS" : "COMMERCIAL TERMS";
    page.drawText(label, { x: 44, y: cursor - 18, size: 8, font: bold, color: ACCENT });
    page.drawText(`${order.incoterm} Incoterms 2020. Shipment dates are conditional on artwork, deposit and final quality release.`, { x: 44, y: cursor - 36, size: 8, font: regular, color: MUTED, maxWidth: 310 });
  }
  drawFooter(page, regular, 1);
  return pdf.save({ useObjectStreams: false });
}

export function isDocumentType(value: string): value is DocumentType {
  return Object.hasOwn(documentLabels, value);
}
