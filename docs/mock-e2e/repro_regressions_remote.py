"""Six reported regressions. Synthetic REMOTE only; all external requests blocked.
Build with mock.invalid / mock-anon-key, then set MOCK_E2E_BASE_URL to localhost.
Assertions (not merely printed observations) make a failed case exit nonzero.
"""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4302')
assert urlparse(B).hostname in ('127.0.0.1', 'localhost'), 'local fixture only'
OWNER = '11111111-1111-4111-8111-111111111111'
SOURCE = '22222222-2222-4222-8222-222222222222'
BOOK = '33333333-3333-4333-8333-333333333333'
PARTNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
OP = '99999999-9999-4999-8999-999999999999'
Q = '最近仕事の進め方に迷っています。今年はどんな姿勢で取り組むとよいでしょうか。'
DRAFT = 'fatelab:web:compose-draft:v1:' + OWNER
PENDING = 'fatelab:web:pending-partner:' + OWNER + ':v1'
def seg(v): return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
def session(owner=OWNER):
    user = {'id':owner,'email':'reader@example.invalid' if owner==OWNER else 'other@example.invalid','is_anonymous':False,'aud':'authenticated','role':'authenticated','app_metadata':{},'user_metadata':{}}
    token = seg({'alg':'HS256'}) + '.' + seg({'sub':owner,'exp':int(time.time())+3600}) + '.fixture'
    return {'access_token':token,'refresh_token':'fixture','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
def card(cid, title): return {'id':cid,'title':title,'kind':'essence','scope':'self','summary':'要約','pages':[{'label':'本文','text':title+'の本文'}]}
def base(path, state):
    if path == '/api/web/reading/conversations': return {'conversations':[{'id':SOURCE,'kind':'self','birth_data':{'birthDate':'1990-01-15','gender':'female','birthplace':'東京都'}}]}
    if path == '/api/web/books/status': return {'remaining':state['credits'],'purchasedRemaining':state['credits']}
    if path == '/api/web/books': return {'books':state['books']}
    if path == '/api/web/partners': return {'partners':[{'id':PARTNER,'display_name':'相手A','birth_date':'1990-05-05','birthplace':'東京都','relationship_label':'友人','relationship_type':'friend','gender':'female'}] if state['partner'] else []}
    if path == '/api/web/reading/saves': return {'saves':[]}
    if path.endswith('/timing-history'): return {'cards':[card('turning-year-2026','合成の2026年')]}
    if path.endswith('/cards'): return {'cards':[card('personality-a','合成の性格の章')]}
    if 'couple-timeline' in path: return {'status':'ready','meetingYear':None,'entries':[]}
    return None

cases = ['validation-rejected','save-failed','save-held','save-owner-switch','logout-failed','logout-success','otp-once',
         'partner-cancelled','partner-completed','partner-cancel-failed','book-success','newer-draft','book-response-lost']
with sync_playwright() as p:
    browser = p.chromium.launch()
    for case in cases:
        ctx = browser.new_context(ignore_https_errors=True, viewport={'width':390,'height':844})
        s = session()
        seed = {} if case == 'otp-once' else {'sb-mock-auth-token':json.dumps(s), DRAFT:Q}
        if case.startswith('partner-'):
            seed[PENDING] = json.dumps({'version':2,'input':{'name':'相手B','relation':'友人','birthDate':'1991-02-03','birthTime':None,'birthPlace':'東京都','gender':'male','metYear':None},'operationId':OP,'oldPartnerId':None,'deleted':False})
        ctx.add_init_script('if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");const seed='+json.dumps(seed)+';for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v)}')
        calls, held, errors, unexpected = [], [], [], []
        state = {'credits':1,'books':[],'partner':case.startswith('partner-')}
        def route(r):
            req = r.request; u = urlparse(req.url); path = u.path
            if u.netloc == 'mock.invalid':
                calls.append((req.method,path,u.query))
                if path == '/auth/v1/user': return r.fulfill(json=s['user'])
                if path == '/auth/v1/logout': return r.fulfill(status=500,json={'msg':'fixture'}) if case == 'logout-failed' else r.fulfill(status=204,body='')
                if path == '/auth/v1/otp': return r.fulfill(json={})
                if path == '/auth/v1/verify': return r.fulfill(json=s)
                unexpected.append(path); return r.abort()
            if path.startswith('/api/'):
                calls.append((req.method,path,''))
                if path == '/api/web/books/validate':
                    return r.fulfill(status=422,json={'code':'BOOK_SOURCE','error':'この鑑定書には必要な原稿が揃っていません。'}) if case == 'validation-rejected' else r.fulfill(json={'valid':True})
                if path == '/api/web/books' and req.method == 'POST':
                    if case == 'book-response-lost': return r.abort('failed')
                    if case == 'newer-draft': held.append(r); return
                    state['credits'] = 0
                    state['books'] = [{'id':BOOK,'sourceId':SOURCE,'title':'届いたブック','theme':'時期の判断','question':Q,'state':'delivered','createdAt':'2026-10-20T00:00:00Z','document':{'title':'届いたブック','sections':[]}}]
                    return r.fulfill(status=201,json={'book':state['books'][0]})
                if '/books/operations/' in path: return r.fulfill(json={'book':state['books'][0] if state['books'] else None})
                if '/reading/saves/' in path and req.method == 'PUT':
                    if case in ('save-held','save-owner-switch'): held.append(r); return
                    return r.fulfill(status=503,json={'error':'fixture'})
                if path.endswith('/cancel'):
                    if case == 'partner-cancel-failed': return r.fulfill(status=503,json={'error':'fixture'})
                    return r.fulfill(json={'state':'completed' if case == 'partner-completed' else 'cancelled'})
                j = base(path, state)
                if j is not None and req.method == 'GET': return r.fulfill(json=j)
                unexpected.append((req.method,path)); return r.fulfill(status=404,json={})
            if u.netloc != urlparse(B).netloc: return r.abort()
            r.continue_()
        ctx.route('**/*',route)
        page = ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
        if case.startswith('logout-'):
            page.goto(B+'/settings')
            page.get_by_role('button',name='この端末での利用をやめる',exact=True).click()
            if case == 'logout-failed':
                expect(page.get_by_role('alert').filter(has_text='ログアウトできません')).to_be_visible(timeout=15000)
                assert page.url.endswith('/settings')
                assert page.evaluate('k=>localStorage.getItem(k)', DRAFT) == Q
                assert page.evaluate('localStorage.getItem("sb-mock-auth-token")')
            else:
                page.wait_for_url(B+'/')
                assert page.evaluate('k=>localStorage.getItem(k)', DRAFT) is None
                assert page.evaluate('localStorage.getItem("sb-mock-auth-token")') is None
            logout = [query for _,path,query in calls if path == '/auth/v1/logout']
            assert logout and all(query == 'scope=local' for query in logout), logout
        elif case == 'otp-once':
            page.goto(B+'/restore'); page.get_by_label('メールアドレス').fill('reader@example.invalid')
            page.get_by_role('button',name='コードを送る').click()
            page.get_by_label('確認コード',exact=False).fill('12345678')
            page.get_by_role('button',name='ログイン',exact=True).click()
            page.wait_for_url(B+'/books'); page.wait_for_timeout(300)
            assert len([1 for _,path,_ in calls if path == '/auth/v1/otp']) == 1
            assert len([1 for _,path,_ in calls if path == '/auth/v1/verify']) == 1
        elif case.startswith('partner-'):
            page.goto(B+'/couple/new'); expect(page.get_by_label('表示名')).to_have_value('相手B')
            page.get_by_role('button',name='未完了の登録を取り消して入力し直す',exact=True).click()
            if case == 'partner-cancelled':
                expect(page.get_by_label('表示名')).to_have_value('')
                assert page.evaluate('k=>localStorage.getItem(k)', PENDING) is None
                page.get_by_label('表示名').fill('相手C')
            else:
                expect(page.get_by_role('alert').filter(has_text='登録' if case == 'partner-completed' else 'fixture').last).to_be_visible()
                assert page.evaluate('k=>localStorage.getItem(k)', PENDING)
            assert not [x for x in calls if x[0] == 'DELETE' or (x[0] == 'POST' and x[1] == '/api/web/partners')]
        elif case.startswith('save-'):
            page.goto(B+'/you/years/2026'); page.get_by_role('button',name='本棚に保存する',exact=True).click()
            if case == 'save-failed':
                expect(page.get_by_role('alert').filter(has_text='保存できませんでした')).to_be_visible()
                expect(page.get_by_role('button',name='本棚に保存する',exact=True)).to_have_attribute('aria-pressed','false')
            else:
                deadline = time.time()+5
                while not held and time.time()<deadline: page.wait_for_timeout(30)
                assert held
                expect(page.get_by_role('button',name='本棚に保存する',exact=True)).to_be_disabled()
                if case == 'save-owner-switch':
                    page.evaluate('s=>{const c=new BroadcastChannel("sb-mock-auth-token");c.postMessage({event:"SIGNED_IN",session:s});c.close()}',session('55555555-5555-4555-8555-555555555555'))
                    page.wait_for_timeout(300)
                baseline = len(calls)
                held.pop().fulfill(json={'saved':True})
                if case == 'save-owner-switch':
                    page.wait_for_timeout(300)
                    expect(page.get_by_role('button',name='本棚に保存する',exact=True)).to_have_attribute('aria-pressed','false')
                    expect(page.get_by_role('button',name='本棚に保存する',exact=True)).to_be_enabled()
                else:
                    expect(page.get_by_role('button',name='保存を取り消す',exact=True)).to_have_attribute('aria-pressed','true')
                assert not [x for x in calls[baseline:] if x[0] == 'GET'], calls[baseline:]
                assert '合成の2026年の本文' in page.locator('body').inner_text()
        else:
            page.goto(B+'/compose'); expect(page.get_by_label('相談したいこと',exact=False)).to_have_value(Q)
            page.get_by_role('checkbox').check()
            page.get_by_role('button',name='一冊つくる',exact=False).click()
            if case == 'validation-rejected':
                expect(page.get_by_role('alert').filter(has_text='原稿が揃っていません')).to_be_visible()
                assert page.url.endswith('/compose')
                expect(page.get_by_label('相談したいこと',exact=False)).to_have_value(Q)
                assert not [x for x in calls if x[0] == 'POST' and x[1] == '/api/web/books']
                assert not page.evaluate('Object.keys(localStorage).some(k=>k.includes("pending-book"))')
                assert '残り1冊' in page.locator('body').inner_text()
            elif case == 'book-response-lost':
                expect(page.get_by_role('alert').filter(has_text='受付結果を確認できません')).to_be_visible()
                assert page.evaluate('Object.keys(localStorage).some(k=>k.includes("pending-book"))')
                expect(page.get_by_label('相談したいこと',exact=False)).to_have_value(Q)
                assert len([x for x in calls if x[0]=='POST' and x[1]=='/api/web/books']) == 1
            else:
                if case == 'newer-draft':
                    deadline = time.time()+5
                    while not held and time.time()<deadline: page.wait_for_timeout(30)
                    assert held
                    page.get_by_label('相談したいこと',exact=False).fill(Q+'新しい下書きです。')
                    state['credits'] = 0
                    state['books'] = [{'id':BOOK,'title':'届いたブック','question':Q,'state':'delivered','createdAt':'2026-10-20T00:00:00Z'}]
                    held.pop().fulfill(status=201,json={'book':state['books'][0]})
                page.wait_for_url(B+'/books')
                expect(page.get_by_text('届いたブック',exact=True).first).to_be_visible()
                page.wait_for_timeout(300)
                assert not page.evaluate('Object.keys(localStorage).some(k=>k.includes("pending-book"))')
                page.reload(); page.goto(B+'/compose')
                expect(page.get_by_label('相談したいこと',exact=False)).to_have_value(Q+'新しい下書きです。' if case=='newer-draft' else '')
        assert not errors and not unexpected, (case,errors,unexpected)
        print('PASS',case,flush=True)
        ctx.close()
    browser.close()
