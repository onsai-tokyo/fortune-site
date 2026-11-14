import { SiteHeader } from '../components/SiteHeader'
import { CouponOfferCard } from '../components/CouponOfferCard'
import { couponOffers } from '../data/couponOffers'
import { Footer, Page } from '../components/ui'

export function CouponsPage() {
  const hasAffiliateAds = couponOffers.some(offer => offer.adHtml?.trim())
  const phoneCount = couponOffers.filter(offer => offer.channel === 'phone').length
  const chatCount = couponOffers.length - phoneCount

  return (
    <Page>
      <SiteHeader current="coupons" />
      <main className="fl-coupons">
        <section className="fl-ticket-intro">
          <div className="fl-ticket-english flex items-baseline justify-between">
            <i lang="en">First Reading Tickets</i>
            <span lang="en">{String(couponOffers.length).padStart(2, '0')} TICKETS</span>
          </div>
          <h1>占いクーポン・初回特典</h1>
          <p>電話・チャット占いの初回特典を比較できます。</p>
        </section>
        <div className="fl-ticket-legend">
          <span data-channel="phone">電話占い {phoneCount}</span>
          <span data-channel="chat">チャット占い {chatCount}</span>
          {hasAffiliateAds && <span className="ml-auto">広告を含みます</span>}
        </div>
        <ul className="fl-ticket-list">
          {couponOffers.map(offer => <li key={offer.id}><CouponOfferCard offer={offer} /></li>)}
        </ul>
      </main>
      <Footer />
    </Page>
  )
}
