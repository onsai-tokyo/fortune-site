import { saveGuideBirthDate } from '/assets/fl-guide-birthdate-draft.js'
import { startGuideReading } from '/assets/guideReadingMeasurement.js'
import { isMeasurementTest } from '/assets/measurementRules.js'

const form = document.querySelector('#guide-reading form')
if (form) {
  const input = form.querySelector('input[type="date"]')
  const feedback = form.querySelector('[role="status"]')
  let analyticsClientId
  if (!isMeasurementTest(new URL(location.href))) {
    window.gtag?.('get', 'G-FPZ7QKTXLJ', 'client_id', id => { analyticsClientId = id })
  }
  input.max = new Date().toISOString().slice(0, 10)
  input.addEventListener('input', () => { feedback.textContent = '' })
  form.addEventListener('submit', event => {
    event.preventDefault()
    if (!form.reportValidity()) return

    const gender = new FormData(form).get('guide-gender')
    if (!saveGuideBirthDate(input.value, gender)) {
      feedback.textContent = 'このブラウザでは入力を引き継げません。下のリンクから鑑定に進めます。'
      document.querySelector('#guide-reading-fallback').hidden = false
      return
    }

    form.querySelector('button[type="submit"]').disabled = true
    // Keep the reading inputs in this tab, outside analytics and the URL.
    const destination = form.action
    startGuideReading(analyticsClientId)
    if (!isMeasurementTest(new URL(location.href))) {
      window.gtag?.('event', 'guide_to_fortune', { page_path: location.pathname, link_url: destination })
    }
    location.assign(destination)
  })

  // Re-enable the form when the browser restores this guide from its back/forward cache.
  window.addEventListener('pageshow', () => { form.querySelector('button[type="submit"]').disabled = false })
  form.hidden = false
  document.querySelector('#guide-reading-fallback').hidden = true
}
