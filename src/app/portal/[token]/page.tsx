import type { Metadata } from "next";
import Link from "next/link";
import { customers, orders } from "@/domain/seed";

export const metadata: Metadata = {
  title: "Customer Shipment Portal",
  description: "Synthetic customer-safe shipment progress preview.",
  robots: { index: false, follow: false },
};

export default async function CustomerPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = token === "demo-nordwerk";
  const order = orders[0];
  const customer = customers.find((item) => item.id === order.customerId)!;
  if (!valid) return <main className="portal-page"><div className="portal-main"><section className="portal-welcome"><div className="eyebrow">ACCESS EXPIRED</div><h1>此演示链接无效</h1><p>客户门户令牌已被拒绝。请返回 MERIDIAN 10 演示主页。</p><Link className="primary center" href="/" style={{ width: 160, marginTop: 20 }}>返回操作系统</Link></section></div></main>;
  return <main className="portal-page" data-testid="customer-portal"><header className="portal-header"><div className="portal-brand"><span>M</span><div><strong>MERIDIAN EXPORTS</strong><small>SECURE CUSTOMER PORTAL · SYNTHETIC DEMO</small></div></div><span className="status-pill good">COST-REDACTED VIEW</span></header><div className="portal-main"><section className="portal-welcome"><div className="eyebrow">WELCOME, NORDWERK TEAM</div><h1>Your order is progressing on plan.</h1><p>Last synthetic update: 09 Aug 2026, 10:30 UTC · This portal contains no supplier cost, internal margin or compliance notes.</p></section><section className="portal-summary"><div><span>ORDER</span><strong>{order.id}</strong></div><div><span>STATUS</span><strong>{order.stage.replaceAll("_", " ")}</strong></div><div><span>ETD</span><strong>{order.etd}</strong></div><div><span>ETA</span><strong>{order.eta}</strong></div></section><section className="portal-timeline"><h2>Shipment milestones</h2>{order.milestones.map((item) => <article className={item.status.toLowerCase()} key={item.id}><span className="milestone-dot" /><div><h3>{item.label}</h3><p>{item.customerMessage} {item.evidence}</p></div><span className={`status-pill ${item.status === "DONE" ? "good" : item.status === "CURRENT" ? "warn" : "neutral"}`}>{item.status}</span></article>)}</section><div className="portal-safe-note">Customer view for {customer.company}. All data is fictional and no real shipment exists.</div><Link className="secondary center" href="/">Return to MERIDIAN 10 operator demo</Link></div></main>;
}
