import { Link } from 'react-router-dom'
import { Footer, Page, PageTitle, PlainHeader } from '../components/ui'
import { WEB_SUPPORT_EMAIL, webSupportQuestions } from '../data/supportContent'

export function SupportPage() {
  return <Page>
    <PlainHeader />
    <PageTitle lead="このページはFATE LAB Web版のご案内です。">サポート・お問い合わせ</PageTitle>
    <article aria-label="Web版サポート" className="flex flex-col gap-7 break-words px-6 pt-6 text-sm leading-[1.9]">
      <section className="space-y-3 rounded-field border border-fl-line bg-white p-4">
        <h2 className="m-0 text-lg font-medium">お問い合わせ先</h2>
        <p className="m-0">温齋株式会社</p>
        <a href={`mailto:${WEB_SUPPORT_EMAIL}`} className="inline-flex min-h-[44px] items-center break-all text-fl-slate underline">{WEB_SUPPORT_EMAIL}</a>
        <p className="m-0 text-xs text-fl-muted">発生日時、お使いの端末・ブラウザ、画面に出たエラーをお知らせください。確認コード・パスワード・秘密キーや、相談文・相手の個人情報は送らないでください。画像を添える場合も、これらが写らないようにしてください。</p>
      </section>
      {webSupportQuestions.map(question => <section key={question.title} className="space-y-3">
        <h2 className="m-0 text-lg font-medium">{question.title}</h2>
        {question.paragraphs.map((text, index) => <p key={index} className="m-0">{text}</p>)}
      </section>)}
      <Link to="/restore" className="flex min-h-[44px] items-center text-fl-slate underline">別の端末から引き継ぐ</Link>
    </article>
    <Footer />
  </Page>
}
