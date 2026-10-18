import { useNavigate } from 'react-router-dom'
import { IconBack } from '../components/icons'
import { Footer, Note, Page } from '../components/ui'
import { plans } from '../data/mock'

const rows: [string, string][] = [
  ['販売事業者', '温齋株式会社'],
  ['運営責任者', '[代表者名]'],
  ['所在地', '[本店所在地]'],
  ['連絡先', '[問い合わせ用メールアドレス]\n[電話番号]（お問い合わせはメールでお願いします）'],
  ['販売価格', `${plans.map(p => `相談のブック ${p.name}：${p.price.toLocaleString()}円（税込）`).join('\n')}\n性格・相性・年ごとの読みものは無料です。`],
  ['商品代金以外の必要料金', 'インターネット接続にかかる通信料はお客様のご負担です。'],
  ['お支払い方法・時期', 'クレジットカード（[決済会社確定後に記載]）。ご購入時にお支払いいただきます。月額の契約や自動更新はありません。'],
  ['提供時期', '利用枠はお支払いの確認後すぐに反映されます。相談のブックは作成の受付後、通常数分でお届けします（混雑時はさらにお時間をいただく場合があります）。'],
  ['返品・キャンセル', 'デジタルコンテンツの性質上、購入後の返品・返金はお受けしていません。ブックの作成に失敗した場合は、使った1冊分をお戻しします。'],
  ['相談のブックの有効期限', '買った冊数に有効期限はありません。退会すると、残っている冊数は失われます。'],
  ['動作環境', '最新版のSafari、Google Chrome（スマートフォン・パソコン）'],
]

export function TokushohoPage() {
  const navigate = useNavigate()
  return (
    <Page>
      <header className="flex items-center gap-2 border-b border-fl-line px-3 py-1.5">
        <button type="button" aria-label="もどる" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-fl-surface"><IconBack /></button>
        <span className="text-[13px] font-medium tracking-[0.3em]">FATE LAB</span>
      </header>
      <section className="px-6 pb-2 pt-7"><h1 className="m-0 text-[24px] font-medium leading-[1.55]">特定商取引法に基づく表記</h1></section>
      <section className="px-6 pt-3">
        <dl className="m-0 flex flex-col">
          {rows.map(([dt, dd]) => (
            <div key={dt} className="flex flex-col gap-1.5 border-b border-fl-line py-4">
              <dt className="text-[13px] font-medium text-fl-muted">{dt}</dt>
              <dd className="m-0 whitespace-pre-line text-[15px] leading-[1.8]">{dd}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="px-6 pt-6"><Note className="text-xs">［角括弧］の項目は、決済会社・会社情報が決まってから記入してください。公開前に、内容を専門家に確認してもらうことをおすすめします。</Note></section>
      <Footer />
    </Page>
  )
}
