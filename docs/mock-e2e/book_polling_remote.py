"""Synthetic REMOTE book states; all non-local requests are intercepted."""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B=os.environ.get('MOCK_E2E_BASE_URL','https://127.0.0.1:4243')
owner='11111111-1111-4111-8111-111111111111'
other='55555555-5555-4555-8555-555555555555'
source='22222222-2222-4222-8222-222222222222'
book_id='33333333-3333-4333-8333-333333333333'
operation='44444444-4444-4444-8444-444444444444'
cache_key='fatelab:web:pending-book:'+owner+':v1'
def segment(v): return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
def session_for(uid):
    user={'id':uid,'is_anonymous':True,'aud':'authenticated','role':'authenticated','app_metadata':{},'user_metadata':{}}
    token=segment({'alg':'HS256'})+'.'+segment({'sub':uid,'exp':int(time.time())+3600})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
session=session_for(owner); other_session=session_for(other)
with sync_playwright() as p:
    browser=p.chromium.launch()
    for case in ['delivered','failed','reload','no-operation-cache','network-error','owner-switch','invalid-date']:
        ctx=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844})
        seed={'sb-mock-auth-token':json.dumps(session)}
        if case!='no-operation-cache': seed[cache_key]=json.dumps({'operationId':operation,'draft':{'question':'合成の下書き'}})
        ctx.add_init_script('const s='+json.dumps(seed)+';for(const [k,v] of Object.entries(s))if(!localStorage.getItem(k))localStorage.setItem(k,v)')
        flags={'state':'queued','held':None,'network':False}
        calls,forbidden,errors=[],[],[]
        def row():
            return {'id':book_id,'sourceId':source,'title':'合成の生活習慣ブック','targetTitle':'あなたの2025年','theme':'その他','question':'架空の生活習慣の相談です。','state':flags['state'],'createdAt':'bad-date' if case=='invalid-date' else '2026-10-19T15:43:06.915445+00:00','failureCode':'BOOK_DOCUMENT_EVIDENCE' if flags['state']=='failed' else None,'document':{'title':'合成の生活習慣ブック','summary':'合成の要約','answer':'合成の答え','sections':[],'actions':[]} if flags['state']=='delivered' else None,'questionsLeft':2}
        def route(r):
            req=r.request; u=urlparse(req.url); path=u.path
            if u.netloc=='mock.invalid':
                if path=='/auth/v1/user': return r.fulfill(json=session['user'])
                forbidden.append(path); return r.abort()
            if path.startswith('/api/'):
                calls.append((req.method,path))
                assert req.method=='GET','polling must never POST/recreate'
                other_owner=req.headers.get('authorization')=='Bearer '+other_session['access_token']
                if path=='/api/web/books/operations/'+operation:
                    if case=='owner-switch' and flags['held'] is None: flags['held']=r; return
                    if flags['network']: return r.fulfill(status=503,json={'error':'synthetic'})
                    return r.fulfill(json={'book':row()})
                if path=='/api/web/books':
                    # Let initial profile/shelf hydration finish, then simulate
                    # both status channels being unavailable (not just the
                    # operation endpoint while shelf polling still works).
                    if flags['network'] and calls.count(('GET',path))>1: return r.fulfill(status=503,json={'error':'synthetic'})
                    return r.fulfill(json={'books':[] if other_owner else [row()]})
                if path=='/api/web/books/status': return r.fulfill(json={'remaining':1 if flags['state']=='failed' else 0,'purchasedRemaining':1 if flags['state']=='failed' else 0})
                if path=='/api/web/partners': return r.fulfill(json={'partners':[]})
                if path=='/api/web/reading/saves': return r.fulfill(json={'saves':[]})
                if path=='/api/web/reading/conversations': return r.fulfill(json={'conversations':[{'id':source,'kind':'self','birth_data':{'birthDate':'1990-01-15','gender':'female','birthplace':'東京都'}}]})
                if path.endswith('/timing-history'): return r.fulfill(json={'cards':[{'id':'turning-year-2025','title':'合成の2025年','summary':'合成の年','pages':[{'text':'合成本文'}]}]})
                if path.endswith('/cards'): return r.fulfill(json={'cards':[]})
                forbidden.append(path); return r.abort()
            if u.netloc!=urlparse(B).netloc: return r.abort()
            r.continue_()
        ctx.route('**/*',route)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(B+'/books');page.get_by_text('受付済み',exact=True).wait_for()
        if case=='owner-switch':
            deadline=time.time()+10
            while not flags['held'] and time.time()<deadline:page.wait_for_timeout(30)
            assert flags['held']
            page.evaluate('s=>{const c=new BroadcastChannel("sb-mock-auth-token");c.postMessage({event:"SIGNED_IN",session:s});c.close()}',other_session)
            page.get_by_role('heading',name='ここに、あなたへのブックが並びます',exact=True).wait_for()
            flags['held'].fulfill(json={'book':{**row(),'state':'delivered'}})
            page.wait_for_timeout(250)
            assert page.get_by_text('合成の生活習慣ブック',exact=True).count()==0
            assert page.evaluate('(k)=>localStorage.getItem(k)',cache_key)
        else:
            if case=='network-error':
                # Fail after initial hydration, like a connection lost while
                # watching an accepted job rather than a failed initial login.
                flags['network']=True
                page.get_by_role('alert').filter(has_text='作成状況を取得できませんでした').wait_for()
                assert page.get_by_text('ブックを作成できませんでした',exact=True).count()==0
                assert page.evaluate('(k)=>localStorage.getItem(k)',cache_key)
                flags['network']=False
                page.get_by_role('button',name='再読み込み',exact=True).click()
            flags['state']='generating';page.get_by_text('作成中',exact=True).wait_for()
            if case!='no-operation-cache': assert page.evaluate('(k)=>localStorage.getItem(k)',cache_key),'pending data cleared before terminal state'
            if case=='reload':
                page.reload();page.get_by_text('作成中',exact=True).wait_for()
                assert page.evaluate('(k)=>localStorage.getItem(k)',cache_key)
            flags['state']='review';page.get_by_text('確認中',exact=True).wait_for()
            if case!='no-operation-cache': assert page.evaluate('(k)=>localStorage.getItem(k)',cache_key)
            flags['state']='failed' if case=='failed' else 'delivered'
            if case=='failed':
                page.get_by_text('ブックを作成できませんでした',exact=True).wait_for()
                page.get_by_text('使った1冊分をお戻ししました',exact=False).wait_for()
            else:page.get_by_role('link',name='合成の生活習慣ブック',exact=False).wait_for()
            if case!='no-operation-cache':
                page.wait_for_function('(k)=>localStorage.getItem(k)===null',arg=cache_key)
            body=page.locator('body').inner_text()
            assert 'NaN' not in body and 'undefined月' not in body
            assert ('日付不明' if case=='invalid-date' else '10月20日') in body
            if case=='failed':page.screenshot(path='/private/tmp/fatelab-book-polling-failed-refund-fixed-20261020.png')
        assert not forbidden and not errors,(forbidden,errors)
        print('PASS book polling',case,'GET-only, pending retained, state/date/owner verified')
        ctx.close()
    browser.close()
