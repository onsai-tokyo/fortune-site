"""Synthetic REMOTE only: deletion must not imply success before server ACK."""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4243')
owner = '11111111-1111-4111-8111-111111111111'
source = '22222222-2222-4222-8222-222222222222'
other = '55555555-5555-4555-8555-555555555555'
def segment(v): return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
def session_for(uid):
    user = {'id':uid,'email':'synthetic@example.invalid' if uid==owner else 'other@example.invalid','is_anonymous':False,'aud':'authenticated','role':'authenticated','app_metadata':{},'user_metadata':{}}
    token = segment({'alg':'HS256'})+'.'+segment({'sub':uid,'exp':int(time.time())+3600})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
session = session_for(owner)
draft_key = 'fatelab:web:compose-draft:v1:'+owner
pending_key = 'fatelab:web:pending-partner:'+owner+':v1'
other_key = 'fatelab:web:compose-draft:v1:'+other

with sync_playwright() as p:
    browser = p.chromium.launch()
    for case in ['success', 'server-failure', 'lost-response', 'owner-switch']:
        ctx = browser.new_context(ignore_https_errors=True, viewport={'width':390,'height':844})
        seed = {'sb-mock-auth-token':json.dumps(session),draft_key:'synthetic retained draft',pending_key:'synthetic pending marker',other_key:'other owner draft'}
        ctx.add_init_script('const fixture='+json.dumps(seed)+'; for(const [k,v] of Object.entries(fixture)) localStorage.setItem(k,v)')
        held, calls, forbidden, errors = [], [], [], []
        def route(r):
            req=r.request; u=urlparse(req.url); path=u.path
            if u.netloc=='mock.invalid':
                calls.append((req.method,path))
                if path=='/auth/v1/logout': return r.fulfill(status=204,body='')
                if path=='/auth/v1/user': return r.fulfill(json=session['user'])
                forbidden.append(path); return r.abort()
            if path.startswith('/api/'):
                calls.append((req.method,path))
                if path=='/api/web/reading/account' and req.method=='DELETE':
                    assert req.headers.get('authorization')=='Bearer '+session['access_token']
                    held.append(r); return
                if path=='/api/web/reading/conversations': return r.fulfill(json={'conversations':[{'id':source,'kind':'self','birth_data':{'birthDate':'1990-01-15','gender':'female','birthplace':'東京都'}}]})
                if path=='/api/web/partners': return r.fulfill(json={'partners':[]})
                if path=='/api/web/books/status': return r.fulfill(json={'remaining':1})
                if path=='/api/web/books': return r.fulfill(json={'books':[]})
                if path=='/api/web/reading/saves': return r.fulfill(json={'saves':[]})
                if path.endswith('/timing-history'): return r.fulfill(json={'cards':[{'id':'turning-year-2026','title':'合成の本人年','summary':'本人の年','pages':[{'text':'本文'}]}]})
                if path.endswith('/cards'): return r.fulfill(json={'cards':[]})
                forbidden.append(path); return r.abort()
            if u.netloc!=urlparse(B).netloc: return r.abort()
            r.continue_()
        ctx.route('**/*',route)
        page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(B+'/settings')
        page.get_by_text('synthetic@example.invalid',exact=False).first.wait_for()
        page.get_by_role('button',name='退会する（アカウントを削除）',exact=True).click()
        page.get_by_role('button',name='すべて削除して退会する',exact=True).click()
        deadline=time.time()+10
        while not held and time.time()<deadline: page.wait_for_timeout(30)
        assert held, 'DELETE not reached'
        assert page.url.endswith('/settings')
        assert page.get_by_role('button',name='退会処理中です…',exact=True).is_disabled()
        assert page.get_by_role('button',name='やめる',exact=True).is_disabled()
        page.keyboard.press('Escape')
        assert page.get_by_role('dialog').is_visible()
        assert page.evaluate('(k)=>localStorage.getItem(k)',draft_key)=='synthetic retained draft'
        assert not any(path=='/auth/v1/logout' for _,path in calls)
        if case=='owner-switch':
            page.evaluate('s=>{const c=new BroadcastChannel("sb-mock-auth-token");c.postMessage({event:"SIGNED_IN",session:s});c.close()}',session_for(other))
            page.wait_for_timeout(200)
            held.pop().fulfill(status=204,body='')
            # Owner refresh unmounts the old Settings/dialog while loading.
            # The replacement account must remain signed in, not be cleared by
            # the late response from the previous account's DELETE.
            page.get_by_text('other@example.invalid',exact=False).first.wait_for()
            assert page.url.endswith('/settings')
            assert not any(path=='/auth/v1/logout' for _,path in calls)
        elif case in ['server-failure','lost-response']:
            if case=='server-failure': held.pop().fulfill(status=500,json={'error':'synthetic'})
            else: held.pop().abort('failed')
            page.get_by_role('alert').filter(has_text='削除結果を確認できない').wait_for()
            assert page.url.endswith('/settings')
            assert page.get_by_role('button',name='すべて削除して退会する',exact=True).is_enabled()
            assert page.evaluate('(k)=>localStorage.getItem(k)',draft_key)=='synthetic retained draft'
            assert not any(path=='/auth/v1/logout' for _,path in calls)
            # No implicit retry on a missing or failed response.
            assert len([1 for method,path in calls if method=='DELETE'])==1
            if case=='server-failure': page.screenshot(path='/private/tmp/fatelab-account-delete-synthetic-failure-20261020.png')
        else:
            held.pop().fulfill(status=204,body='')
            page.wait_for_url(B+'/')
            assert page.evaluate('(k)=>localStorage.getItem(k)',draft_key) is None
            assert page.evaluate('(k)=>localStorage.getItem(k)',pending_key) is None
            assert any(path=='/auth/v1/logout' for _,path in calls)
        assert page.evaluate('(k)=>localStorage.getItem(k)',other_key)=='other owner draft'
        assert not forbidden and not errors,(forbidden,errors)
        print('PASS account deletion',case,'awaits ACK, guards owner, retains failure state, one submission')
        ctx.close()
    browser.close()
