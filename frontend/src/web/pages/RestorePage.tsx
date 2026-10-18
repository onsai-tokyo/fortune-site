import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmailCode } from '../components/EmailCode'
import { NatureImage, Note, Page, PlainHeader } from '../components/ui'
import { images } from '../data/images'
import { useApp } from '../state/AppState'
import { safeReturnTo } from '../../lib/safeReturnTo'
import { EMAIL_OTP_LENGTH } from '../../lib/emailOtpConfig'

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
      <section className="flex flex-col gap-3 px-6 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">別の端末から引き継ぐ</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">引き継ぎ用に登録したメールアドレスを入れてください。届いた{EMAIL_OTP_LENGTH}桁のコードを入れると、同じ本棚と残りの冊数がこの端末でも開けます。</p>
      </section>
      <section className="flex flex-col gap-4 px-6 pb-12 pt-4">
        {session === 'anonymous' && (
          <Note>この端末で今使っている内容は、メールが登録されていないため、引き継ぐと見られなくなります。この端末の内容を残したい場合は、先に「設定」から引き継ぎ用のメールを登録してください。</Note>
        )}
        <EmailCode idPrefix="restore" sendLabel="コードを送る" verifyLabel="引き継ぐ" onVerified={email => { restore(email); navigate(next) }} />
        <p className="m-0 text-xs leading-[1.8] text-fl-muted">メールを登録していない場合や、iPhoneアプリで使っていた内容は引き継げません。お困りのときは<Link to="/support" className="underline">お問い合わせ</Link>ください。</p>
      </section>
    </Page>
  )
}
