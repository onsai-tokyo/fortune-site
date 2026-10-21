"""Local-only synthetic REMOTE acceptance for partner/about and future years."""
import os, json, base64, time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4337')
assert urlparse(B).hostname in ('localhost', '127.0.0.1')
def enc(v): return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
uid = '11111111-1111-4111-8111-111111111111'
source = '22222222-2222-4222-8222-222222222222'
partner = '33333333-3333-4333-8333-333333333333'
user = dict(id=uid, email='fixture@example.invalid', is_anonymous=False, aud='authenticated', role='authenticated', app_metadata={}, user_metadata={})
token = enc({'alg':'HS256'})+'.'+enc({'sub':uid,'exp':int(time.time())+3600})+'.fixture'
session = dict(access_token=token, refresh_token='fixture', expires_at=int(time.time())+3600, expires_in=3600, token_type='bearer', user=user)
year = time.localtime().tm_year
def card(id, title): return dict(id=id, title=title, kind='essence', sections=[dict(heading='特徴', body=title+'の個別の本文。')])
self_card = card('personality-1', '本人の鑑定')
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True, viewport={'width':390,'height':844})
    ctx.add_init_script("localStorage.setItem('sb-mock-auth-token',"+json.dumps(json.dumps(session))+")")
    history=[]; errors=[]; flags={'partner':True,'aboutFail':False,'futureFail':False}
    def route(r):
        u=urlparse(r.request.url); path=u.path
        if u.netloc=='mock.invalid': return r.fulfill(json=user) if path=='/auth/v1/user' else r.abort()
        if u.netloc!=urlparse(B).netloc: return r.abort()
        if not path.startswith('/api/'): return r.continue_()
        assert r.request.headers.get('authorization')=='Bearer '+token
        if path.endswith('/preview/generate'): return r.fulfill(content_type='text/event-stream',body='data: '+json.dumps({'type':'complete','report':{'version':3,'reportText':'fixture','cards':[self_card]}})+'\n\n')
        if path.endswith('/conversations'):
            if r.request.method=='POST':
                history[:]=[{'id':source,'kind':'self','birth_data':r.request.post_data_json['birthData']}]
                return r.fulfill(json={'id':source})
            return r.fulfill(json={'conversations':history})
        if path.endswith('/snapshots'): return r.fulfill(json={'snapshots':[]})
        if path.endswith('/saves'): return r.fulfill(json={'saves':[]})
        if path.endswith('/books'): return r.fulfill(json={'books':[]})
        if path.endswith('/status'): return r.fulfill(json={'remaining':0})
        if path.endswith('/partners'): return r.fulfill(json={'partners':[{'id':partner,'display_name':'相手テスト','birth_date':'1990-11-07','birth_time':'03:02:00','gender':'male','relationship_label':'友人','relationship_type':'friend'}] if flags['partner'] else []})
        if path.endswith('/timing-history'): return r.fulfill(json={'cards':[card(f'turning-year-{year}', '今年の本文')]})
        if path.endswith('/future-years'):
            return r.fulfill(status=503,json={}) if flags['futureFail'] else r.fulfill(json={'cards':[card(f'turning-year-{year+1}', '来年の本文')]})
        if path.endswith('/cards'): return r.fulfill(json={'cards':[self_card,card('personality-2','次の性格')]})
        if path.endswith('/couple-timeline'): return r.fulfill(json={'status':'ready','meetingYear':2024,'entries':[{'year':year,'contentStatus':'ready','card':card('couple-current','ふたりの本文')}]})
        if path.endswith('/about'):
            assert source in path and partner in path
            return r.fulfill(status=503,json={}) if flags['aboutFail'] else r.fulfill(json={'cards':[card('partner-personality','相手だけの鑑定')]})
        raise AssertionError(path)
    ctx.route('**/*',route)
    page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(B+'/welcome')
    for label,value in [('年','1995'),('月','02'),('日','20')]: page.get_by_label('生まれた'+label,exact=True).select_option(value)
    page.get_by_role('button',name='女性',exact=True).click()
    page.get_by_role('button',name='同意して、無料で読む',exact=True).click()
    page.wait_for_url(B+'/you')
    page.get_by_role('heading',name='本人の鑑定',exact=True).wait_for()
    expect(page.locator('.fl-reading-contents').get_by_role('link',name='相手について',exact=False)).to_be_visible()
    page.locator('.fl-year-navigation').get_by_role('link',name='来年',exact=False).click()
    expect(page.get_by_role('heading',name='来年の本文',exact=True)).to_be_visible()
    page.get_by_role('link',name='もどる',exact=True).click()
    flags['aboutFail']=True
    page.locator('.fl-reading-contents').get_by_role('link',name='相手について',exact=False).click()
    expect(page.get_by_role('alert')).to_be_visible()
    flags['aboutFail']=False; page.get_by_role('button',name='再読み込み',exact=True).click()
    page.get_by_text('相手について').count()
    page.locator('details summary').first.click()
    expect(page.get_by_text('相手だけの鑑定の個別の本文。',exact=True)).to_be_visible()
    assert page.get_by_text('本人の鑑定の個別の本文。',exact=True).count()==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    print('PASS synthetic REMOTE: future link/detail; partner selection; failure/retry; real partner body; no self/mock fallback')
    browser.close()
