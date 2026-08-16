import { useNavigate } from 'react-router-dom'

const questions = [
  {
    title: '鑑定結果が表示されない場合',
    body: '通信環境を確認し、アプリを一度閉じてから再度お試しください。解決しない場合は、発生日時と画面の状況を添えてお問い合わせください。',
  },
  {
    title: '継続鑑定の購入・復元について',
    body: 'iOSアプリの「購入を復元」から、同じApple Accountで購入した継続鑑定を復元できます。購入状況はApp Storeのサブスクリプション管理画面でも確認できます。',
  },
  {
    title: '解約について',
    body: 'iPhoneの「設定」→ Apple Account →「サブスクリプション」からFate Labを選択して解約できます。解約後も現在の請求期間が終わるまでは利用できます。',
  },
  {
    title: 'アカウントと鑑定履歴について',
    body: '同じメールアドレスでログインすると、保存済みの鑑定履歴と質問履歴を確認できます。アカウント削除はアプリ内の設定画面から行えます。',
  },
]

export function SupportPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-navy">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-white/40 hover:text-white/70 transition-colors text-sm mb-4 flex items-center gap-1"
          >
            ← トップに戻る
          </button>
          <h1 className="text-white text-3xl font-bold mb-2">Fate Lab サポート</h1>
          <p className="text-white/50 text-sm">Support</p>
        </header>

        <div className="glass-card p-8 space-y-8">
          <section>
            <p className="text-white/70 text-sm leading-relaxed">
              Fate Labの鑑定、アカウント、継続鑑定に関するご案内です。
            </p>
          </section>

          {questions.map(question => (
            <section key={question.title}>
              <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">{question.title}</h2>
              <p className="text-white/70 text-sm leading-relaxed">{question.body}</p>
            </section>
          ))}

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">お問い合わせ</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              上記で解決しない場合は、以下のメールアドレスへお問い合わせください。
            </p>
            <a className="inline-block mt-3 text-accent hover:underline" href="mailto:support@fate-lab.com">
              support@fate-lab.com
            </a>
          </section>

          <nav className="flex flex-wrap gap-4 pt-2 text-sm">
            <button className="text-white/60 hover:text-white" onClick={() => navigate('/terms')}>利用規約</button>
            <button className="text-white/60 hover:text-white" onClick={() => navigate('/privacy')}>プライバシーポリシー</button>
            <button className="text-white/60 hover:text-white" onClick={() => navigate('/tokushohou')}>特定商取引法に基づく表記</button>
          </nav>
        </div>
      </div>
    </div>
  )
}
