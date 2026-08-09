import Link from "next/link";

export default function NotFound() {
  return <main className="portal-page"><div className="portal-main"><section className="portal-welcome"><div className="eyebrow">404 · ROUTE NOT FOUND</div><h1>这条数字线程不存在。</h1><p>返回 MERIDIAN 10 指挥中心继续演练。</p><Link className="primary center" href="/" style={{ width: 160, marginTop: 20 }}>返回指挥中心</Link></section></div></main>;
}
