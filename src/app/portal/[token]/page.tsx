import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDatabase } from "@/db/client";
import { customers, orders } from "@/domain/seed";
import { getRuntimeConfig } from "@/server/config";
import { getPortalSnapshot, type PortalSnapshot } from "@/server/services/portal";

export const metadata: Metadata = {
  title: "Customer Shipment Portal",
  description: "Token-scoped, cost-redacted customer shipment progress.",
  robots: { index: false, follow: false },
};

export const revalidate = 0;

function fixtureSnapshot(token: string): PortalSnapshot | null {
  if (token !== "demo-nordwerk") return null;
  const order = orders[0];
  const customer = customers.find((item) => item.id === order.customerId)!;
  return {
    grantId: "fixture-demo-nordwerk",
    company: customer.company,
    orderId: order.id,
    stage: order.stage,
    destination: order.destination,
    estimatedDeparture: order.etd,
    estimatedArrival: order.eta,
    container: order.container,
    milestones: order.milestones.map((milestone) => ({
      id: milestone.id,
      label: milestone.label,
      status: milestone.status,
      plannedAt: milestone.plannedAt,
      actualAt: milestone.actualAt ?? null,
      owner: milestone.owner,
      evidence: { summary: milestone.evidence, synthetic: true },
      customerMessage: milestone.customerMessage,
    })),
  };
}

async function loadSnapshot(token: string) {
  const config = getRuntimeConfig();
  if (config.dataMode === "fixture") return { snapshot: fixtureSnapshot(token), fixture: true };
  const database = getDatabase();
  return { snapshot: await getPortalSnapshot((query) => database.execute(query), token), fixture: false };
}

const dateOnly = (value: string | null) => value?.slice(0, 10) ?? "Pending";

export default async function CustomerPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { snapshot, fixture } = await loadSnapshot(token);
  if (!snapshot) notFound();

  return (
    <main className="portal-page" data-testid="customer-portal">
      <header className="portal-header">
        <div className="portal-brand"><span>M</span><div><strong>MERIDIAN EXPORTS</strong><small>SECURE CUSTOMER PORTAL{fixture ? " · SYNTHETIC DEMO" : ""}</small></div></div>
        <span className="status-pill good">COST-REDACTED VIEW</span>
      </header>
      <div className="portal-main">
        <section className="portal-welcome">
          <div className="eyebrow">WELCOME, {snapshot.company.toUpperCase()}</div>
          <h1>Your order is progressing on plan.</h1>
          <p>This token only exposes customer-safe shipment milestones. Supplier cost, internal margin, screening notes and other organizations are never included.</p>
        </section>
        <section className="portal-summary">
          <div><span>ORDER</span><strong>{snapshot.orderId}</strong></div>
          <div><span>STATUS</span><strong>{snapshot.stage.replaceAll("_", " ")}</strong></div>
          <div><span>ETD</span><strong>{dateOnly(snapshot.estimatedDeparture)}</strong></div>
          <div><span>ETA</span><strong>{dateOnly(snapshot.estimatedArrival)}</strong></div>
        </section>
        <section className="portal-timeline">
          <h2>Shipment milestones</h2>
          {snapshot.milestones.map((item) => (
            <article className={item.status.toLowerCase()} key={item.id}>
              <span className="milestone-dot" />
              <div><h3>{item.label}</h3><p>{item.customerMessage} {typeof item.evidence.summary === "string" ? item.evidence.summary : ""}</p></div>
              <span className={`status-pill ${item.status === "DONE" ? "good" : item.status === "CURRENT" ? "warn" : "neutral"}`}>{item.status}</span>
            </article>
          ))}
        </section>
        <div className="portal-safe-note">Customer view for {snapshot.company}. Destination: {snapshot.destination}. {fixture ? "All data is fictional and no real shipment exists." : "Access is token-scoped and expires automatically."}</div>
        <Link className="secondary center" href="/">Return to MERIDIAN 10 operator workspace</Link>
      </div>
    </main>
  );
}
