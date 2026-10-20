"""Local-only Web product flow checks; all external requests are blocked."""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4260')
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in [320, 390, 1280]:
        ctx = browser.new_context(ignore_https_errors=True, viewport={'width':width,'height':900})
        ctx.route('**/*', lambda r: r.continue_() if urlparse(r.request.url).netloc == urlparse(B).netloc else r.abort())
        page = ctx.new_page(); errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        def nav(path):
            page.evaluate('p=>{history.pushState({},"",p);dispatchEvent(new PopStateEvent("popstate"))}',path)
            page.wait_for_timeout(200)
        page.goto(B+'/you')
        page.locator('h1').wait_for()
        chapters=page.locator('a[href^="/you/chapters/"]')
        assert chapters.count() == 4 and chapters.locator('img').count() == 0
        first=chapters.first.locator('span.flex-1 > span').all_inner_texts()
        assert first == ['大切にしていること','あなたの芯'], first
        nav('/you/years/2025')
        page.get_by_role('button',name='本棚に保存する',exact=True).click()
        page.get_by_text('本棚に保存するには、無料のメール登録',exact=False).wait_for()
        assert '/settings/link?returnTo=' in page.url and 'purpose=save' in page.url
        assert page.get_by_text('本棚に保存するには、無料のメール登録',exact=False).count() == 1
        page.fill('#link-email','fixture@example.invalid')
        page.get_by_role('button',name='確認コードを送る',exact=True).click()
        page.fill('#link-code','12345678'); page.get_by_role('button',name='登録する',exact=True).click()
        page.get_by_role('link',name='読みものにもどる',exact=True).click()
        assert page.url.endswith('/you/years/2025')
        page.get_by_role('button',name='本棚に保存する',exact=True).click()
        assert page.get_by_role('button',name='保存を取り消す',exact=True).count() == 1
        nav('/books/saved'); assert page.get_by_text('2025年 手放して軽くなる',exact=False).count() == 1
        nav('/couple/p-misaki?year=2024')
        page.get_by_role('button',name='本棚に保存する',exact=True).click()
        assert page.get_by_role('button',name='保存を取り消す',exact=True).count() == 1
        nav('/books/b-distance/ask')
        assert page.url.endswith('/books/b-distance') and page.locator('#ask').count() == 0
        assert page.locator('a[href$="/ask"]').count() == 0
        nav('/demo'); page.get_by_role('button',name='ふたり（相手がいないとき）').click()
        page.locator('#pname').wait_for()
        assert page.locator('#pname').count() == 1 and page.locator('#pbirth').count() == 1
        assert page.locator('h1').count() == 1
        assert '了解を得た' not in page.locator('body').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        if width == 390: page.screenshot(path='/private/tmp/fatelab-couple-inline-20261020.png',full_page=True)
        nav('/demo'); page.get_by_role('button',name='トップ（はじめて来た人）').click()
        page.locator('#top-birthdate').wait_for()
        image=page.locator('img[src="/images/timeline-preview.svg"]')
        image.scroll_into_view_if_needed()
        page.wait_for_function('()=>{const e=document.querySelector("img[src=\\"/images/timeline-preview.svg\\"]");return e && e.complete && e.naturalWidth>0}')
        assert image.evaluate('(e)=>e.complete && e.naturalWidth>0')
        assert '質問が2回' not in page.locator('body').inner_text()
        page.get_by_text('出生時刻・出生地も入力する（任意）',exact=True).click()
        assert page.locator('#top-birthtime').is_visible() and page.locator('#top-birthplace option').count()==47
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print('PASS Web UI / registration gate / both saves / one answer / inline partner / timeline image',width)
        ctx.close()
    browser.close()
