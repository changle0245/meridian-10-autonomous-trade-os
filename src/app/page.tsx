import TradeOS from "@/components/trade-os";
import { getDatabase } from "@/db/client";
import { getRequestContext } from "@/server/auth/context";
import { getRuntimeConfig } from "@/server/config";
import { getSharedWorkspaceProjection } from "@/server/services/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = getRuntimeConfig();
  if (config.dataMode === "fixture") return <TradeOS runtimeMode="fixture" auditLinked />;

  const context = await getRequestContext();
  const projection = await getSharedWorkspaceProjection(getDatabase(), context);
  const operational = projection.state.customers.length > 0
    && projection.state.quotes.length > 0
    && projection.state.orders.length > 0
    && projection.state.products.length > 0
    && projection.state.inventory.length > 0;

  if (!operational) {
    return (
      <main className="portal-page">
        <header className="portal-header"><div className="portal-brand"><span>M</span><div><strong>MERIDIAN 10</strong><small>SHARED DATABASE MODE</small></div></div><span className="status-pill good">CONNECTED</span></header>
        <div className="portal-main">
          <section className="portal-welcome">
            <div className="eyebrow">ORGANIZATION PROVISIONED</div>
            <h1>共享底座已就绪，当前组织尚无完整业务数据。</h1>
            <p>身份、租户隔离、迁移、审计、Inbox/Outbox、幂等事务和订单接入 API 均已启用。系统不会用虚构浏览器数据冒充该组织的真实记录。</p>
          </section>
          <section className="portal-summary">
            <div><span>LEADS</span><strong>{projection.state.leads.length}</strong></div>
            <div><span>CUSTOMERS</span><strong>{projection.state.customers.length}</strong></div>
            <div><span>ORDERS</span><strong>{projection.state.orders.length}</strong></div>
            <div><span>AUDIT LINKS</span><strong>{projection.auditLinked ? "VALID" : "REVIEW"}</strong></div>
          </section>
          <div className="portal-safe-note">Use the authenticated order-intake API or the deterministic seed command to create the first complete data thread. No external message, payment, purchase, or filing will be executed.</div>
        </div>
      </main>
    );
  }

  return <TradeOS initialState={projection.state} runtimeMode="database" auditLinked={projection.auditLinked} />;
}
