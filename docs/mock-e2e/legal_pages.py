"""Local-only public Web legal page checks; no real auth or data writes."""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://localhost:4190')
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(ignore_https_errors=True, viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    for path, title in [('/terms', '利用規約（Web版）'), ('/privacy', 'プライバシーポリシー（Web版）'), ('/tokushoho', '特定商取引法に基づく表記')]:
        page.goto(B + path)
        page.get_by_role('heading', name=title, exact=True).wait_for()
        article = page.locator('article')
        text = article.inner_text()
        assert '温齋株式会社' in text and 'この下書きについて' not in text
        assert 'onsai.tokyo@gmail.com' in text
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), path
        if path == '/terms':
            assert article.get_by_role('heading', level=2).count() == 16
            assert '現在、ブックの販売は準備中で、購入はできません' in text
            assert page.locator('#ai-consultation').count() == 1
        elif path == '/privacy':
            assert article.get_by_role('heading', level=2).count() == 12
            assert 'Resend（Plus Five Five, Inc.）' in text and '日本・東京、ap-northeast-1' in text
            assert '本サービス内の冊数と購入の記録も消えます' in text
        else:
            assert '現在、ブックの販売は準備中で、購入はできません' in text
        print('PASS', path, 'public / content / no horizontal overflow')
    page.goto(B + '/tokushohou')
    page.get_by_role('heading', name='アプリ向け文書の保存版', exact=True).wait_for()
    assert urlparse(page.url).path == '/tokushohou'
    assert not errors, errors
    print('PASS legacy commerce URL retains app reference document; pageerrors []')
    browser.close()
