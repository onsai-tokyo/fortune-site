import { saveGuideBirthDate } from '/assets/fl-guide-birthdate-draft.js'

const form = document.querySelector('#guide-reading form')
if (form) {
  const input = form.querySelector('input[type="date"]')
  const feedback = form.querySelector('[role="status"]')
  input.max = new Date().toISOString().slice(0, 10)
  input.addEventListener('input', () => { feedback.textContent = '' })
  form.addEventListener('submit', event => {
    event.preventDefault()
    if (!form.reportValidity()) return

    if (!saveGuideBirthDate(input.value)) {
      feedback.textContent = 'このブラウザでは入力を引き継げません。下のリンクから鑑定に進めます。'
      document.querySelector('#guide-reading-fallback').hidden = false
      return
    }

    // The selected date is stored in this tab and never included in analytics or the URL.
    const destination = form.action
    window.gtag?.('event', 'guide_to_fortune', { page_path: location.pathname, link_url: destination })
    location.assign(destination)
  })

  form.hidden = false
  document.querySelector('#guide-reading-fallback').hidden = true
}
