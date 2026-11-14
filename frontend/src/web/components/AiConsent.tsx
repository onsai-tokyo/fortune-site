import { Link } from 'react-router-dom'
import { Note } from './ui'
import { IconDown } from './icons'

/**
 * iOS AIConsentSheet と同じ内容の同意表示。
 * 一度同意すると、このアカウントでの以後の相談・質問に適用（iOSと同じ）。
 * 本番では同意の版（AI_CONSENT_VERSION）を X-FateLab-AI-Consent ヘッダーで毎回送る。
 */
export function AiConsentNotice({ agreed, onChange, accepted }: { agreed: boolean; onChange: (v: boolean) => void; accepted: boolean }) {
  if (accepted) {
    return <p className="m-0 text-xs leading-[1.7] text-fl-muted">AIへの送信には同意済みです（<Link to="/terms" className="underline">利用規約</Link>）。</p>
  }
  return (
    <Note className="flex flex-col gap-2">
      <span>相談への答えをつくるため、相談文と読みもの（計算結果を含む）を Anthropic PBC（Claude API）へ送ります。ふたりの相談には相手の情報も含まれます。</span>
      <details className="group">
        <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-fl-slate [&::-webkit-details-marker]:hidden">
          送る内容をくわしく見る<IconDown size={14} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-2 pb-1 pt-1">
          <span><strong className="font-medium text-fl-ink">ブックをつくるとき：</strong>相談文、テーマ、もとにする読みものの本文、命式・計算結果</span>
          <span><strong className="font-medium text-fl-ink">ブックへの質問：</strong>質問文、最近の会話履歴、参照する文章・計算結果、保存した出生情報（生年月日・出生時刻・出生地・性別・呼び名など）</span>
          <span className="text-xs">送るのはブックの作成と質問の操作をしたときだけです。同意はこのあとの相談・質問にも適用されます。同意しなくても、保存済みの読みものは読めます。</span>
        </div>
      </details>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-medium text-fl-ink">
        <input type="checkbox" checked={agreed} onChange={e => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-fl-ink" />
        <span><Link to="/terms" className="underline">利用規約</Link>と、この送信に同意する</span>
      </label>
    </Note>
  )
}
