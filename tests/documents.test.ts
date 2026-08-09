import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { documentLabels, generateTradeDocument, isDocumentType } from "@/domain/documents";
import type { DocumentType } from "@/domain/types";

const types = Object.keys(documentLabels) as DocumentType[];

describe("trade document factory", () => {
  it.each(types)("generates a valid %s PDF", async (type) => {
    const bytes = await generateTradeDocument(type, "SO-260731");
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(2_500);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getTitle()).toContain(documentLabels[type]);
    expect(parsed.getSubject()).toMatch(/not for filing/i);
  });

  it.each(types)("recognizes supported document type %s", (type) => {
    expect(isDocumentType(type)).toBe(true);
  });

  it.each(["invoice", "passport", "", "../secret"])("rejects unsupported type %s", (type) => {
    expect(isDocumentType(type)).toBe(false);
  });

  it("falls back to a known fixture order without failing", async () => {
    const bytes = await generateTradeDocument("quotation", "SO-MISSING");
    expect(bytes.byteLength).toBeGreaterThan(2_500);
  });
});
