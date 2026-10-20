"""UI comparison only. Local demo, no production requests."""
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

B = os.environ.get("MOCK_E2E_BASE_URL", "https://127.0.0.1:4320")
assert urlparse(B).hostname in ("localhost", "127.0.0.1")
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (320, 390, 1280):
        ctx = browser.new_context(ignore_https_errors=True, viewport={"width": width, "height": 900})
        ctx.route("**/*", lambda r: r.continue_() if urlparse(r.request.url).netloc == urlparse(B).netloc else r.abort())
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def preset(label):
            page.goto(B + "/demo")
            page.get_by_role("button", name=label, exact=False).first.click()
            page.wait_for_url(lambda url: urlparse(url).path != "/demo")
            page.locator("h1").wait_for()

        def layout():
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            assert page.locator("h1").evaluate("(el) => getComputedStyle(el).fontFamily.includes('Noto Sans JP')")
            assert not errors, errors

        preset("トップ（はじめて来た人）")
        expect(page.locator("#top-birthtime")).to_be_visible()
        expect(page.locator("#top-birthplace")).to_be_visible()
        assert page.locator("#top-birthplace").input_value() == ""
        assert page.locator('.fl-timeline-example li').count() == 3
        assert page.locator('#top-birthdate select').count() == 3
        assert page.locator('.fl-hero img').count() == 0
        for field in page.locator('#start input, #start select').all():
            assert field.evaluate('(e) => e.getBoundingClientRect().right <= document.querySelector("#start").getBoundingClientRect().right')
        assert page.get_by_role("heading", name="料金", exact=True).count() == 0
        assert page.locator("details").count() == 0
        layout()
        if os.environ.get("UI_SCREENSHOT_DIR"):
            output = Path(os.environ["UI_SCREENSHOT_DIR"])
            output.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(output / f"top-{width}.png"), full_page=True)
        preset("あなた")
        assert page.locator(".fl-chapters").evaluate("(el) => !!(el.compareDocumentPosition(document.querySelector('.fl-year-section')) & Node.DOCUMENT_POSITION_FOLLOWING)")
        assert page.locator(".fl-year-section").evaluate("(el) => !!(el.compareDocumentPosition(document.querySelector('.fl-year-feature')) & Node.DOCUMENT_POSITION_FOLLOWING)")
        assert page.locator(".fl-chapter-preview").count() > 0
        assert page.get_by_role("link", name="相性・相手との年表はこちら", exact=False).count() == 1
        layout()
        if os.environ.get("UI_SCREENSHOT_DIR"):
            output = Path(os.environ["UI_SCREENSHOT_DIR"])
            output.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(output / f"you-{width}.png"), full_page=True)
        # Returning to the landing page must offer fresh input even with a reading.
        page.goto(B + "/")
        expect(page.locator("#start")).to_be_visible()
        expect(page.get_by_text("おかえりなさい", exact=True)).to_have_count(0)
        expect(page.get_by_role("link", name="つづきを読む", exact=True)).to_have_count(0)
        expect(page.get_by_role("button", name="生年月日を入れて読む", exact=True)).to_be_visible()
        layout()
        preset("ふたりの年表")
        assert page.locator(".fl-timeline-choice").first.evaluate("(el) => !!(el.compareDocumentPosition(document.querySelector('.fl-year-feature')) & Node.DOCUMENT_POSITION_FOLLOWING)")
        page.locator(".fl-timeline-choice").first.click()
        expect(page.locator(".fl-timeline-choice").first).to_have_attribute("aria-pressed", "true")
        layout()
        for path in ("/terms", "/privacy", "/tokushoho"):
            page.goto(B + path)
            page.locator("h1").wait_for()
            assert len(page.locator("body").inner_text()) > 300
            layout()
        page.goto(B + "/settings/link?purpose=save")
        page.get_by_role("heading", name="新規登録（無料）で鑑定を保存").wait_for()
        layout()
        ctx.close()
        print(f"PASS UI refinement {width}px", flush=True)
    browser.close()
