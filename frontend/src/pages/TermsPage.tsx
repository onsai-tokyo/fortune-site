import { useNavigate } from 'react-router-dom'

export function TermsPage() {
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
          <h1 className="text-white text-3xl font-bold mb-2">利用規約</h1>
          <p className="text-white/50 text-sm">Terms of Service</p>
        </header>

        <div className="glass-card p-8 space-y-8">

          <section>
            <p className="text-white/70 text-sm leading-relaxed">
              本利用規約（以下「本規約」）は、Fate Lab運営事務局（以下「当社」）が提供する統合占いサービス「Fate Lab」（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆様には、本規約に同意いただいた上で本サービスをご利用いただきます。
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第1条（適用）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されます。</p>
              <p>当社は本サービスに関し、本規約のほか、ご利用にあたってのルール等、各種の定め（以下「個別規定」）をすることがあります。これら個別規定はその名称のいかんに関わらず、本規約の一部を構成するものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第2条（利用登録）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>本サービスにおいては、登録希望者が本規約に同意の上、当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。</p>
              <p>当社は、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあります。</p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-white/60">
                <li>虚偽の事項を届け出た場合</li>
                <li>本規約に違反したことがある者からの申請である場合</li>
                <li>その他、当社が利用登録を相当でないと判断した場合</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第3条（ユーザーIDおよびパスワードの管理）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>ユーザーは、自己の責任において、本サービスのユーザーIDおよびパスワードを適切に管理するものとします。</p>
              <p>ユーザーは、いかなる場合にも、ユーザーIDおよびパスワードを第三者に譲渡または貸与し、もしくは第三者と共用することはできません。</p>
              <p>当社は、ユーザーIDとパスワードの組み合わせが登録情報と一致してログインされた場合には、そのユーザーIDを登録しているユーザー自身による利用とみなします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第4条（利用料金および支払方法）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>ユーザーは、本サービスの有料部分の対価として、当社が別途定め、本ウェブサイトに表示する利用料金を、当社が指定する方法により支払うものとします。</p>
              <p>ユーザーが利用料金の支払を遅滞した場合には、ユーザーは年14.6％の割合による遅延損害金を支払うものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第5条（禁止事項）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-white/60">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>当社のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                <li>当社のサービスの運営を妨害するおそれのある行為</li>
                <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
                <li>不正アクセスをし、またはこれを試みる行為</li>
                <li>他のユーザーに成りすます行為</li>
                <li>当社のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
                <li>本サービスのコンテンツを無断で複製・転載・商用利用する行為</li>
                <li>その他、当社が不適切と判断する行為</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第6条（本サービスの提供の停止等）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。</p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-white/60">
                <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
                <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
                <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                <li>その他、当社が本サービスの提供が困難と判断した場合</li>
              </ul>
              <p>当社は、本サービスの提供の停止または中断により、ユーザーまたは第三者が被ったいかなる不利益または損害についても、責任を負わないものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第7条（著作権）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>本サービスにおいて当社が提供するコンテンツ（テキスト、画像、プログラム等）の著作権は当社または正当な権利者に帰属します。</p>
              <p>ユーザーは、本サービスで生成された鑑定結果を個人的な用途に限り使用できますが、商業目的での利用や第三者への再配布は禁止します。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第8条（免責事項）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>本サービスは複数の占術データを固定ルールで統合した参考情報を提供するものであり、将来の結果を保証するものではありません。</p>
              <p>当社は、本サービスに起因してユーザーに生じたあらゆる損害について、当社の故意または重過失による場合を除き、一切の責任を負いません。</p>
              <p>当社は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第9条（サービス内容の変更等）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>当社は、ユーザーへの事前の告知をもって、本サービスの内容を変更、追加または廃止することがあり、ユーザーはこれを承諾するものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第10条（利用規約の変更）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>当社は以下の場合には、ユーザーの個別の同意を要せず、本規約を変更することができるものとします。</p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-white/60">
                <li>本規約の変更がユーザーの一般の利益に適合するとき</li>
                <li>本規約の変更が本サービス利用契約の目的に反せず、かつ、変更の必要性、変更後の内容の相当性その他の変更に係る事情に照らして合理的なものであるとき</li>
              </ul>
              <p>当社はユーザーに対し、前項による本規約の変更にあたり、事前に、本規約を変更する旨および変更後の本規約の内容並びにその効力発生時期を通知します。</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3 border-b border-white/10 pb-2">第11条（準拠法・裁判管轄）</h2>
            <div className="text-white/70 text-sm space-y-2">
              <p>本規約の解釈にあたっては、日本法を準拠法とします。</p>
              <p>本サービスに関して紛争が生じた場合には、当社の所在地を管轄する裁判所を専属的合意管轄とします。</p>
            </div>
          </section>

        </div>

        <div className="mt-8 text-center">
          <p className="text-white/40 text-xs">最終更新日：2026年4月15日</p>
        </div>

      </div>
    </div>
  )
}
