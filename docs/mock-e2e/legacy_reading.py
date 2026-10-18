"""Local fixtures only: legacy owner reading and public summary stay GET-only."""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4191')
uid = '11111111-1111-4111-8111-111111111111'
def segment(x): return base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
session = {'access_token': segment({'alg':'HS256'})+'.'+segment({'sub':uid,'exp':int(time.time())+3600})+'.fixture', 'refresh_token':'fixture', 'token_type':'bearer', 'expires_at':int(time.time())+3600, 'expires_in':3600, 'user':{'id':uid,'aud':'authenticated','role':'authenticated','app_metadata':{},'user_metadata':{}}}

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True, viewport={'width':390,'height':844})
    writes, analytics, external, errors = [], [], [], []
    def route(r):
        request = r.request
        parsed = urlparse(request.url)
        if 'google-analytics' in parsed.netloc or 'googletagmanager' in parsed.netloc:
            analytics.append(True); return r.abort()
        if parsed.path.startswith('/api/'):
            if request.method != 'GET': writes.append(request.method); return r.abort()
            path = parsed.path
            if '/shares/' in path:
                if path.endswith('missing'): return r.fulfill(status=404,json={})
                return r.fulfill(json={'share':{'summary':{'tagline':'共有する要点だけ','elements':{'木':3},'birthDate':'SHOULD_NOT_RENDER'}}})
            assert request.headers.get('authorization','').startswith('Bearer ')
            if 'other' in path: return r.fulfill(status=404,json={})
            if path.endswith('/cards'):
                return r.fulfill(json={'cards':[{'id':'free','title':'無料の章','summary':'要約','pages':[{'label':'本文','text':'許可された本文'}]},{'id':'lock','title':'有料の章','access':{'locked':True},'summary':'LOCKED_SECRET','pages':[{'text':'LOCKED_SECRET'}]}]})
            return r.fulfill(json={'conversation':{'id':'owned','title':'以前の鑑定','report_text':'UNPROJECTED_SECRET'},'messages':[{'role':'assistant','content':'保存した回答'}]})
        if parsed.netloc != urlparse(B).netloc:
            external.append(parsed.netloc); return r.abort()
        return r.continue_()
    ctx.route('**/*',route)
    page=ctx.new_page(); page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto(B+'/s/fixture-share')
    page.get_by_text('共有する要点だけ',exact=True).wait_for()
    assert 'SHOULD_NOT_RENDER' not in page.locator('body').inner_text()
    page.goto(B+'/s/missing'); page.get_by_role('status').filter(has_text='見つからない').wait_for()
    page.goto(B+'/r/fixture-token'); page.get_by_role('status').filter(has_text='ログインが必要').wait_for()
    page.evaluate('(s)=>localStorage.setItem("sb-mock-auth-token",JSON.stringify(s))',session)
    for path in ['/r/fixture-token','/reading/owned']:
        page.goto(B+path)
        page.get_by_text('許可された本文',exact=True).wait_for()
        page.get_by_text('保存した回答',exact=True).wait_for()
        text=page.locator('body').inner_text()
        assert 'LOCKED_SECRET' not in text and 'UNPROJECTED_SECRET' not in text
        assert page.get_by_role('button',name='購入',exact=False).count()==0
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.goto(B+'/reading/other'); page.get_by_role('status').filter(has_text='閲覧する権限がありません').wait_for()
    assert '許可された本文' not in page.locator('body').inner_text()
    page.goto(B+'/reading/owned'); page.get_by_text('許可された本文',exact=True).wait_for()
    second=ctx.new_page(); second.goto(B+'/s/fixture-share')
    second.get_by_text('共有する要点だけ',exact=True).wait_for()
    second.evaluate('localStorage.removeItem("sb-mock-auth-token")')
    page.get_by_role('status').filter(has_text='アカウントが変わりました').wait_for()
    assert '許可された本文' not in page.locator('body').inner_text()
    assert not writes and not analytics and not errors, (writes,analytics,errors)
    print('PASS public summary / owner-only ID and token / locked redaction / other-user rejection / logout clears content / GET-only / no Analytics / mobile width')
    browser.close()
