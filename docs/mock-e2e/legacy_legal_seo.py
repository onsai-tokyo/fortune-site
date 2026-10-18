"""Local static and archived legal content; all external/API requests blocked."""
import os, json, re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
B=os.environ.get('MOCK_E2E_BASE_URL','https://127.0.0.1:4191')
root=Path(__file__).resolve().parents[2]
config=json.loads((root/'frontend/vercel.json').read_text())
with sync_playwright() as p:
    browser=p.chromium.launch(); ctx=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844})
    api=[]; errors=[]
    def route(r):
        if '/api/' in r.request.url: api.append(r.request.method); return r.abort()
        if not r.request.url.startswith(B+'/'): return r.abort()
        # Vite preview does not execute Vercel rewrites. Exercise the checked-in
        # SEO rule mapping against its actual generated artifact, not SPA HTML.
        path=urlparse(r.request.url).path.rstrip('/')
        for rule in config['rewrites']:
            if not rule['source'].startswith(('/guides','/tools','/about','/methodology','/editorial-policy','/press')): continue
            match=re.fullmatch(rule['source'].replace(':slug','([^/]+)'),path)
            if match:
                destination=rule['destination'].replace(':slug',match.group(1) if match.groups() else '')
                artifact=(root/'frontend/dist'/destination.lstrip('/')).resolve()
                assert artifact.is_relative_to((root/'frontend/dist').resolve()) and artifact.is_file()
                return r.fulfill(path=str(artifact),content_type='text/html; charset=utf-8')
        r.continue_()
    ctx.route('**/*',route); page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
    for path in ['/app-legal/terms','/app-legal/privacy','/app-legal/tokushohou','/tokushohou']:
        page.goto(B+path)
        page.get_by_role('heading',name='アプリ向け文書の保存版',exact=True).wait_for()
        doc=page.get_by_test_id('legacy-legal-document')
        assert len(doc.inner_text())>500
        assert '79da270' in page.locator('body').inner_text()
        assert page.locator('script[src*="stripe"]').count()==0
        assert doc.get_by_role('button').count()==0
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),path
    page.goto(B+'/app-legal/terms#ai-consultation'); page.locator('#ai-consultation').wait_for()
    assert page.locator('#ai-consultation a').get_attribute('href')=='/app-legal/privacy'
    for path in ['/terms','/privacy','/tokushoho']:
        page.goto(B+path); page.get_by_text('これはWeb版の文書です。',exact=False).wait_for()
        assert page.get_by_role('link',name='アプリ向け文書の保存版',exact=True).count()==1
    for path in ['/guides/','/guides/day-master','/tools/','/tools/day-master','/about','/methodology','/editorial-policy','/press']:
        response=page.goto(B+path)
        assert response and response.ok,path
        page.get_by_role('heading',level=1).first.wait_for()
        assert page.locator('script[src*="/assets/index-"]').count()==0,path
        assert page.locator('link[rel="canonical"]').get_attribute('href').rstrip('/')=='https://fate-lab.com'+path.rstrip('/'),path
        assert page.locator('a[href="/#form"]').count()==0,path
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),path
    assert not api and not errors,(api,errors)
    print('PASS archived legal 3 documents + old commerce URL / Web-app distinction / AI anchor / no Stripe/API / static SEO and canonical / mobile width')
    browser.close()
