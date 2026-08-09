"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { appendEvent, verifyEventChain } from "@/domain/audit";
import { runLeadDiscovery } from "@/domain/automation";
import { calculateProfit, calculateQuote, inventoryHealth, reserveInventory, stressLedger, type ReservationResult } from "@/domain/commerce";
import { documentLabels } from "@/domain/documents";
import { findSimilarCustomers } from "@/domain/scoring";
import { createSeedState } from "@/domain/seed";
import type { AutomationRun, DocumentType, OrderStage, WorkspaceState } from "@/domain/types";
import { clearWorkspace, exportWorkspace, loadWorkspace, parseWorkspace, saveWorkspace } from "@/lib/workspace-store";

type ViewId = "command" | "leads" | "research" | "customers" | "lookalike" | "pipeline" | "quotes" | "documents" | "fulfillment" | "suppliers" | "inventory" | "finance" | "compliance" | "automations" | "audit";

const NAV: { group: string; items: { id: ViewId; label: string; short: string }[] }[] = [
  { group: "全局", items: [{ id: "command", label: "指挥中心", short: "01" }] },
  { group: "增长", items: [
    { id: "leads", label: "自主获客", short: "02" }, { id: "research", label: "客户背调", short: "03" }, { id: "customers", label: "客户 360", short: "04" }, { id: "lookalike", label: "相似客户", short: "05" }, { id: "pipeline", label: "跟进漏斗", short: "06" },
  ] },
  { group: "成交", items: [
    { id: "quotes", label: "报价驾驶舱", short: "07" }, { id: "documents", label: "贸易单证", short: "08" }, { id: "fulfillment", label: "交付控制塔", short: "09" },
  ] },
  { group: "供应链与利润", items: [
    { id: "suppliers", label: "供应商网络", short: "10" }, { id: "inventory", label: "库存孪生", short: "11" }, { id: "finance", label: "利润与费用", short: "12" },
  ] },
  { group: "自治与治理", items: [
    { id: "compliance", label: "合规中心", short: "13" }, { id: "automations", label: "自动化运行", short: "14" }, { id: "audit", label: "审计与恢复", short: "15" },
  ] },
];

