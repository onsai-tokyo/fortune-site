import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmailCode } from '../components/EmailCode'
import { NatureImage, Note, Page, PlainHeader } from '../components/ui'
import { images } from '../data/images'
import { useApp } from '../state/AppState'
import { safeReturnTo } from '../../lib/safeReturnTo'
import { EMAIL_OTP_LENGTH } from '../../lib/emailOtpConfig'
import { AccountLogin } from '../components/AccountLogin'

/** 別の端末で使っていた本棚を開く（ログイン画面の代わり。パスワードなし） */
export function RestorePage() {
  const { session, restore } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = params.get('returnTo')
  const next = safeReturnTo(returnTo, '/books')

  return (
    <Page>
      <PlainHeader />
      <NatureImage src={images.welcomeSky} alt="雲の上に浮かぶ月" className="h-[160px]" position="center 20%" />
      <section className="fl-page-title flex flex-col gap-3 px-6 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">ログイン</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">登録したメールアドレスに届く{EMAIL_OTP_LENGTH}桁のコードで、あなたの本棚を開きます。パスワードを設定済みの方やGoogleをお使いの方は、下の方法も選べます。</p>
      </section>
      <section className="flex flex-col gap-4 px-6 pb-12 pt-4">
        {session === 'anonymous' && (
          <Note>ログインすると、この端末のアカウントが切り替わります。いま読んでいる内容はメール未登録のため、あとから開けなくなることがあります。残したい場合は、先に「設定」からメールを登録してください。</Note>
        )}
        <EmailCode idPrefix="restore" sendLabel="コードを送る" verifyLabel="ログイン" onVerified={email => { restore(email); navigate(next) }} />
        <AccountLogin anonymous={session === 'anonymous'} />
        <p className="m-0 text-xs leading-[1.8] text-fl-muted">アプリの購入冊数・会員権限をWebへ移す操作ではありません。初めての方は<Link to="/" className="underline">無料の鑑定をはじめる</Link>からお進みください。お困りのときは<Link to="/support" className="underline">お問い合わせ</Link>ください。</p>
      </section>
    </Page>
  )
}
