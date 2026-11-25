import { captureBrowserVisit, observeContent } from './contentAttribution.js'
import { announceArrival, readTagIdentity, resetEngagement, resultPage, sendMeasurement } from './browserMeasurement.js'
import { articleOrigin } from './guideReadingMeasurement.js'
import { productionOrigin } from './measurementRules.js'
import { readingFocusPaths } from './readingFocus.js'

type MeasurementEvent = 'self_reading_complete' | 'couple_reading_complete' | 'coupon_click' | 'coconala_banner_click'
type ClickFields = { link_type?: 'affiliate' | 'official'; offer_id?: string; cta_position?: string }
let previousRoute: string | undefined

export function startThreadsMeasurement() {
  if (location.origin !== productionOrigin) return
  captureBrowserVisit()
  readTagIdentity()
  announceArrival()
}

export function trackMeasurementRoute(path: string) {
  if (location.origin !== productionOrigin || previousRoute === path) return
  previousRoute = path
  observeContent(path)
  resetEngagement()
  const page = resultPage(path)
  if (!page || !['/', '/couple', '/coupons', '/welcome', '/you', '/threads-launch', ...readingFocusPaths].includes(page)) return
  sendMeasurement(page === '/coupons' ? 'coupon_view' : 'page_view', { page_path: page })
}

export function trackThreadsEvent(event: MeasurementEvent, fields: ClickFields = {}) {
  if (location.origin !== productionOrigin) return
  const position = fields.cta_position
  const resultBanner = event === 'coconala_banner_click' && resultPage(location.pathname) === '/you'
  const reading = event === 'couple_reading_complete' || position === 'couple_result' || (resultBanner && location.pathname.startsWith('/couple/')) ? 'couple'
    : event === 'self_reading_complete' || position === 'self_result' || position === 'year_result' || (resultBanner && location.pathname.startsWith('/you')) ? 'self' : undefined
  const article = reading || event === 'coconala_banner_click' ? articleOrigin(reading) : {}
  sendMeasurement(event, { ...article, ...(reading && { reading_type: reading }),
    page_path: resultPage(location.pathname), ...fields })
}
