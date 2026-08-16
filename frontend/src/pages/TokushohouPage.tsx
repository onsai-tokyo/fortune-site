import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function TokushohouPage() {
  const navigate = useNavigate()
  const [monthlyPrice, setMonthlyPrice] = useState('料金ページおよび決済画面に表示')
  useEffect(() => { fetch('/api/stripe/plan').then(r => r.ok ? r.json() : null).then(plan => { if (plan?.unitAmount != null) setMonthlyPrice(`${Number(plan.unitAmount).toLocaleString('ja-JP')}円/月（税込）`) }).catch(() => {}) }, [])

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
          <h1 className="text-white text-3xl font-bold mb-2">特定商取引法に基づく表記</h1>
          <p className="text-white/50 text-sm">Specified Commercial Transaction Act</p>
        </header>

        <div className="glass-card p-8 space-y-8">

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">販売業者</h2>
            <p className="text-white/70 text-sm">温齋株式会社</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">運営責任者</h2>
            <p className="text-white/70 text-sm">温齋株式会社</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">所在地</h2>
            <p className="text-white/70 text-sm">東京都目黒区下目黒1丁目1番14号 コノトラビル7F</p>
            <p className="text-white/50 text-xs mt-1">※請求があった場合には遅滞なく開示いたします</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">お問い合わせ</h2>
            <p className="text-white/70 text-sm">メールアドレス：support@fate-lab.com</p>
            <p className="text-white/50 text-xs mt-1">※お問い合わせはメールにてお願いいたします</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">販売価格</h2>
            <div className="text-white/70 text-sm space-y-2">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span>無料鑑定書生成</span>
                <span className="text-accent font-semibold">無料</span>
              </div>
              <div className="flex justify-between py-2">
                <span>鑑定質問 継続利用プラン</span>
                <span className="text-white/80 font-semibold">{monthlyPrice}</span>
              </div>
            </div>
            <p className="text-white/50 text-xs mt-3">※詳細はトップページの料金セクションをご確認ください</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">支払方法</h2>
            <p className="text-white/70 text-sm">Apple App Store決済、またはウェブ版で案内する決済方法</p>
            <p className="text-white/50 text-xs mt-1">iOSアプリではApple Accountに設定された支払方法が利用されます</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">支払時期</h2>
            <div className="text-white/70 text-sm space-y-1">
              <p>月額サブスクリプション：毎月の契約更新日</p>
              <p>初回決済：契約開始時に即時決済</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">商品・サービスの提供時期</h2>
            <div className="text-white/70 text-sm space-y-1">
              <p>無料鑑定書：生成完了後、即時提供</p>
              <p>鑑定質問 継続利用プラン：決済完了後、即時提供</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">返品・キャンセルについて</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>本サービスはデジタルコンテンツのため、サービス提供後の返品・返金は原則としてお受けできません。</p>
              <p className="text-white/60 text-xs">※ただし、システムの不具合等により正常にサービスが提供されなかった場合は、個別に対応させていただきます。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">サブスクリプションの解約について</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>iOSアプリの契約は、Apple Accountのサブスクリプション管理画面からいつでも解約できます。解約しない限り月ごとに自動更新されます。</p>
              <p>解約後も現在の請求期間が終わるまでは利用でき、次回以降の課金は行われません。</p>
              <p className="text-white/60 text-xs">※日割り返金は行っておりません。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">動作環境</h2>
            <div className="text-white/70 text-sm space-y-1">
              <p>推奨ブラウザ：</p>
              <ul className="list-disc list-inside text-white/60 text-sm pl-2 space-y-0.5">
                <li>Google Chrome 最新版</li>
                <li>Safari 最新版</li>
                <li>Microsoft Edge 最新版</li>
                <li>Firefox 最新版</li>
              </ul>
              <p className="text-white/50 text-xs mt-2">※JavaScriptを有効にしてご利用ください</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">表現および商品に関する注意事項</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>本サービスは複数の占術データを固定ルールで統合した参考情報を提供するものであり、将来の結果を保証するものではありません。</p>
              <p>提供される情報は参考情報としてご活用いただき、最終的な判断はお客様ご自身でお願いいたします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">プライバシーポリシー</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>お客様の個人情報は、サービス提供の目的以外には使用いたしません。</p>
              <p>詳細は別途定めるプライバシーポリシーをご確認ください。</p>
            </div>
          </section>

        </div>

        <div className="mt-8 text-center">
          <p className="text-white/40 text-xs">最終更新日：2026年4月4日</p>
        </div>

      </div>
    </div>
  )
}