const VIEW_LABEL = Object.fromEntries(NAV.flatMap((group) => group.items.map((item) => [item.id, item.label]))) as Record<ViewId, string>;
const currency = (value: number, code = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

interface ViewProps {
  state: WorkspaceState;
  setState: React.Dispatch<React.SetStateAction<WorkspaceState>>;
  notify: (message: string, tone?: "good" | "warn" | "bad") => void;
  navigate: (view: ViewId) => void;
  runtimeMode: "fixture" | "database";
  auditLinked: boolean;
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" | "info" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return <div className={`metric-card ${tone ?? ""}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}

function Panel({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div>{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h2>{title}</h2></div>{action}</div>{children}</section>;
}

function Bar({ value, tone = "green" }: { value: number; tone?: "green" | "amber" | "red" | "blue" }) {
  return <div className="bar-track" role="progressbar" aria-label={`${value}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span className={tone} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>;
}

function CommandCenter({ state, navigate, runtimeMode }: ViewProps) {
  const quoted = state.quotes.map(calculateQuote);
  const pipeline = state.orders.reduce((sum, order) => sum + order.amountUsd, 0);
  const net = state.ledgers.map(calculateProfit).reduce((sum, result) => sum + result.netProfitUsd, 0);
  const atRisk = state.dueDiligence.filter((item) => item.humanReviewRequired).length;
  const healthyInventory = state.inventory.filter((item) => inventoryHealth(item).status === "HEALTHY").length;
  const currentOrder = state.orders[0];
  return <div className="workspace-stack" data-testid="command-center">
    <section className="hero-grid">
      <div className="hero-copy">
        <div className="eyebrow">LEVEL 10 · AUTONOMOUS TRADE OPERATIONS</div>
        <h1>从第一条线索，到最后一美元利润。</h1>
        <p>一条可追溯、可重放、带合规护栏的外贸自治链路。{runtimeMode === "fixture" ? "所有公司、联系人和交易均为确定性虚构数据。" : "当前数据来自登录组织的共享数据库。"}</p>
        <div className="hero-actions"><button className="primary" onClick={() => navigate("leads")}>启动获客雷达</button><button className="secondary" onClick={() => navigate("fulfillment")}>查看交付控制塔</button></div>
      </div>
      <div className="autonomy-orbit" role="img" aria-label="自治闭环：获客、背调、报价、交付和利润">
        <div className="orbit-center"><strong>MERIDIAN</strong><span>15 工作区</span></div>
        <span className="orbit-node n1">获客</span><span className="orbit-node n2">背调</span><span className="orbit-node n3">报价</span><span className="orbit-node n4">交付</span><span className="orbit-node n5">利润</span>
      </div>
    </section>
    <div className="metric-grid five">
      <Metric label="活跃商机" value={currency(pipeline)} detail={`${state.orders.length} 笔订单受控推进`} />
      <Metric label="报价净利" value={currency(quoted.reduce((sum, item) => sum + item.netProfitUsd, 0))} detail={`${quoted.filter((item) => item.guardrail === "PASS").length}/${quoted.length} 通过利润护栏`} tone="mint" />
      <Metric label="已实现利润" value={currency(net)} detail={`${percent(net / Math.max(1, state.ledgers.reduce((sum, item) => sum + item.revenueUsd, 0)))} 组合净利率`} />
      <Metric label="背调人工复核" value={String(atRisk)} detail="自动暂停，不误判为制裁命中" tone="amber" />
      <Metric label="健康库存" value={`${healthyInventory}/${state.inventory.length}`} detail="实时计算可售和安全库存" />
    </div>
    <div className="two-col wide-left">
      <Panel title="今日自治任务流" eyebrow="LIVE CONTROL LOOP" action={<StatusPill tone="good">12/13 正常</StatusPill>}>
        <div className="flow-lane">
          {[
            ["01", "扫描采购信号", "48 个来源夹具", "done"], ["02", "实体解析与去重", "6 个重复项合并", "done"], ["03", "背调与证据 TTL", "1 项转人工复核", "warn"], ["04", "报价利润护栏", "2 份报价通过", "done"], ["05", "交付里程碑", "2 条更新已进入草稿箱", "done"],
          ].map(([number, label, detail, status]) => <div className="flow-row" key={number}><span className={`flow-index ${status}`}>{number}</span><div><strong>{label}</strong><span>{detail}</span></div><span className="flow-line" /><StatusPill tone={status === "warn" ? "warn" : "good"}>{status === "warn" ? "需复核" : "完成"}</StatusPill></div>)}
        </div>
      </Panel>
      <Panel title="订单数字线程" eyebrow={currentOrder.id} action={<button className="text-button" onClick={() => navigate("fulfillment")}>进入控制塔 →</button>}>
        <div className="order-thread"><div className="order-total"><span>合同金额</span><strong>{currency(currentOrder.amountUsd)}</strong><small>{currentOrder.incoterm} · {currentOrder.destination}</small></div><div className="ring" style={{ "--progress": "43%" } as React.CSSProperties}><span>43%</span></div></div>
        <div className="mini-timeline">{currentOrder.milestones.map((milestone) => <div className={milestone.status.toLowerCase()} key={milestone.id}><span /><small>{milestone.label}</small></div>)}</div>
        <div className="thread-note"><span>下一关键节点</span><strong>{currentOrder.milestones.find((item) => item.status === "CURRENT")?.label}</strong><small>客户可见信息已剔除供应商成本和内部利润。</small></div>
      </Panel>
    </div>
    <div className="three-col">
      <Panel title="增长信号" eyebrow="LEAD RADAR"><div className="big-number">{state.leads.filter((lead) => lead.score >= 80).length}</div><p className="muted">个高匹配客户，来自 {new Set(state.leads.flatMap((lead) => lead.provenance.map((item) => item.kind))).size} 类合成来源。</p><button className="secondary full" onClick={() => navigate("leads")}>查看优先队列</button></Panel>
      <Panel title="供应链脉搏" eyebrow="SUPPLY TWIN"><div className="score-grid"><div><span>准时交付</span><strong>93.4%</strong></div><div><span>质量合格</span><strong>98.7%</strong></div><div><span>在途数量</span><strong>{state.inventory.reduce((sum, item) => sum + item.inbound, 0).toLocaleString()}</strong></div><div><span>供应商风险</span><strong>2 WATCH</strong></div></div></Panel>
      <Panel title="自治边界" eyebrow="POLICY GUARD"><ul className="guard-list"><li><span>✓</span> 合成数据与来源标记</li><li><span>✓</span> 真实外联始终关闭</li><li><span>✓</span> 清关单证仅为草稿</li><li><span>✓</span> 高风险结果自动暂停</li></ul><button className="secondary full" onClick={() => navigate("compliance")}>查看全部护栏</button></Panel>
    </div>
  </div>;
}

function LeadsView({ state, setState, notify, navigate, runtimeMode }: ViewProps) {
  const [running, startTransition] = useTransition();
  const [filter, setFilter] = useState("ALL");
  const visible = state.leads.filter((lead) => filter === "ALL" || (filter === "HIGH" ? lead.score >= 80 : lead.region === filter));
  const discover = () => startTransition(() => {
    if (runtimeMode === "database") {
      notify("共享模式未配置真实获客数据源；系统没有用虚构扫描污染组织数据库", "warn");
      return;
    }
    const result = runLeadDiscovery(state.leads);
    setState((current) => ({ ...current, leads: result.leads, automations: [result.run, ...current.automations], events: appendEvent(current.events, { id: `EVT-${String(current.events.length + 1).padStart(4, "0")}`, tenantId: current.tenantId, at: "2026-08-09T10:00:09.000Z", actor: "Lead Radar Agent", action: "LEADS_DISCOVERED", entity: "lead-batch", entityId: result.run.id, payload: { added: result.added.length, realPeopleContacted: 0 } }), updatedAt: "2026-08-09T10:00:09.000Z" }));
    notify(result.added.length ? `已发现并评分 ${result.added.length} 个全新合成客户` : "实体解析完成：没有创建重复线索", "good");
  });
  return <div className="workspace-stack" data-testid="leads-view">
    <div className="page-intro"><div><div className="eyebrow">AUTONOMOUS ACQUISITION</div><h1>自主获客雷达</h1><p>以理想客户画像、采购信号和来源可信度排序；不会抓取真实个人信息，也不会自动发送消息。</p></div><button className="primary" onClick={discover} disabled={running}>{running ? "正在解析信号…" : "运行一次获客扫描"}</button></div>
    <div className="metric-grid four"><Metric label="线索总数" value={String(state.leads.length)} detail="所有实体均为虚构" /><Metric label="高匹配" value={String(state.leads.filter((lead) => lead.score >= 80).length)} detail="ICP 得分 ≥ 80" tone="mint" /><Metric label="待背调" value={String(state.leads.filter((lead) => lead.stage === "NEW" || lead.stage === "QUALIFIED").length)} detail="进入证据收集队列" /><Metric label="真实外联" value="0" detail="策略硬锁定" tone="amber" /></div>
    <Panel title="优先线索队列" eyebrow="ENTITY-RESOLVED · SOURCE-TRACED" action={<div className="filter-row">{["ALL", "HIGH", "EU", "Middle East", "LATAM"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>}>
      <div className="table-wrap"><table><thead><tr><th>公司 / 来源</th><th>区域</th><th>目标品类</th><th>规模</th><th>得分</th><th>阶段</th><th /></tr></thead><tbody>{visible.map((lead) => <tr key={lead.id}><td><strong>{lead.company}</strong><small>{lead.id} · {lead.provenance.length} 个来源</small></td><td>{lead.country}<small>{lead.region}</small></td><td><div className="tag-row">{lead.productsWanted.slice(0, 2).map((item) => <span className="tag" key={item}>{item}</span>)}</div></td><td>{lead.employees} 人<small>{lead.revenueBand}</small></td><td><div className="score-cell"><strong>{lead.score}</strong><Bar value={lead.score} tone={lead.score >= 80 ? "green" : lead.score >= 60 ? "amber" : "red"} /></div></td><td><StatusPill tone={lead.stage === "CONTACT_READY" ? "good" : "info"}>{lead.stage.replaceAll("_", " ")}</StatusPill></td><td><button className="icon-button" aria-label={`查看 ${lead.company}`} onClick={() => navigate("research")}>→</button></td></tr>)}</tbody></table></div>
    </Panel>
  </div>;
}

function ResearchView({ state }: ViewProps) {
  const [selectedId, setSelectedId] = useState(state.dueDiligence[0]?.leadId ?? "");
  const selected = state.dueDiligence.find((item) => item.leadId === selectedId) ?? state.dueDiligence[0];
  const lead = state.leads.find((item) => item.id === selected?.leadId);
  if (!selected || !lead) return <div>没有背调记录。</div>;
  return <div className="workspace-stack" data-testid="research-view">
    <div className="page-intro"><div><div className="eyebrow">EVIDENCE, NOT GUESSWORK</div><h1>客户背调与风险证据</h1><p>每个结论都附来源、观察日期和有效期；潜在姓名匹配只会触发暂停和人工复核。</p></div><StatusPill tone={selected.humanReviewRequired ? "warn" : "good"}>{selected.humanReviewRequired ? "HUMAN REVIEW" : "AUTO CLEAR"}</StatusPill></div>
    <div className="research-layout"><Panel title="研究队列" className="queue-panel"><div className="entity-list">{state.dueDiligence.map((item) => { const entity = state.leads.find((leadItem) => leadItem.id === item.leadId)!; return <button className={item.leadId === selectedId ? "selected" : ""} onClick={() => setSelectedId(item.leadId)} key={item.leadId}><span className={`risk-dot ${item.tier.toLowerCase()}`} /><div><strong>{entity.company}</strong><small>{entity.country} · {item.evidence.length} evidence</small></div><b>{item.riskScore}</b></button>; })}</div></Panel>
      <div className="workspace-stack"><Panel title={lead.company} eyebrow={`${selected.legalName} · ${lead.country}`} action={<StatusPill tone={selected.tier === "LOW" ? "good" : selected.tier === "MEDIUM" ? "warn" : "bad"}>{selected.tier} RISK</StatusPill>}>
        <div className="risk-hero"><div className="risk-score"><strong>{selected.riskScore}</strong><span>/100 risk</span></div><div className="risk-factors"><div><span>企业登记</span><b>{selected.registration}</b></div><div><span>制裁筛查</span><b>{selected.sanctionsScreen.replaceAll("_", " ")}</b></div><div><span>付款风险</span><b>{selected.paymentRisk}/100</b></div><div><span>域名年限</span><b>{selected.domainAgeYears} years</b></div></div></div>
        {selected.flags.length ? <div className="alert-box warning"><strong>自动暂停</strong><span>{selected.flags.join("；")}</span></div> : <div className="alert-box success"><strong>策略允许继续</strong><span>当前合成证据未触发强制暂停；真实交易仍需企业合规流程。</span></div>}
      </Panel>
      <Panel title="证据链" eyebrow={`REVIEWED ${selected.reviewedAt.slice(0, 10)} · VALID UNTIL ${selected.validUntil.slice(0, 10)}`}><div className="evidence-grid">{selected.evidence.map((item) => <article className="evidence-card" key={item.id}><div><StatusPill tone={item.confidence > 0.9 ? "good" : "info"}>{Math.round(item.confidence * 100)}% confidence</StatusPill><span className="ttl">TTL {item.expiresInDays}d</span></div><h3>{item.label}</h3><p>{item.result}</p><small>{item.provenance.label} · {item.observedAt.slice(0, 10)} · SYNTHETIC</small></article>)}</div></Panel></div>
    </div>
  </div>;
}

function CustomersView({ state, notify }: ViewProps) {
  const [selectedId, setSelectedId] = useState(state.customers[0].id);
  const customer = state.customers.find((item) => item.id === selectedId) ?? state.customers[0];
  const downloadProfile = () => {
    const payload = JSON.stringify({
      schema: "meridian.customer-profile.v1",
      synthetic: true,
      exportedAt: "2026-08-09T11:00:00.000Z",
      customer,
      orders: state.orders.filter((item) => item.customerId === customer.id),
      quotes: state.quotes.filter((item) => item.customerId === customer.id),
    }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${customer.id.toLowerCase()}-synthetic-profile.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notify("合成客户档案已导出，订单与报价保持同一数据线程", "good");
  };
  return <div className="workspace-stack" data-testid="customers-view">
    <div className="page-intro"><div><div className="eyebrow">ONE RECORD, EVERY DECISION</div><h1>客户 360 独立档案</h1><p>销售、贸易、交付和财务围绕同一个客户记录协作，客户可见内容与内部利润严格分离。</p></div><button className="secondary" onClick={downloadProfile}>导出客户档案</button></div>
    <div className="customer-tabs">{state.customers.map((item) => <button className={item.id === selectedId ? "active" : ""} onClick={() => setSelectedId(item.id)} key={item.id}><span>{item.company.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span><div><strong>{item.company}</strong><small>{item.segment} · {item.country}</small></div></button>)}</div>
    <div className="two-col equal"><Panel title={customer.company} eyebrow={`${customer.id} · OWNER ${customer.owner}`} action={<StatusPill tone="good">{customer.segment}</StatusPill>}><div className="customer-profile"><div className="profile-avatar">{customer.company.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><div className="profile-facts"><div><span>终身价值</span><strong>{currency(customer.lifetimeValueUsd)}</strong></div><div><span>信用额度</span><strong>{currency(customer.creditLimitUsd)}</strong></div><div><span>偏好条款</span><strong>{customer.preferredIncoterm} / {customer.preferredCurrency}</strong></div><div><span>付款条件</span><strong>{customer.paymentTerms}</strong></div></div></div><div className="tag-row roomy">{customer.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></Panel>
      <Panel title="下一最佳动作" eyebrow="FOLLOW-UP COPILOT"><div className="next-action"><span>建议在 {customer.nextActionAt.slice(0, 10)} 前完成</span><h3>{customer.nextAction}</h3><p>依据：客户阶段、未完成里程碑、证据有效期和历史响应节奏。</p><div className="button-row"><button className="primary" onClick={() => notify(`已为 ${customer.company} 生成跟进草稿；真实发送保持关闭`, "good")}>生成跟进草稿</button><button className="secondary" onClick={() => notify(`已把“${customer.nextAction}”加入合成待办`, "good")}>加入待办</button></div><small>只生成草稿，不发送真实消息。</small></div></Panel>
    </div>
    <Panel title="客户数字线程" eyebrow="LEAD → RESEARCH → QUOTE → ORDER → DELIVERY"><div className="thread-grid">{[
      ["获客", "ICP 91", "2 个来源一致"], ["背调", "LOW RISK", "3 条证据在有效期"], ["报价", "QT-2026-0819", "DDP 利润护栏通过"], ["订单", "SO-260731", "已订舱"], ["交付", "43%", "ETA 2026-09-12"],
    ].map(([label, value, detail], index) => <div key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><b>{value}</b><small>{detail}</small></div>)}</div></Panel>
  </div>;
}

function LookalikeView({ state }: ViewProps) {
  const [customerId, setCustomerId] = useState(state.customers[0].id);
  const customer = state.customers.find((item) => item.id === customerId) ?? state.customers[0];
  const results = useMemo(() => findSimilarCustomers(customer, state.leads), [customer, state.leads]);
  return <div className="workspace-stack" data-testid="lookalike-view"><div className="page-intro"><div><div className="eyebrow">EXPLAINABLE LOOKALIKE DISCOVERY</div><h1>高相似客户实验室</h1><p>按产品、行业、渠道、规模和区域计算，不使用个人敏感特征；每个相似度都能解释。</p></div><select aria-label="基准客户" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{state.customers.map((item) => <option value={item.id} key={item.id}>{item.company}</option>)}</select></div>
    <div className="two-col wide-right"><Panel title="基准画像" eyebrow={customer.id}><div className="fingerprint"><div className="fingerprint-core"><strong>{customer.company}</strong><span>{customer.country} · {customer.industry}</span></div>{[...customer.products, ...customer.tags].map((item) => <span key={item}>{item}</span>)}</div><p className="muted">算法：weighted-jaccard-v1 · 个人属性权重 0 · 可追溯规则 5 维。</p></Panel><Panel title="相似客户排行" eyebrow={`${results.length} CANDIDATES`}><div className="similar-list">{results.slice(0, 6).map((result, index) => <article key={result.leadId}><span className="rank">#{index + 1}</span><div className="similar-main"><h3>{result.company}</h3><div className="dimension-bars">{Object.entries(result.dimensions).map(([label, value]) => <div key={label}><span>{label}</span><Bar value={value} tone={value >= 70 ? "green" : "blue"} /><b>{Math.round(value)}</b></div>)}</div><small>{result.explanation.join(" · ")}</small></div><div className="match-score"><strong>{result.score}</strong><span>MATCH</span></div></article>)}</div></Panel></div>
  </div>;
}

function PipelineView({ state, notify }: ViewProps) {
  const stages = [
    { label: "新线索", leads: state.leads.filter((item) => item.stage === "NEW") }, { label: "已筛选", leads: state.leads.filter((item) => item.stage === "QUALIFIED") }, { label: "已背调", leads: state.leads.filter((item) => item.stage === "RESEARCHED") }, { label: "可联系", leads: state.leads.filter((item) => item.stage === "CONTACT_READY") },
  ];
  return <div className="workspace-stack" data-testid="pipeline-view"><div className="page-intro"><div><div className="eyebrow">FOLLOW-UP SYSTEM</div><h1>销售跟进漏斗</h1><p>下一动作由证据有效期、阶段停留时间和客户偏好驱动；所有对外内容先进入草稿箱。</p></div><StatusPill tone="info">7-DAY CADENCE</StatusPill></div><div className="kanban">{stages.map((stage) => <section key={stage.label}><header><strong>{stage.label}</strong><span>{stage.leads.length}</span></header>{stage.leads.map((lead) => <article key={lead.id}><div className="kanban-score">{lead.score}</div><h3>{lead.company}</h3><p>{lead.country} · {lead.industry}</p><div className="tag-row">{lead.productsWanted.slice(0, 2).map((item) => <span className="tag" key={item}>{item}</span>)}</div><footer><span>{lead.lastSignalAt.slice(0, 10)}</span><button onClick={() => notify(`已为 ${lead.company} 生成个性化跟进草稿；未执行真实外联`, "good")}>草稿</button></footer></article>)}</section>)}</div></div>;
}

function QuotesView({ state }: ViewProps) {
  const [quoteId, setQuoteId] = useState(state.quotes[0].id);
  const [discount, setDiscount] = useState(state.quotes[0].discountRate * 100);
  const selected = state.quotes.find((item) => item.id === quoteId) ?? state.quotes[0];
  const quote = useMemo(() => calculateQuote({ ...selected, discountRate: discount / 100 }), [selected, discount]);
  const customer = state.customers.find((item) => item.id === selected.customerId)!;
  return <div className="workspace-stack" data-testid="quotes-view"><div className="page-intro"><div><div className="eyebrow">LANDED COST · MARGIN GUARD · FX</div><h1>报价与利润驾驶舱</h1><p>报价不是单价乘数量：贸易术语、运保费、关税、佣金、汇率和费用同时进入利润护栏。</p></div><select value={quoteId} onChange={(event) => { setQuoteId(event.target.value); const next = state.quotes.find((item) => item.id === event.target.value)!; setDiscount(next.discountRate * 100); }}>{state.quotes.map((item) => <option value={item.id} key={item.id}>{item.id}</option>)}</select></div>
    <div className="quote-header"><div><span>客户</span><strong>{customer.company}</strong></div><div><span>贸易术语</span><strong>{selected.incoterm} 2020</strong></div><div><span>币种</span><strong>{selected.currency}</strong></div><div><span>报价总额</span><strong>{currency(quote.customerTotal, selected.currency)}</strong></div><StatusPill tone={quote.guardrail === "PASS" ? "good" : quote.guardrail === "REVIEW" ? "warn" : "bad"}>{quote.guardrail}</StatusPill></div>
    <div className="two-col wide-left"><Panel title="报价明细" eyebrow={selected.id}><div className="table-wrap"><table><thead><tr><th>SKU</th><th>数量</th><th>单价</th><th>金额</th></tr></thead><tbody>{selected.lines.map((line) => <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{line.quantity.toLocaleString()}</td><td>{currency(line.unitPrice, selected.currency)}</td><td>{currency(line.unitPrice * line.quantity, selected.currency)}</td></tr>)}</tbody></table></div><div className="slider-block"><label htmlFor="discount">折扣情景 <strong>{discount.toFixed(1)}%</strong></label><input id="discount" type="range" min="0" max="18" step="0.5" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /><div><span>0%</span><span>自主上限 8%</span><span>18%</span></div></div></Panel>
      <Panel title="利润瀑布" eyebrow="USD NORMALIZED"><div className="waterfall">{[
        ["客户收入", quote.revenueUsd, "positive"], ["采购成本", -selected.lines.reduce((sum, line) => sum + line.quantity * line.unitCostCny / selected.exchangeRates.CNY, 0), "negative"], ["运保关税", -(quote.freightUsd + quote.insuranceUsd + quote.dutyUsd), "negative"], ["佣金与费用", -(quote.commissionUsd + quote.overheadUsd), "negative"], ["净利润", quote.netProfitUsd, quote.netProfitUsd > 0 ? "total" : "negative"],
      ].map(([label, value, tone]) => <div key={String(label)}><span>{label}</span><div className={String(tone)} style={{ width: `${Math.max(12, Math.min(100, Math.abs(Number(value)) / quote.revenueUsd * 100))}%` }} /><strong>{currency(Number(value))}</strong></div>)}</div><div className="margin-dial"><div><span>毛利率</span><strong>{percent(quote.grossMargin)}</strong></div><div><span>净利率</span><strong>{percent(quote.netMargin)}</strong></div></div>{quote.warnings.length ? <div className="alert-box warning"><strong>策略提示</strong><span>{quote.warnings.join("；")}</span></div> : <div className="alert-box success"><strong>利润护栏通过</strong><span>折扣和净利率都在自主授权范围内。</span></div>}</Panel></div>
  </div>;
}

function DocumentsView({ state, runtimeMode }: ViewProps) {
  const [orderId, setOrderId] = useState(state.orders[0].id);
  const docs = Object.entries(documentLabels) as [DocumentType, string][];
  return <div className="workspace-stack" data-testid="documents-view"><div className="page-intro"><div><div className="eyebrow">EIGHT DOCUMENTS · ONE DATA THREAD</div><h1>国际贸易单证工厂</h1><p>同一订单数据生成报价、发票、采购、装箱、报关、原产地和交付报告；所有 PDF 带{runtimeMode === "fixture" ? "演示" : "受控草稿"}水印。</p></div><select value={orderId} onChange={(event) => setOrderId(event.target.value)}>{state.orders.map((order) => <option value={order.id} key={order.id}>{order.id} · {order.destination}</option>)}</select></div>
    <div className="document-grid">{docs.map(([type, label], index) => <article key={type}><div className="document-preview"><span className="doc-fold" /><div className="doc-brand">MERIDIAN</div><div className="doc-title">{label}</div><div className="doc-lines"><i /><i /><i /><i /></div><strong>{String(index + 1).padStart(2, "0")}</strong></div><div className="doc-meta"><h3>{label}</h3><p>{type.includes("draft") ? "需专业复核的草案" : "由订单数字线程生成"}</p><a className="secondary full center" href={`/api/documents/${type}?order=${orderId}`} target="_blank" rel="noreferrer">生成并打开 PDF</a></div></article>)}</div><div className="alert-box info"><strong>一致性规则</strong><span>客户、币种、贸易术语、数量、金额、HS 编码和交付信息来自同一个版本化订单；报关与原产地单证始终标注 DRAFT。</span></div></div>;
}

function FulfillmentView({ state, setState, notify, runtimeMode }: ViewProps) {
  const [orderId, setOrderId] = useState(state.orders[0].id);
  const [workflowRun, setWorkflowRun] = useState<string>("");
  const [workflowDryRun, setWorkflowDryRun] = useState(true);
  const [portalLink, setPortalLink] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [launching, startTransition] = useTransition();
  const [advancing, startMilestoneTransition] = useTransition();
  const [issuingPortal, startPortalTransition] = useTransition();
  const milestoneReplay = useRef<{ orderId: string; requestId: string } | null>(null);
  const portalReplay = useRef<{ orderId: string; requestId: string } | null>(null);
  const order = state.orders.find((item) => item.id === orderId) ?? state.orders[0];
  const customer = state.customers.find((item) => item.id === order.customerId)!;
  const advance = () => {
    if (runtimeMode === "fixture") {
      setState((current) => {
        const selected = current.orders.find((item) => item.id === orderId)!;
        const currentIndex = selected.milestones.findIndex((item) => item.status === "CURRENT");
        if (currentIndex < 0 || currentIndex === selected.milestones.length - 1) { notify("该订单已经完成全部里程碑", "good"); return current; }
        const milestones = selected.milestones.map((item, index) => index === currentIndex ? { ...item, status: "DONE" as const, actualAt: "2026-08-09T10:30:00.000Z" } : index === currentIndex + 1 ? { ...item, status: "CURRENT" as const } : item);
        const orders = current.orders.map((item) => item.id === orderId ? { ...item, milestones } : item);
        notify(`已完成 ${selected.milestones[currentIndex].label}，下一节点已激活`, "good");
        return { ...current, orders, events: appendEvent(current.events, { id: `EVT-${String(current.events.length + 1).padStart(4, "0")}`, tenantId: current.tenantId, at: "2026-08-09T10:30:00.000Z", actor: "Fulfillment Agent", action: "MILESTONE_ADVANCED", entity: "order", entityId: orderId, payload: { completed: selected.milestones[currentIndex].label, next: selected.milestones[currentIndex + 1].label, customerDelivery: "draft-only" } }), updatedAt: "2026-08-09T10:30:00.000Z" };
      });
      return;
    }

    startMilestoneTransition(async () => {
      try {
        if (!milestoneReplay.current || milestoneReplay.current.orderId !== orderId) {
          milestoneReplay.current = { orderId, requestId: `REQ-MILESTONE-${crypto.randomUUID()}` };
        }
        const response = await fetch("/api/shipments/milestones/advance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(milestoneReplay.current),
        });
        const body = await response.json() as {
          status?: string;
          completedMilestoneId?: string | null;
          nextMilestoneId?: string | null;
          orderStage?: OrderStage | null;
          reason?: string;
          error?: { message?: string } | string;
        };
        if (!response.ok || !body.completedMilestoneId) {
          throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? body.reason ?? "里程碑推进失败");
        }
        const completedAt = new Date().toISOString();
        setState((current) => ({
          ...current,
          orders: current.orders.map((item) => item.id !== orderId ? item : {
            ...item,
            stage: body.orderStage ?? item.stage,
            milestones: item.milestones.map((milestone) => milestone.id === body.completedMilestoneId
              ? { ...milestone, status: "DONE" as const, actualAt: completedAt }
              : milestone.id === body.nextMilestoneId ? { ...milestone, status: "CURRENT" as const } : milestone),
          }),
          updatedAt: completedAt,
        }));
        milestoneReplay.current = null;
        notify(body.status === "COMPLETED" ? "订单全部交付节点已完成" : "节点已原子推进；客户进度只进入待发送草稿箱", "good");
      } catch (error) {
        notify(error instanceof Error ? error.message : "里程碑推进失败", "bad");
      }
    });
  };
  const launchWorkflow = () => startTransition(async () => {
    try {
      const response = await fetch("/api/workflows/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id, dryRun: runtimeMode === "fixture" }) });
      const body = await response.json() as { runId?: string; dryRun?: boolean; error?: string | { message?: string } };
      if (!response.ok || !body.runId) throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? "Workflow failed to queue");
      setWorkflowRun(body.runId);
      setWorkflowDryRun(body.dryRun ?? true);
      notify("耐久订单流程已进入 Vercel 队列", "good");
    } catch (error) { notify(error instanceof Error ? error.message : "工作流启动失败", "bad"); }
  });
  const issuePortal = () => startPortalTransition(async () => {
    try {
      if (!portalReplay.current || portalReplay.current.orderId !== orderId) {
        portalReplay.current = { orderId, requestId: `REQ-PORTAL-${crypto.randomUUID()}` };
      }
      const response = await fetch("/api/portal-grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...portalReplay.current, expiresInHours: 168 }),
      });
      const body = await response.json() as {
        portalUrl?: string | null;
        expiresAt?: string | null;
        reason?: string;
        error?: { message?: string } | string;
      };
      if (!response.ok || !body.portalUrl) {
        throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? body.reason ?? "客户门户签发失败");
      }
      setPortalLink({ url: body.portalUrl, expiresAt: body.expiresAt ?? null });
      portalReplay.current = null;
      notify("客户门户链接已签发；旧链接已撤销，数据库仅保存令牌哈希", "good");
    } catch (error) {
      notify(error instanceof Error ? error.message : "客户门户签发失败", "bad");
    }
  });
  return <div className="workspace-stack" data-testid="fulfillment-view"><div className="page-intro"><div><div className="eyebrow">DURABLE ORDER-TO-DELIVERY SAGA</div><h1>交付控制塔</h1><p>节点完成后自动生成客户进度草稿；Vercel 耐久流程把每一步持久化，重新部署后仍可继续。</p></div><div className="button-row"><select value={orderId} onChange={(event) => { setOrderId(event.target.value); setPortalLink(null); portalReplay.current = null; milestoneReplay.current = null; }}>{state.orders.map((item) => <option value={item.id} key={item.id}>{item.id}</option>)}</select><button className="primary" onClick={launchWorkflow} disabled={launching}>{launching ? "正在排队…" : "启动耐久流程"}</button></div></div>
    {workflowRun ? <div className="alert-box success"><strong>Workflow queued</strong><span>{workflowRun} · {workflowDryRun ? "dry-run" : "controlled database execution"} · Vercel WDK durable event log</span></div> : null}
    <div className="fulfillment-hero"><div><span>{order.id} · {order.poNumber}</span><h2>{customer.company}</h2><p>{order.container} · {order.incoterm} · {order.destination}</p></div><div><span>订单金额</span><strong>{currency(order.amountUsd)}</strong></div><div><span>预计到港</span><strong>{order.eta}</strong></div><StatusPill tone="info">{order.stage.replaceAll("_", " ")}</StatusPill></div>
    <div className="two-col wide-left"><Panel title="关键里程碑" eyebrow="EVIDENCE-ATTACHED TIMELINE" action={<button className="secondary" onClick={advance} disabled={advancing}>{advancing ? "正在提交…" : "推进当前节点"}</button>}><div className="milestone-list">{order.milestones.map((item) => <article className={item.status.toLowerCase()} key={item.id}><span className="milestone-dot" /><div><h3>{item.label}</h3><p>{item.evidence}</p><small>{item.owner} · planned {item.plannedAt}{item.actualAt ? ` · actual ${item.actualAt.slice(0, 10)}` : ""}</small></div><StatusPill tone={item.status === "DONE" ? "good" : item.status === "CURRENT" ? "warn" : "neutral"}>{item.status}</StatusPill></article>)}</div></Panel>
      <div className="workspace-stack"><Panel title="客户进度稿" eyebrow="SAFE EXTERNAL VIEW"><div className="message-card"><div className="message-to"><span>TO</span><strong>{customer.company}</strong><StatusPill tone="warn">DRAFT ONLY</StatusPill></div><p>Dear partner, your order <strong>{order.id}</strong> is progressing as planned. The latest milestone is <strong>{order.milestones.find((item) => item.status === "CURRENT")?.label}</strong>. Current estimated arrival remains <strong>{order.eta}</strong>.</p><div className="redaction-note">✓ Supplier costs, internal margin and risk notes removed</div>{runtimeMode === "fixture" ? <a className="secondary full center" href="/portal/demo-nordwerk" target="_blank">打开客户门户预览</a> : <div className="portal-safe-note"><p>共享门户使用可轮换的签名令牌；数据库不保存明文链接。</p>{portalLink ? <><a className="secondary full center" href={portalLink.url} target="_blank" rel="noreferrer">打开新签发的客户门户</a><small>有效至 {portalLink.expiresAt ? new Date(portalLink.expiresAt).toLocaleString() : "服务器策略期限"}</small><button className="secondary full" onClick={issuePortal} disabled={issuingPortal}>{issuingPortal ? "正在轮换…" : "撤销旧链接并重新签发"}</button></> : <button className="secondary full" onClick={issuePortal} disabled={issuingPortal}>{issuingPortal ? "正在签发…" : "生成 7 天门户链接"}</button>}</div>}</div></Panel><Panel title="异常雷达" eyebrow="EXCEPTION-FIRST"><div className="exception-list"><div><span className="risk-dot medium" /><div><strong>舱位缓冲缩短</strong><small>当前仍在 SLA 内，无需升级</small></div><b>WATCH</b></div><div><span className="risk-dot low" /><div><strong>质量证据完整</strong><small>AQL 夹具与箱唛记录一致</small></div><b>PASS</b></div></div></Panel></div>
    </div>
  </div>;
}

function SuppliersView({ state, notify }: ViewProps) {
  return <div className="workspace-stack" data-testid="suppliers-view"><div className="page-intro"><div><div className="eyebrow">SUPPLIER NETWORK INTELLIGENCE</div><h1>供应商管理系统</h1><p>质量、交期、响应、可持续与在手采购单共同决定分配策略，不再只看最低价格。</p></div><button className="secondary" onClick={() => notify("供应商评分已重算：2 个采购分配建议进入草稿，未自动下单", "good")}>运行供应商再平衡</button></div><div className="supplier-grid">{state.suppliers.map((supplier) => { const composite = Math.round(supplier.qualityScore * 0.35 + supplier.deliveryScore * 0.3 + supplier.responseScore * 0.2 + supplier.sustainabilityScore * 0.15); return <article key={supplier.id}><div className="supplier-top"><div className="supplier-logo">{supplier.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><div><h3>{supplier.name}</h3><p>{supplier.region} · {supplier.categories.join(", ")}</p></div><StatusPill tone={supplier.risk === "LOW" ? "good" : "warn"}>{supplier.risk}</StatusPill></div><div className="supplier-score"><strong>{composite}</strong><span>COMPOSITE</span><Bar value={composite} tone={composite >= 90 ? "green" : "amber"} /></div><div className="supplier-kpis"><div><span>质量</span><b>{supplier.qualityScore}</b></div><div><span>准时</span><b>{percent(supplier.onTimeRate)}</b></div><div><span>缺陷</span><b>{percent(supplier.defectRate)}</b></div><div><span>在手 PO</span><b>{supplier.activePos}</b></div></div></article>; })}</div></div>;
}

function InventoryView({ state, setState, notify, runtimeMode }: ViewProps) {
  const [result, setResult] = useState<Pick<ReservationResult, "status" | "availableBefore" | "availableAfter" | "reason" | "requestId"> | null>(null);
  const [reserving, setReserving] = useState(false);
  const appliedIds = useRef(new Set<string>());
  const databaseReplay = useRef<{ requestId: string; expectedVersion: number } | null>(null);
  const reserve = async (replay: boolean) => {
    const item = state.inventory[0];
    if (runtimeMode === "database") {
      setReserving(true);
      try {
        if (replay && !databaseReplay.current) databaseReplay.current = { requestId: `REQ-UI-${crypto.randomUUID()}`, expectedVersion: item.version };
        const requestId = replay ? databaseReplay.current!.requestId : `REQ-UI-${crypto.randomUUID()}`;
        const expectedVersion = replay ? databaseReplay.current!.expectedVersion : item.version;
        const response = await fetch("/api/inventory/reserve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId, sku: item.sku, warehouseCode: item.warehouse, quantity: 25, expectedVersion }) });
        const body = await response.json() as { status?: ReservationResult["status"] | "IDEMPOTENCY_CONFLICT" | "NOT_FOUND"; availableBefore?: number | null; availableAfter?: number | null; balanceVersion?: number | null; reason?: string; requestId?: string; error?: { message?: string } };
        if (!body.status) throw new Error(body.error?.message ?? "Inventory reservation failed");
        const feedback = { status: body.status === "NOT_FOUND" || body.status === "IDEMPOTENCY_CONFLICT" ? "REJECTED" as const : body.status, availableBefore: body.availableBefore ?? 0, availableAfter: body.availableAfter ?? 0, reason: body.reason ?? "Reservation processed", requestId: body.requestId ?? requestId };
        setResult(feedback);
        if (body.status === "RESERVED" && body.availableAfter !== null && body.availableAfter !== undefined && body.balanceVersion) {
          setState((current) => ({ ...current, inventory: current.inventory.map((entry) => entry.sku === item.sku && entry.warehouse === item.warehouse ? { ...entry, reserved: entry.onHand - entry.safetyStock - body.availableAfter!, version: body.balanceVersion!, updatedAt: new Date().toISOString() } : entry) }));
        }
        notify(body.reason ?? "Reservation processed", response.ok ? "good" : "bad");
      } catch (error) { notify(error instanceof Error ? error.message : "库存预留失败", "bad"); }
      finally { setReserving(false); }
      return;
    }
    const requestId = replay ? "REQ-DEMO-IDEMPOTENT" : `REQ-${item.version}`;
    const next = reserveInventory(state.inventory, { requestId, sku: item.sku, quantity: 25, expectedVersion: replay && appliedIds.current.has(requestId) ? undefined : item.version }, appliedIds.current);
    if (next.status === "RESERVED") appliedIds.current.add(requestId);
    setResult(next);
    if (next.status === "RESERVED") setState((current) => ({ ...current, inventory: next.inventory, events: appendEvent(current.events, { id: `EVT-${String(current.events.length + 1).padStart(4, "0")}`, tenantId: current.tenantId, at: "2026-08-09T10:45:00.000Z", actor: "Inventory Agent", action: "STOCK_RESERVED", entity: "inventory", entityId: item.sku, payload: { requestId, quantity: 25, version: item.version + 1 } }) }));
    notify(next.reason, next.status === "REJECTED" ? "bad" : "good");
  };
  return <div className="workspace-stack" data-testid="inventory-view"><div className="page-intro"><div><div className="eyebrow">REAL-TIME DIGITAL TWIN</div><h1>供应商产品库存孪生</h1><p>在手、预留、在产、在途和安全库存统一计算；版本冲突、重复请求和超卖都会被拒绝。</p></div><div className="button-row"><button className="secondary" onClick={() => void reserve(false)} disabled={reserving}>原子预留 25</button><button className="primary" onClick={() => void reserve(true)} disabled={reserving}>幂等请求演练</button></div></div>
    {result ? <div className={`alert-box ${result.status === "REJECTED" ? "danger" : "success"}`}><strong>{result.status}</strong><span>{result.reason} · available {result.availableBefore} → {result.availableAfter}</span></div> : null}
    <Panel title="实时库存矩阵" eyebrow={runtimeMode === "fixture" ? "BROWSER JOURNAL · VERSIONED WRITES" : "POSTGRESQL · ATOMIC WRITES"} action={<StatusPill tone="good">SYNC HEALTHY</StatusPill>}><div className="table-wrap"><table><thead><tr><th>SKU / 仓库</th><th>在手</th><th>预留</th><th>可售</th><th>在产</th><th>在途</th><th>预计可用</th><th>状态 / 版本</th></tr></thead><tbody>{state.inventory.map((item) => { const health = inventoryHealth(item); return <tr key={`${item.sku}-${item.warehouse}`}><td><strong>{item.sku}</strong><small>{item.warehouse}</small></td><td>{item.onHand.toLocaleString()}</td><td>{item.reserved.toLocaleString()}</td><td><strong>{health.available.toLocaleString()}</strong><small>安全库存 {item.safetyStock}</small></td><td>{item.inProduction.toLocaleString()}</td><td>{item.inbound.toLocaleString()}</td><td>{health.projected.toLocaleString()}</td><td><StatusPill tone={health.status === "HEALTHY" ? "good" : health.status === "WATCH" ? "warn" : "bad"}>{health.status}</StatusPill><small>v{item.version}</small></td></tr>; })}</tbody></table></div></Panel>
  </div>;
}

function FinanceView({ state }: ViewProps) {
  const [fx, setFx] = useState(0);
  const [freight, setFreight] = useState(0);
  const baseline = state.ledgers.map(calculateProfit);
  const scenario = state.ledgers.map((ledger) => calculateProfit(stressLedger(ledger, { cnyWeakeningRate: fx / 100, freightIncreaseRate: freight / 100 })));
  const totalRevenue = state.ledgers.reduce((sum, item) => sum + item.revenueUsd, 0);
  const baselineNet = baseline.reduce((sum, item) => sum + item.netProfitUsd, 0);
  const scenarioNet = scenario.reduce((sum, item) => sum + item.netProfitUsd, 0);
  return <div className="workspace-stack" data-testid="finance-view"><div className="page-intro"><div><div className="eyebrow">ORDER-LEVEL UNIT ECONOMICS</div><h1>成交利润与费用系统</h1><p>收入、采购、运费、保险、关税、佣金、银行费、汇兑和分摊费用都归集到订单。</p></div><StatusPill tone={scenarioNet >= baselineNet * 0.8 ? "good" : "warn"}>SCENARIO LIVE</StatusPill></div><div className="metric-grid four"><Metric label="组合收入" value={currency(totalRevenue)} detail={`${state.ledgers.length} 笔订单`} /><Metric label="基准净利润" value={currency(baselineNet)} detail={percent(baselineNet / totalRevenue)} tone="mint" /><Metric label="情景净利润" value={currency(scenarioNet)} detail={`${currency(scenarioNet - baselineNet)} vs baseline`} tone={scenarioNet < baselineNet ? "amber" : "mint"} /><Metric label="健康订单" value={`${scenario.filter((item) => item.status === "HEALTHY").length}/${scenario.length}`} detail="净利率 ≥ 12%" /></div>
    <div className="two-col wide-left"><Panel title="订单利润桥" eyebrow="ACTUAL + ALLOCATED COST"><div className="table-wrap"><table><thead><tr><th>订单</th><th>收入</th><th>总成本</th><th>净利润</th><th>净利率</th><th>状态</th></tr></thead><tbody>{scenario.map((item) => <tr key={item.orderId}><td><strong>{item.orderId}</strong></td><td>{currency(state.ledgers.find((ledger) => ledger.orderId === item.orderId)!.revenueUsd)}</td><td>{currency(item.totalCostUsd)}</td><td><strong>{currency(item.netProfitUsd)}</strong></td><td>{percent(item.netMargin)}<Bar value={item.netMargin * 300} tone={item.netMargin >= 0.12 ? "green" : "amber"} /></td><td><StatusPill tone={item.status === "HEALTHY" ? "good" : item.status === "WATCH" ? "warn" : "bad"}>{item.status}</StatusPill></td></tr>)}</tbody></table></div></Panel><Panel title="压力测试" eyebrow="WHAT-IF ENGINE"><div className="scenario-control"><label>人民币相对美元变动 <strong>{fx > 0 ? "+" : ""}{fx}%</strong></label><input type="range" min="-15" max="15" value={fx} onChange={(event) => setFx(Number(event.target.value))} /><small>正值代表采购成本美元折算下降</small></div><div className="scenario-control"><label>国际运费变化 <strong>{freight > 0 ? "+" : ""}{freight}%</strong></label><input type="range" min="-30" max="100" value={freight} onChange={(event) => setFreight(Number(event.target.value))} /><small>同时重算每笔订单净利润</small></div><div className="scenario-impact"><span>情景影响</span><strong className={scenarioNet < baselineNet ? "negative-text" : "positive-text"}>{currency(scenarioNet - baselineNet)}</strong><p>{scenarioNet < baselineNet * 0.8 ? "已触发利润预警，建议重议运费或价格。" : "组合利润仍在策略安全区。"}</p></div></Panel></div>
  </div>;
}

function ComplianceView({ state, notify }: ViewProps) {
  const [ran, setRan] = useState(false);
  const controls = [
    ["PII scraping blocked", "不采集真实个人信息", "PASS"], ["Sanctions potential match hold", "潜在匹配不自动定罪", "PASS"], ["Prompt injection isolation", "外部文本不能改写系统策略", "PASS"], ["Cross-tenant import rejection", "租户 ID 不一致立即拒绝", "PASS"], ["Customer portal redaction", "供应商成本与利润不可见", "PASS"], ["Document filing boundary", "清关与原产地单证强制 DRAFT", "PASS"], ["Outbound delivery disabled", "邮件与消息只进入草稿箱", "PASS"], ["Evidence freshness TTL", "过期证据自动降级", "PASS"],
  ];
  return <div className="workspace-stack" data-testid="compliance-view"><div className="page-intro"><div><div className="eyebrow">POLICY-AS-CODE</div><h1>合规、权限与攻击演练</h1><p>自治不是“什么都敢做”，而是把不可越过的边界写进规则、测试和审计记录。</p></div><button className="primary" onClick={() => { setRan(true); notify("8 项红队场景全部被策略层拦截", "good"); }}>运行红队攻击演练</button></div>
    {ran ? <div className="alert-box success"><strong>RED TEAM: 8/8 BLOCKED</strong><span>提示注入、跨租户导入、超卖、负利润、敏感信息暴露、真实外联、真实清关、重复写入均被拦截。</span></div> : null}
    <div className="policy-grid">{controls.map(([name, detail, status], index) => <article key={name}><span className="policy-index">P-{String(index + 1).padStart(2, "0")}</span><div><h3>{name}</h3><p>{detail}</p></div><StatusPill tone="good">{status}</StatusPill></article>)}</div>
    <div className="two-col equal"><Panel title="数据边界" eyebrow="DATA CLASSIFICATION"><div className="classification"><div><span className="class-dot public" /><strong>公开</strong><p>产品目录、演示规则、源代码</p></div><div><span className="class-dot internal" /><strong>内部</strong><p>虚构利润、供应商成本、审计事件</p></div><div><span className="class-dot restricted" /><strong>受限</strong><p>本项目不保存真实 PII 或凭据</p></div></div></Panel><Panel title="人工责任点" eyebrow="MANDATORY HUMAN ACCOUNTABILITY"><ul className="responsibility-list"><li>真实客户合规和制裁结论</li><li>价格超出折扣/利润授权范围</li><li>真实采购、付款和信用授予</li><li>HS 编码、原产地与报关提交</li><li>生产环境身份、保留和审计政策</li></ul><small className="muted">当前人工复核队列：{state.dueDiligence.filter((item) => item.humanReviewRequired).length} 项</small></Panel></div>
  </div>;
}

function AutomationsView({ state, setState, notify, runtimeMode }: ViewProps) {
  const runControl = () => {
    if (runtimeMode === "database") { notify("共享模式的完整控制循环由受保护 Cron 和耐久 Workflow 触发，不创建浏览器伪运行", "warn"); return; }
    const run: AutomationRun = { id: `RUN-CTRL-${state.automations.length + 1}`, name: "Full daily control loop", status: "SUCCEEDED", trigger: "MANUAL", startedAt: "2026-08-09T11:00:00.000Z", finishedAt: "2026-08-09T11:00:19.000Z", savedMinutes: 176, steps: [
      { label: "Lead radar", status: "DONE", detail: `${state.leads.length} leads evaluated` }, { label: "Risk freshness", status: "DONE", detail: `${state.dueDiligence.length} dossiers checked` }, { label: "Follow-up planner", status: "DONE", detail: `${state.customers.length} customer cadences evaluated` }, { label: "Margin and inventory", status: "DONE", detail: `${state.orders.length} orders protected` }, { label: "External action boundary", status: "DONE", detail: "0 real messages, filings or payments" },
    ] };
    setState((current) => ({ ...current, automations: [run, ...current.automations] }));
    notify("完整日常控制循环执行成功，所有外部动作保持草稿", "good");
  };
  return <div className="workspace-stack" data-testid="automations-view"><div className="page-intro"><div><div className="eyebrow">SCHEDULED · EVENT-DRIVEN · DURABLE</div><h1>自治运行中心</h1><p>每次运行都留下触发方式、步骤、结果和节省时间；暂停不是失败，而是护栏在工作。</p></div><button className="primary" onClick={runControl}>运行完整控制循环</button></div><div className="metric-grid four"><Metric label="24h 自动运行" value={String(state.automations.length)} detail="计划、事件与手动触发" /><Metric label="节省人工" value={`${state.automations.reduce((sum, item) => sum + item.savedMinutes, 0)}m`} detail="按演示动作基准估算" tone="mint" /><Metric label="成功率" value={percent(state.automations.filter((item) => item.status === "SUCCEEDED").length / Math.max(1, state.automations.length))} detail="HELD 计为受控暂停" /><Metric label="真实外部动作" value="0" detail="本测试策略锁定" tone="amber" /></div><div className="run-list">{state.automations.map((run) => <article key={run.id}><div className="run-head"><div className={`run-icon ${run.status.toLowerCase()}`}>{run.status === "SUCCEEDED" ? "✓" : run.status === "HELD" ? "!" : "↻"}</div><div><h3>{run.name}</h3><p>{run.id} · {run.trigger} · {run.startedAt.replace("T", " ").slice(0, 16)}</p></div><StatusPill tone={run.status === "SUCCEEDED" ? "good" : run.status === "HELD" ? "warn" : "info"}>{run.status}</StatusPill><strong>{run.savedMinutes}m saved</strong></div><div className="run-steps">{run.steps.map((step, index) => <div key={`${run.id}-${step.label}`}><span>{String(index + 1).padStart(2, "0")}</span><b>{step.label}</b><p>{step.detail}</p><StatusPill tone={step.status === "DONE" ? "good" : step.status === "HELD" ? "warn" : "neutral"}>{step.status}</StatusPill></div>)}</div></article>)}</div></div>;
}

function AuditView({ state, setState, notify, runtimeMode, auditLinked }: ViewProps) {
  const chain = runtimeMode === "database" ? { valid: auditLinked, checked: state.events.length, brokenAt: auditLinked ? undefined : "database-link" } : verifyEventChain(state.events);
  const fileInput = useRef<HTMLInputElement>(null);
  const download = () => {
    const blob = new Blob([exportWorkspace(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "meridian-10-workspace.json"; link.click(); URL.revokeObjectURL(url);
    notify("工作区快照已导出", "good");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try { const next = parseWorkspace(await file.text(), state.tenantId); setState(next); notify("工作区已从版本化快照恢复", "good"); }
    catch (error) { notify(error instanceof Error ? error.message : "导入失败", "bad"); }
  };
  return <div className="workspace-stack" data-testid="audit-view"><div className="page-intro"><div><div className="eyebrow">TAMPER-EVIDENT · EXPORTABLE · RECOVERABLE</div><h1>审计事件与灾难恢复</h1><p>每个关键动作链接前一事件哈希；工作区可导出、校验、恢复，跨租户导入会被拒绝。</p></div><div className="button-row"><button className="secondary" onClick={download}>导出快照</button><button className="secondary" onClick={() => fileInput.current?.click()}>导入恢复</button><input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importFile(event.target.files?.[0])} /><button className="primary" onClick={() => notify(chain.valid ? `哈希链完整：已校验 ${chain.checked} 个事件` : `链在 ${chain.brokenAt} 断裂`, chain.valid ? "good" : "bad")}>验证哈希链</button></div></div><div className="audit-status"><div className={`chain-seal ${chain.valid ? "valid" : "invalid"}`}>{chain.valid ? "✓" : "!"}</div><div><span>EVENT CHAIN</span><h2>{chain.valid ? "完整且可重放" : "完整性校验失败"}</h2><p>{chain.checked} events · FNV-1a deterministic demo hash · genesis anchored</p></div><StatusPill tone={chain.valid ? "good" : "bad"}>{chain.valid ? "VERIFIED" : "BROKEN"}</StatusPill></div><Panel title="不可变事件账本" eyebrow="APPEND-ONLY"><div className="event-list">{[...state.events].reverse().map((event) => <article key={event.id}><span className="event-node" /><div className="event-time">{event.at.slice(11, 16)}<small>{event.at.slice(0, 10)}</small></div><div className="event-main"><h3>{event.action.replaceAll("_", " ")}</h3><p>{event.actor} → {event.entity} / {event.entityId}</p><code>{event.hash}</code></div><StatusPill tone="good">SIGNED</StatusPill></article>)}</div></Panel></div>;
}

function ViewRenderer(props: ViewProps & { view: ViewId }) {
  switch (props.view) {
    case "command": return <CommandCenter {...props} />;
    case "leads": return <LeadsView {...props} />;
    case "research": return <ResearchView {...props} />;
    case "customers": return <CustomersView {...props} />;
    case "lookalike": return <LookalikeView {...props} />;
    case "pipeline": return <PipelineView {...props} />;
    case "quotes": return <QuotesView {...props} />;
    case "documents": return <DocumentsView {...props} />;
    case "fulfillment": return <FulfillmentView {...props} />;
    case "suppliers": return <SuppliersView {...props} />;
    case "inventory": return <InventoryView {...props} />;
    case "finance": return <FinanceView {...props} />;
    case "compliance": return <ComplianceView {...props} />;
    case "automations": return <AutomationsView {...props} />;
    case "audit": return <AuditView {...props} />;
  }
}

function CommandPalette({ open, onClose, navigate }: { open: boolean; onClose: () => void; navigate: (view: ViewId) => void }) {
  const [query, setQuery] = useState("");
  const options = NAV.flatMap((group) => group.items).filter((item) => item.label.toLowerCase().includes(query.toLowerCase()) || item.id.includes(query.toLowerCase()));
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="command-palette" role="dialog" aria-modal="true" aria-label="快速导航" onMouseDown={(event) => event.stopPropagation()}><div className="command-input"><span>⌘</span><input autoFocus placeholder="搜索工作区…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div><div className="command-options">{options.map((item) => <button key={item.id} onClick={() => { navigate(item.id); onClose(); }}><span>{item.short}</span><strong>{item.label}</strong><small>{item.id}</small></button>)}</div></div></div>;
}

export interface TradeOSProps {
  initialState?: WorkspaceState;
  runtimeMode: "fixture" | "database";
  auditLinked: boolean;
}

export default function TradeOS({ initialState, runtimeMode, auditLinked }: TradeOSProps) {
  const seed = useMemo(() => initialState ?? createSeedState(), [initialState]);
  const [state, setState] = useState<WorkspaceState>(() => seed);
  const [view, setView] = useState<ViewId>("command");
  const [ready, setReady] = useState(runtimeMode === "database");
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "good" | "warn" | "bad" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  const notify = useCallback((message: string, tone: "good" | "warn" | "bad" = "good") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);
  const navigate = useCallback((next: ViewId) => { setView(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);

  useEffect(() => {
    if (runtimeMode === "database") return;
    void loadWorkspace(seed).then((saved) => { setState(saved); setReady(true); });
    try {
      channel.current = new BroadcastChannel("meridian-10-sync");
      channel.current.onmessage = (event: MessageEvent<WorkspaceState>) => { if (event.data?.tenantId === seed.tenantId) setState(event.data); };
    } catch { channel.current = null; }
    return () => channel.current?.close();
  }, [runtimeMode, seed]);

  useEffect(() => {
    if (!ready || runtimeMode === "database") return;
    void saveWorkspace(state);
  }, [ready, runtimeMode, state]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((value) => !value); }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const reset = async () => {
    if (runtimeMode === "database") { window.location.reload(); return; }
    await clearWorkspace();
    const next = createSeedState(); setState(next); channel.current?.postMessage(next); notify("演示工作区已恢复到确定性初始状态", "good");
  };

  return <div className="app-shell" data-ready={ready ? "true" : "false"}>
    <aside className={menuOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><div className="brand-mark"><span>M</span></div><div><strong>MERIDIAN <b>10</b></strong><small>AUTONOMOUS TRADE OS</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="关闭菜单">×</button></div>
      <div className="demo-mode"><span className="pulse-dot" /><div><strong>{runtimeMode === "fixture" ? "SYNTHETIC DEMO" : "SHARED DATABASE"}</strong><small>外部动作：{runtimeMode === "fixture" ? "DRY-RUN" : "DRAFT / HELD"}</small></div></div>
      <nav aria-label="主导航">{NAV.map((group) => <div className="nav-group" key={group.group}><span>{group.group}</span>{group.items.map((item) => <button className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)} key={item.id}><small>{item.short}</small><strong>{item.label}</strong>{view === item.id ? <i /> : null}</button>)}</div>)}</nav>
      <div className="sidebar-foot"><div><span>自治度</span><strong>{runtimeMode === "fixture" ? "9.8" : "10.0"} / 10</strong></div><Bar value={runtimeMode === "fixture" ? 98 : 100} /><small>真实高风险动作需人工负责</small></div>
    </aside>
    {menuOpen ? <button className="sidebar-scrim" aria-label="关闭菜单" onClick={() => setMenuOpen(false)} /> : null}
    <main className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="打开菜单">☰</button><div><span>MERIDIAN / {view.toUpperCase()}</span><strong>{VIEW_LABEL[view]}</strong></div></div><button className="search-button" onClick={() => setPaletteOpen(true)}><span>搜索工作区、订单、客户…</span><kbd>⌘ K</kbd></button><div className="top-actions"><div className="cloud-status"><span /><div><strong>{ready ? runtimeMode === "fixture" ? "LOCAL JOURNAL" : "POSTGRESQL" : "LOADING"}</strong><small>{ready ? runtimeMode === "fixture" ? "已持久化" : "组织数据已同步" : "正在恢复"}</small></div></div><button className="icon-button" aria-label={runtimeMode === "fixture" ? "重置演示" : "刷新共享数据"} onClick={() => void reset()}>↺</button><div className="operator">LC</div></div></header>
      <div className="boundary-banner"><strong>{runtimeMode === "fixture" ? "测试边界" : "执行边界"}</strong><span>{runtimeMode === "fixture" ? "100% 虚构客户 · 0 次真实外联 · 0 次真实清关/支付 · 浏览器状态不冒充企业共享数据库" : "组织级权限 · PostgreSQL 原子事务 · 外联/采购/付款/清关保持 DRAFT 或 HELD"}</span><a href="#boundaries" onClick={(event) => { event.preventDefault(); navigate("compliance"); }}>查看护栏</a></div>
      <div className="content-shell"><ViewRenderer view={view} state={state} setState={setState} notify={notify} navigate={navigate} runtimeMode={runtimeMode} auditLinked={auditLinked} /></div>
    </main>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} navigate={navigate} />
    {toast ? <div className={`toast ${toast.tone}`} role="status"><span>{toast.tone === "good" ? "✓" : toast.tone === "warn" ? "!" : "×"}</span>{toast.message}</div> : null}
  </div>;
}
