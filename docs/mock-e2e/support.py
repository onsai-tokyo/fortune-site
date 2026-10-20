"""Public Web support checks. No auth/API requests or outgoing email."""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4198')
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(ignore_https_errors=True, viewport={'width': 390, 'height': 844})
    page.route('**/*', lambda r: r.continue_() if urlparse(r.request.url).netloc == urlparse(B).netloc and not urlparse(r.request.url).path.startswith('/api/') else r.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for path in ('/support', '/contact'):
        page.goto(B + path)
        page.get_by_role('heading', name='サポート・お問い合わせ', exact=True).wait_for()
        assert urlparse(page.url).path == '/support'
        text = page.locator('article').inner_text()
        assert page.locator('h1').count() == 1
        assert page.locator('article h2').count() == 8
        assert page.get_by_role('link', name='onsai.tokyo@gmail.com', exact=True).get_attribute('href') == 'mailto:onsai.tokyo@gmail.com'
        assert '販売は準備中' in text and '法定代理人の同意' in text
        assert '確認コード・パスワード・秘密キー' in text
        for old in ('support@fate-lab.com', 'App Store', 'Apple Account', 'サブスクリプション'):
            assert old not in text, old
        assert page.get_by_role('link', name='特定商取引法に基づく表記', exact=True).get_attribute('href') == '/tokushoho'
        assert page.get_by_role('link', name='ログイン', exact=True).get_attribute('href') == '/restore'
        for width in (320, 390):
            page.set_viewport_size({'width': width, 'height': 844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (path, width)
        print('PASS', path, 'approved contact / Web FAQ / mobile width / legal and restore links')
    page.get_by_role('link', name='特定商取引法に基づく表記', exact=True).click()
    page.get_by_role('heading', name='特定商取引法に基づく表記', exact=True).wait_for()
    assert urlparse(page.url).path == '/tokushoho'
    assert not errors, errors
    print('PASS Web commerce destination; pageerrors []')
    browser.close()
