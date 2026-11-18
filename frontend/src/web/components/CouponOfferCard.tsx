import { coconalaBannerContent } from '../data/coconalaBanner.js'
import '../coconala-banner.css'
import { trackThreadsEvent } from '../data/threadsMeasurement'
import { IconChevron } from './icons'
import type { CouponOffer } from '../data/couponOffers'

export function CouponOfferCard({ offer }: { offer: CouponOffer }) {
  const headingId = `coupon-${offer.id}`
  const adHtml = offer.adHtml?.trim()

  if (offer.id === 'coconala-phone') return (
    <>
      <article className="fl-coconala-coupon" data-channel={offer.channel} aria-labelledby={headingId}>
        <h2 id={headingId} className="sr-only">{offer.name}</h2>
        <div className="fl-coconala-banner fl-ticket-ad" onClick={event => {
          if (event.target instanceof Element && event.target.closest('a[href]')) {
            trackThreadsEvent('coupon_click', { link_type: 'affiliate', offer_id: offer.id })
          }
        }} dangerouslySetInnerHTML={{ __html: coconalaBannerContent }} />
      </article>
      <p className="fl-ticket-note">リンク経由の申込みなどに応じて、FATE LABが報酬を受け取る場合があります。</p>
    </>
  )

  return (
    <>
      <article className="fl-ticket" data-channel={offer.channel} aria-labelledby={headingId}>
        <div className="fl-ticket-face">
          <div className="fl-ticket-body">
            {adHtml && <span className="fl-ticket-ad-label">PR・広告</span>}
            <h2 id={headingId}>{offer.name}</h2>
            <p className="fl-ticket-value">
              {offer.prefix && <span>{offer.prefix}{' '}</span>}
              <strong>{offer.amount}</strong>
              {offer.unit && <span>{' '}{offer.unit}</span>}
            </p>
            {offer.example && <p className="fl-ticket-example">{offer.example}</p>}
          </div>
          <div className="fl-ticket-stub" aria-hidden="true">
            <span className="fl-ticket-number">{offer.no}</span>
            <span className="fl-ticket-vertical">初回特典</span>
          </div>
        </div>
        <div className="fl-coupon-cta" onClick={event => {
          const link = event.target instanceof Element ? event.target.closest('a[href]') : null
          if (link) trackThreadsEvent('coupon_click', {
            link_type: link.closest('.fl-ticket-ad') ? 'affiliate' : 'official',
            offer_id: offer.id,
          })
        }}>
          {offer.compactTerms ? (
            <p className="fl-ticket-compact-terms">{offer.compactTerms} {offer.facts.validity}。</p>
          ) : (<>
            <dl className="fl-ticket-facts">
              <dt>対象</dt>
              <dd>{offer.facts.target}</dd>
              <dt>条件</dt><dd>{offer.facts.terms}</dd>
              <dt>期限</dt><dd>{offer.facts.validity}</dd>
            </dl>
            <p className="mb-3 mt-0 rounded-lg bg-fl-surface px-3 py-2.5 text-[13px] leading-relaxed text-fl-body">
              <strong className="mb-0.5 block text-fl-ink">特典の使い方</strong>
              {offer.redemption}
            </p>
          </>)}
          {offer.compactTerms && adHtml && (
            <p className="mb-1.5 mt-0 text-[13px] font-medium text-fl-ink">特典を見るには、下のボタンをタップ</p>
          )}
          {adHtml ? (
            <div className={offer.compactTerms ? "fl-ticket-ad fl-ticket-ad-compact" : "fl-ticket-ad"} dangerouslySetInnerHTML={{ __html: offer.adHtml! }} />
          ) : (
            <a href={offer.officialDetailsUrl} target="_blank" rel="noopener noreferrer">
              クーポンを今すぐ使う<span aria-hidden="true"><IconChevron size={18} /></span>
            </a>
          )}
        </div>
      </article>
      {adHtml && (
        <p className="fl-ticket-note">リンク経由の申込みなどに応じて、FATE LABが報酬を受け取る場合があります。</p>
      )}
    </>
  )
}
