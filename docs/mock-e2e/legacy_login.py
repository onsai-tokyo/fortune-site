"""Synthetic REMOTE build only. No real credentials/auth/backend requests."""
import os, json, time, base64
from urllib.parse import urlparse, parse_qs, quote
from playwright.sync_api import sync_playwright
B=os.environ.get('MOCK_E2E_BASE_URL','https://127.0.0.1:4192')
def segment(x): return base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
def session(name):
    uid=('1' if name=='a' else '2')*8+'-1111-4111-8111-111111111111'
    user={'id':uid,'email':name+'@example.invalid','is_anonymous':False,'aud':'authenticated','role':'authenticated','app_metadata':{},'user_metadata':{}}
    token=segment({'alg':'HS256'})+'.'+segment({'sub':uid,'exp':int(time.time())+3600})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
sessions={n:session(n) for n in ['a','b']}
with sync_playwright() as p:
    browser=p.chromium.launch(); ctx=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844})
    errors=[]; forbidden=[]; oauth=[]; attempts=[]; delayed=[]; hold={'a':False}
    def route(r):
        req=r.request; parsed=urlparse(req.url); path=parsed.path
        if parsed.netloc=='mock.invalid':
            if path=='/auth/v1/token':
                assert parse_qs(parsed.query).get('grant_type')==['password']
                data=req.post_data_json; attempts.append(True)
                if data['password']!='synthetic-password': return r.fulfill(status=400,json={'error':'invalid_grant','error_description':'Invalid login credentials'})
                name=data['email'].split('@')[0]; return r.fulfill(json=sessions[name])
            if path=='/auth/v1/user':
                name='b' if sessions['b']['access_token'] in req.headers.get('authorization','') else 'a'
                return r.fulfill(json=sessions[name]['user'])
            if path=='/auth/v1/authorize':
                oauth.append(parse_qs(parsed.query)); return r.fulfill(content_type='text/html',body='<h1>OAuth fixture</h1>')
            forbidden.append(path); return r.abort()
        if path.startswith('/api/'):
            if req.method!='GET': forbidden.append(path); return r.abort()
            name='b' if sessions['b']['access_token'] in req.headers.get('authorization','') else 'a'
            if path=='/api/web/books/status' and name=='a' and hold['a']:
                delayed.append(r); return
            if path=='/api/web/reading/conversations':
                return r.fulfill(json={'conversations':[] if name=='b' else [{'id':'owned','kind':'self','title':'Aの鑑定','birth_data':{'birthDate':'1994-05-12','nickname':'Aだけの名前'}}]})
            if path=='/api/web/books/status': return r.fulfill(json={'remaining':0})
            if path=='/api/web/books': return r.fulfill(json={'books':[]})
            if path=='/api/web/partners': return r.fulfill(json={'partners':[]})
            if path=='/api/web/reading/saves': return r.fulfill(json={'saves':[]})
            if path.startswith('/api/web/reading/'): return r.fulfill(json={'cards':[]})
            if path.endswith('/cards'): return r.fulfill(json={'cards':[{'id':'ok','title':'許可された章','pages':[{'text':name+'の本人本文'}]}]})
            return r.fulfill(json={'conversation':{'id':'owned','title':name+'の鑑定'},'messages':[]})
        if parsed.netloc!=urlparse(B).netloc: return r.abort()
        r.continue_()
    ctx.route('**/*',route); page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
    ctx.add_init_script('localStorage.setItem("fatelab:web:compose-draft:v1", "UNSCOPED_FIXTURE_MUST_NOT_COPY")')
    def nav(path): page.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}",path)
    def fill(name,pw='synthetic-password'):
        page.get_by_label('メールアドレス',exact=True).fill(name+'@example.invalid'); page.get_by_label('パスワード',exact=True).fill(pw)
        page.get_by_role('button',name='ログインする',exact=True).click()
    page.goto(B+'/legacy/login?returnTo='+quote('/reading/owned?checkout=success',safe=''))
    fill('a','wrong-fixture'); page.get_by_role('alert').filter(has_text='ログインできませんでした').wait_for()
    fill('a'); page.wait_for_url(B+'/reading/owned'); page.get_by_text('aの本人本文',exact=True).wait_for()
    nav('/settings'); page.get_by_text('Aだけの名前',exact=False).first.wait_for()
    nav('/compose'); page.locator('#question').wait_for()
    assert 'UNSCOPED_FIXTURE_MUST_NOT_COPY' not in page.locator('#question').input_value()
    page.locator('#question').fill('Aの下書きだけ')
    assert page.evaluate('(id)=>localStorage.getItem("fatelab:web:compose-draft:v1:"+id)',sessions['a']['user']['id'])=='Aの下書きだけ'
    # Refresh A in flight, then log in as B in the same mounted Web application.
    hold['a']=True
    page.evaluate('(s)=>{const c=new BroadcastChannel("sb-mock-auth-token");c.postMessage({event:"SIGNED_IN",session:s});c.close()}',sessions['a'])
    page.wait_for_timeout(300)
    assert delayed, 'fixture must hold an old-owner request'
    nav('/legacy/login?returnTo='+quote('/reading/owned',safe='')); fill('b')
    page.wait_for_url(B+'/reading/owned'); page.get_by_text('bの本人本文',exact=True).wait_for()
    for r in delayed: r.fulfill(json={'remaining':99})
    nav('/you'); page.wait_for_url(B+'/welcome?returnTo=%2Fyou')
    assert 'Aだけの名前' not in page.locator('body').inner_text()
    nav('/legacy/login?returnTo='+quote('//evil.invalid',safe='')); fill('b'); page.wait_for_url(B+'/')
    nav('/legacy/login?returnTo='+quote('/reading/owned',safe=''))
    page.get_by_role('button',name='Googleでログイン',exact=True).click()
    page.get_by_role('heading',name='OAuth fixture').wait_for()
    target=urlparse(oauth[-1]['redirect_to'][0]); assert target.netloc==urlparse(B).netloc and target.path=='/legacy/login'
    assert parse_qs(target.query)['returnTo']==['/reading/owned']
    assert not forbidden and not errors, (forbidden,errors)
    print('PASS password failure/success / no signup-reset-payment / safe return / Google callback target / account switch clears A / stale A response discarded')
    browser.close()
