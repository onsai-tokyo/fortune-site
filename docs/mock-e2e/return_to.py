"""Router v7 returnTo regression in the local demo build; no real authentication."""
import os
from urllib.parse import quote, urlparse
from playwright.sync_api import sync_playwright
B = os.environ.get('MOCK_E2E_BASE_URL', 'https://localhost:4175')
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(ignore_https_errors=True)
    page = context.new_page()
    errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
    def nav(path):
        page.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}", path)
        page.wait_for_timeout(350)
    # Onboarding: decoded backslash and nested encoding must not become an external URL.
    page.goto(B + '/demo'); page.get_by_role('button', name='トップ（はじめて来た人）').click()
    nav('/welcome?returnTo=' + quote('/%255cevil.invalid', safe=''))
    page.fill('#birthdate', '1994-05-12'); page.get_by_role('button', name='女性', exact=True).click()
    page.get_by_role('button', name='同意して、無料で読む').click()
    page.wait_for_url(B + '/you')
    # Creating consumer also handles crafted direct URLs, not only onboarding output.
    nav('/creating?returnTo=' + quote('/\\evil.invalid', safe=''))
    page.wait_for_url(B + '/you')
    # Restore consumer with a protocol-relative target.
    nav('/restore?returnTo=' + quote('//evil.invalid', safe=''))
    page.fill('#restore-email', 'synthetic@example.invalid'); page.get_by_role('button', name='コードを送る').click()
    page.fill('#restore-code', '1234567890'[:int(os.environ.get('MOCK_E2E_OTP_LENGTH', '8'))]); page.get_by_role('button', name='引き継ぐ', exact=True).click()
    page.wait_for_url(B + '/books')
    # Legitimate app deep link and query remain available after editing birth info.
    nav('/welcome?returnTo=' + quote('/compose?source=you-2026', safe=''))
    page.get_by_role('button', name='保存する', exact=True).click()
    page.wait_for_url(B + '/compose?source=you-2026')
    assert urlparse(page.url).netloc == urlparse(B).netloc and not errors
    print('PASS onboarding / creating / restore reject unsafe returnTo; valid query retained; pageerrors []')
    browser.close()
