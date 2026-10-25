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
    <section className="space-y-3 rounded-2xl bg-fl-surface p-5"><h2 className="m-0 text-lg font-medium">販売予定の価格・条件</h2><p className="m-0">相談のブックは、1冊1,000円（税込）、3冊セット1,980円（税込）での販売を予定しています。現在は購入できません。</p><Link to="/sales-conditions" className="inline-flex min-h-[44px] items-center text-fl-slate underline">販売予定条件を確認する</Link></section>
  </Layout>
}

export function SalesConditionsPage() {
  const rows = [
    ['商品名・内容', '相談のブック（デジタルコンテンツ）。占いの鑑定結果と利用者の相談内容をもとに、AIが個別の回答を作成します。ひとつの相談につき1冊を使用し、完成したブックをWeb上の本棚で閲覧できます。紙の本の発送はありません。Web版では追加質問は受け付けていません。'],
    ['販売予定価格', '1冊：1,000円（税込）\n3冊セット：1,980円（税込）\n3冊セットは3件の相談に利用できます。月額契約・自動更新はありません。'],
    ['商品代金以外の必要料金', 'インターネット接続にかかる通信料はお客さまのご負担です。'],
    ['支払方法・支払時期（予定）', 'クレジットカードによる都度払いを予定しています。購入時にお支払いいただきます。現在は決済を受け付けていません。利用可能な決済方法は、審査・接続確認後に正式にお知らせします。'],
    ['購入から提供まで（予定）', '決済の確認後、購入冊数をアカウントに反映します。利用者が相談を送信すると1冊を使用して生成し、通常数分で本棚にお届けします。内容や混雑状況により時間がかかる場合があります。冊数の購入だけではブックの生成は始まりません。'],
    ['未使用の冊数・閲覧（予定）', '購入した未使用の冊数に有効期限は設けない予定です。届いたブックは本サービスの提供期間中、本棚で読み返せます。アカウントを削除すると、ブックと未使用の冊数は元に戻せません。'],
    ['キャンセル・返金（予定）', 'デジタルコンテンツの性質上、お客さま都合による購入後のキャンセル・返品・返金は原則としてお受けしない予定です。ブックの生成に失敗した場合は、使用した1冊をアカウントに戻します。重複決済や当社の責任で提供できない場合は、状況を確認し返金等に対応します。法令に基づく権利を制限するものではありません。'],
    ['利用条件・動作環境', 'AIの相談ブック作成は18歳以上の方が対象です。インターネットに接続できるスマートフォンまたはパソコンのWebブラウザをご利用ください。メール登録によるアカウントの引き継ぎを推奨します。'],
    ['運営・お問い合わせ', '温齋株式会社\nonsai.tokyo@gmail.com\n事業者情報は「特定商取引法に基づく表記」をご確認ください。'],
  ]
  return <Layout title="相談のブックの販売予定条件">
    <p className="m-0 rounded-2xl bg-fl-surface p-5"><strong>現在は販売準備中で、購入・支払いはできません。</strong>このページは販売予定の商品と条件をご案内するものです。販売開始日と正式な条件は、開始前に特定商取引法に基づく表記・利用規約・購入画面に掲載します。</p>
    <dl className="m-0">{rows.map(([label, text]) => <div key={label} className="space-y-2 border-b border-fl-line py-4"><dt className="font-medium text-fl-muted">{label}</dt><dd className="m-0 whitespace-pre-line">{text}</dd></div>)}</dl>
    <p className="m-0">本商品は占いをもとにした読みものです。将来の出来事・効果・結果や、AIの回答の正確性を保証するものではありません。医療・法律・投資などの専門的な助言に代わるものではありません。</p>
    <Link to="/tokushoho" className="text-fl-slate underline">特定商取引法に基づく表記へ</Link>
  </Layout>
}
