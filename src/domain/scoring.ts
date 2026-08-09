import type { Customer, DueDiligence, Lead, RiskTier } from "./types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function scoreLead(lead: Omit<Lead, "score" | "scoreReasons">): Pick<Lead, "score" | "scoreReasons"> {
  let score = 28;
  const reasons: string[] = [];
  const categoryFit = lead.productsWanted.filter((item) => ["Power Tools", "Hand Tools", "Safety", "Measuring Tools", "Storage", "Electrical"].includes(item)).length;
  score += categoryFit * 9;
  if (categoryFit >= 2) reasons.push("Multi-category portfolio fit");
  if (lead.employees >= 50 && lead.employees <= 300) {
    score += 13;
    reasons.push("Target operating scale");
  }
  if (/25M|50M|100M/.test(lead.revenueBand)) {
    score += 11;
    reasons.push("Qualified revenue band");
  }
  if (lead.channels.length >= 2) {
    score += 8;
    reasons.push("Diversified sales channels");
  }
  if (lead.certifications.length > 0) {
    score += 6;
    reasons.push("Compliance readiness signal");
  }
  if (lead.provenance.length >= 2) {
    score += 7;
    reasons.push("Multi-source corroboration");
  }
  if (lead.industry === "General Trading") {
    score -= 18;
    reasons.push("End-market clarity required");
  }
  return { score: clamp(score), scoreReasons: reasons };
}

export function riskTier(score: number, sanctions: DueDiligence["sanctionsScreen"]): RiskTier {
  if (sanctions === "BLOCKED") return "BLOCKED";
  if (sanctions === "POTENTIAL_MATCH" || score >= 60) return "HIGH";
  if (score >= 34) return "MEDIUM";
  return "LOW";
}

export function assessDueDiligence(input: {
  leadId: string;
  registration: DueDiligence["registration"];
  sanctionsScreen: DueDiligence["sanctionsScreen"];
  adverseMedia: DueDiligence["adverseMedia"];
  paymentRisk: number;
  domainAgeYears: number;
  evidenceCount: number;
}): { riskScore: number; tier: RiskTier; humanReviewRequired: boolean; flags: string[] } {
  let riskScore = input.paymentRisk * 0.45;
  const flags: string[] = [];
  if (input.registration !== "ACTIVE") {
    riskScore += 24;
    flags.push("Registration not confirmed active");
  }
  if (input.sanctionsScreen === "POTENTIAL_MATCH") {
    riskScore += 35;
    flags.push("Potential sanctions name match - not a confirmed match");
  }
  if (input.sanctionsScreen === "BLOCKED") {
    riskScore = 100;
    flags.push("Confirmed synthetic block fixture");
  }
  if (input.adverseMedia === "REVIEW") {
    riskScore += 16;
    flags.push("Adverse-media fixture needs review");
  }
  if (input.domainAgeYears < 2) {
    riskScore += 12;
    flags.push("Young domain footprint");
  }
  if (input.evidenceCount < 2) {
    riskScore += 15;
    flags.push("Insufficient independent evidence");
  }
  const rounded = clamp(Math.round(riskScore));
  const tier = riskTier(rounded, input.sanctionsScreen);
  return { riskScore: rounded, tier, humanReviewRequired: tier === "HIGH" || tier === "BLOCKED", flags };
}

export interface SimilarityResult {
  leadId: string;
  company: string;
  score: number;
  dimensions: { geography: number; industry: number; scale: number; channel: number; products: number };
  explanation: string[];
}

function overlap(a: string[], b: string[]): number {
  const left = new Set(a.map((item) => item.toLowerCase()));
  const union = new Set([...left, ...b.map((item) => item.toLowerCase())]);
  if (union.size === 0) return 0;
  const intersection = b.filter((item) => left.has(item.toLowerCase())).length;
  return intersection / union.size;
}

export function findSimilarCustomers(customer: Customer, candidates: Lead[]): SimilarityResult[] {
  return candidates
    .filter((lead) => lead.company !== customer.company)
    .map((lead) => {
      const geography = lead.country === customer.country ? 100 : lead.region === regionFor(customer.country) ? 78 : 38;
      const industry = lead.industry === customer.industry ? 100 : relatedIndustry(lead.industry, customer.industry) ? 72 : 28;
      const scale = clamp(100 - Math.abs(lead.employees - scaleAnchor(customer.segment)) / 2);
      const channel = customer.tags.some((tag) => lead.channels.join(" ").toLowerCase().includes(tag.toLowerCase())) ? 86 : 48;
      const products = Math.round(overlap(lead.productsWanted, customer.products) * 100);
      const score = Math.round(geography * 0.16 + industry * 0.24 + scale * 0.14 + channel * 0.16 + products * 0.3);
      const explanation = [
        products >= 50 ? "Strong product overlap" : "Adjacent product demand",
        industry >= 72 ? "Comparable buying context" : "Different industry context",
        geography >= 70 ? "Similar regional route-to-market" : "Geographic diversification",
      ];
      return { leadId: lead.id, company: lead.company, score, dimensions: { geography, industry, scale, channel, products }, explanation };
    })
    .sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
}

function regionFor(country: string): string {
  if (["Germany", "United Kingdom", "France", "Netherlands"].includes(country)) return "EU";
  if (["United Arab Emirates", "Türkiye", "Saudi Arabia"].includes(country)) return "Middle East";
  if (["Canada", "United States", "Mexico"].includes(country)) return "North America";
  if (["Chile", "Brazil", "Peru"].includes(country)) return "LATAM";
  return "Other";
}

function relatedIndustry(a: string, b: string): boolean {
  const cluster = new Set(["Industrial Distribution", "Hardware Wholesale", "Construction Supply", "Home Improvement Retail"]);
  return cluster.has(a) && cluster.has(b);
}

function scaleAnchor(segment: Customer["segment"]): number {
  return segment === "STRATEGIC" ? 160 : segment === "GROWTH" ? 80 : 40;
}
