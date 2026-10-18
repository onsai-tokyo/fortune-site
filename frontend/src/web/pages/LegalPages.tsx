import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Footer, Page, PlainHeader } from '../components/ui'
import { aiDataPolicyLinks, collectedInformation, commerceRows, crossBorderNotice, privacyIntro, privacySections, processors, termsSections, type LegalSection } from '../data/legalContent'

function Layout({ title, children }: { title: string; children: ReactNode }) {
  return <Page><PlainHeader /><article className="flex flex-col gap-7 px-6 pb-8 pt-7 text-sm leading-[1.9] break-words">
    <h1 className="m-0 text-2xl font-medium">{title}</h1>
    <aside className="border-l-2 border-fl-line pl-3 text-xs">これはWeb版の文書です。<Link className="underline" to="/app-legal/terms">アプリ向け文書の保存版</Link>は別に掲載しています。</aside>{children}
    <nav aria-label="規約関連ページ" className="flex flex-wrap gap-4 text-fl-slate underline"><Link to="/terms">利用規約</Link><Link to="/privacy">プライバシーポリシー</Link><Link to="/tokushoho">特定商取引法に基づく表記</Link></nav>
  </article><Footer /></Page>
}
function Section({ section, children }: { section: LegalSection; children?: ReactNode }) {
  return <section id={section.id} className="scroll-mt-6 space-y-3">{section.title && <h2 className="m-0 text-lg font-medium">{section.title}</h2>}{section.paragraphs.map((p, i) => <p key={i} className="m-0">{p}</p>)}{children}</section>
}
function Rows({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs leading-relaxed"><thead><tr>{headers.map(h => <th key={h} scope="col" className="border border-fl-line bg-fl-surface p-2 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="border border-fl-line p-2 align-top">{v}</td>)}</tr>)}</tbody></table></div>
}
export function WebTermsPage() {
  return <Layout title="利用規約（Web版）">{termsSections.map((s, i) => <Section key={i} section={s} />)}</Layout>
}
export function WebPrivacyPage() {
  return <Layout title="プライバシーポリシー（Web版）"><p className="m-0">{privacyIntro}</p>
    <section className="space-y-3"><h2 className="m-0 text-lg font-medium">第1条（取得する情報）</h2><Rows headers={['情報', '取得するとき']} rows={collectedInformation} /></section>
    {privacySections.map((s, i) => <Section key={i} section={s}>
      {s.title.startsWith('第3条') && <ul className="list-disc space-y-2 pl-5">{aiDataPolicyLinks.map(link => <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer" className="text-fl-slate underline">{link.title}</a></li>)}</ul>}
      {s.title.startsWith('第4条') && <><Rows headers={['委託先', '委託すること', '国']} rows={processors} /><p>{crossBorderNotice}</p></>}
      {s.title.startsWith('第9条') && <><Rows headers={['送信先', '送られる情報', '目的', '止める方法']} rows={[
        ['Google LLC（Googleアナリティクス）', '開いたページ、端末・ブラウザの情報、IPアドレス、Cookieなどの識別子', '利用状況の分析', 'Googleアナリティクス オプトアウト アドオン'],
        ['Google LLC（Google Fonts）', 'IPアドレス、ブラウザの情報', '文字の書体の表示', 'ブラウザの設定で外部の書体を止める'],
      ]} /><a href="https://tools.google.com/dlpage/gaoptout?hl=ja" target="_blank" rel="noreferrer" className="text-fl-slate underline">Googleアナリティクス オプトアウト アドオン</a><p>相談文、生年月日、相手の情報は、これらの送信先には送りません。</p></>}
    </Section>)}
  </Layout>
}
export function WebCommercePage() {
  return <Layout title="特定商取引法に基づく表記"><p className="m-0"><strong>現在、ブックの販売は準備中で、購入はできません。</strong>販売を始めるときは、本サービス上でお知らせします。</p>
    <dl className="m-0">{commerceRows.map(([label, text]) => <div key={label} className="space-y-2 border-b border-fl-line py-4"><dt className="font-medium text-fl-muted">{label}</dt><dd className="m-0">{text}</dd></div>)}</dl>
  </Layout>
}
