"""Web replacement/recovery, synthetic auth/API only. No live service calls."""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4243')
def segment(v): return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
owner = '11111111-1111-4111-8111-111111111111'
source = '22222222-2222-4222-8222-222222222222'
old = '33333333-3333-4333-8333-333333333333'
new = '44444444-4444-4444-8444-444444444444'
user = {'id': owner, 'is_anonymous': True, 'aud': 'authenticated', 'role': 'authenticated', 'app_metadata': {}, 'user_metadata': {}}
token = segment({'alg':'HS256'})+'.'+segment({'sub':owner,'exp':int(time.time())+3600})+'.fixture'
session = {'access_token':token,'refresh_token':'fixture','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
other_user = {**user,'id':'55555555-5555-4555-8555-555555555555'}
other_token = segment({'alg':'HS256'})+'.'+segment({'sub':other_user['id'],'exp':int(time.time())+3600})+'.fixture'
other_session = {**session,'access_token':other_token,'user':other_user}
old_row = {'id':old,'display_name':'架空A','birth_date':'1992-08-20','birthplace':'東京都','gender':'male','relationship_label':'友人'}
new_row = {**old_row,'id':new,'display_name':'架空B','birth_date':'1988-03-12','gender':'female'}
with sync_playwright() as p:
    browser = p.chromium.launch()
    for failure in [None, 'delete', 'delete-lost-response', 'register', 'lost-response', 'meeting', 'refresh', 'owner-switch']:
        ctx = browser.new_context(ignore_https_errors=True, viewport={'width':390,'height':844})
        ctx.add_init_script('localStorage.setItem("sb-mock-auth-token",'+json.dumps(json.dumps(session))+')')
        flags = {'failure':failure,'rows':[old_row],'meeting':2015,'created':False,'held':None,'hold':True}
        calls, errors, forbidden, operation_ids = [], [], [], []
        def route(r):
            req=r.request; u=urlparse(req.url); path=u.path
            if u.netloc=='mock.invalid':
                if path=='/auth/v1/user': return r.fulfill(json=user)
                forbidden.append(path); return r.abort()
            if path.startswith('/api/'):
                assert req.headers.get('authorization') in ['Bearer '+token,'Bearer '+other_token]
                if req.method!='GET': assert req.headers.get('authorization')=='Bearer '+token
                calls.append((req.method,path))
                if path=='/api/web/partners':
                    if req.method=='GET': return r.fulfill(json={'partners':[] if req.headers.get('authorization')=='Bearer '+other_token else flags['rows']})
                    assert req.method=='POST'
                    operation_ids.append(req.headers['idempotency-key'])
                    assert req.post_data_json['birthDate']=='1988-03-12'
                    if flags['failure']=='register': return r.fulfill(status=503,json={'error':'synthetic'})
                    flags['rows']=[new_row]; flags['created']=True
                    if flags['failure']=='lost-response': return r.fulfill(status=503,json={'error':'synthetic uncertain response'})
                    return r.fulfill(status=201,json={'partner':new_row})
                if path=='/api/web/partners/'+old and req.method=='DELETE':
                    if flags['hold']: flags['held']=r; return
                    if flags['failure']=='delete': return r.fulfill(status=503,json={'error':'synthetic'})
                    flags['rows']=[]; return r.fulfill(status=204,body='')
                if path.startswith('/api/web/reading/couple-timeline-settings/'):
                    assert req.method=='PATCH' and new in path
                    if flags['failure']=='meeting': return r.fulfill(status=503,json={'error':'synthetic'})
                    flags['meeting']=req.post_data_json['meetingYear']; return r.fulfill(json={})
                if path=='/api/web/reading/conversations':
                    if flags['created'] and flags['failure']=='refresh': return r.fulfill(status=503,json={'error':'synthetic'})
                    return r.fulfill(json={'conversations':[{'id':source,'kind':'self','birth_data':{'birthDate':'1990-01-15','gender':'female','birthplace':'東京都'}}]})
                if path=='/api/web/books/status': return r.fulfill(json={'remaining':0})
                if path=='/api/web/books': return r.fulfill(json={'books':[]})
                if path=='/api/web/reading/saves': return r.fulfill(json={'saves':[]})
                if path.endswith('/timing-history'): return r.fulfill(json={'cards':[{'id':'turning-year-2026','title':'合成の本人年','summary':'本人の年','pages':[{'text':'本文'}]}]})
                if path.endswith('/cards'): return r.fulfill(json={'cards':[]})
                if path.endswith('/couple-timeline'):
                    return r.fulfill(json={'status':'ready','meetingYear':flags['meeting'],'entries':[{'year':2026,'contentStatus':'ready','title':'合成のふたり年','card':{'id':'couple-2026','title':'合成のふたり年','summary':'架空のふたり本文','pages':[{'text':'架空のふたり本文'}]}}]})
                forbidden.append(path); return r.abort()
            if u.netloc!=urlparse(B).netloc: return r.abort()
            r.continue_()
        ctx.route('**/*',route)
        page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(B+'/couple/new')
        page.locator('#pname').fill('架空B'); page.locator('#pmet').fill('2020')
        page.locator('#prel').select_option(label='友人'); page.locator('#pbirth').fill('1988-03-12')
        submit=page.get_by_role('button',name='架空Aと入れ替えて登録',exact=True)
        submit.click()
        deadline=time.time()+10
        while not flags['held'] and time.time()<deadline: page.wait_for_timeout(30)
        assert flags['held'], 'DELETE not reached'
        assert '/couple/new' in page.url, 'do not navigate before API completion'
        assert page.get_by_role('button',name='登録しています…',exact=True).is_disabled()
        assert page.locator('#pname').is_disabled()
        assert len(operation_ids)==0, 'registration waits for DELETE'
        if failure=='owner-switch':
            page.evaluate('s=>{const c=new BroadcastChannel("sb-mock-auth-token");c.postMessage({event:"SIGNED_IN",session:s});c.close()}',other_session)
            page.wait_for_timeout(250)
            flags['held'].fulfill(status=204,body=''); flags['held']=None
            page.wait_for_timeout(500)
            assert not operation_ids, 'account switch stops registration after old-owner DELETE'
            assert page.locator('#pname').input_value()=='', 'old owner form data must be cleared'
            assert not forbidden and not errors,(forbidden,errors)
            print('PASS replacement owner-switch stops late writes and clears old form')
            ctx.close(); continue
        flags['hold']=False
        if failure in ['delete','delete-lost-response']:
            if failure=='delete-lost-response': flags['rows']=[]
            flags['held'].fulfill(status=503,json={'error':'synthetic'})
        else: flags['rows']=[]; flags['held'].fulfill(status=204,body='')
        flags['held']=None
        if failure:
            page.get_by_role('alert').filter(has_text='登録を完了できませんでした').wait_for()
            assert '/couple/new' in page.url
            assert page.locator('#pname').input_value()=='架空B'
            assert page.locator('#pbirth').input_value()=='1988-03-12'
            assert page.locator('#pmet').input_value()=='2020'
            if failure in ['register','lost-response']: page.get_by_role('alert').filter(has_text='前の相手は削除済み').wait_for()
            if failure in ['register','lost-response']: assert page.get_by_role('button',name='架空Aと入れ替えて登録',exact=True).count()==0
            if failure in ['meeting','refresh']: page.get_by_role('alert').filter(has_text='相手は登録済み').wait_for()
            before=list(calls)
            # Restore read availability before reloading; a persistent history
            # outage correctly gates profile-dependent pages with a retry screen.
            if failure=='refresh': flags['failure']=None
            page.reload(); page.locator('#pname').wait_for()
            assert page.locator('#pname').input_value()=='架空B', 'draft survives reload'
            assert page.locator('#pmet').input_value()=='2020'
            assert [c for c in calls[len(before):] if c[0]!='GET']==[], 'reload must not mutate'
            flags['failure']=None
            page.get_by_role('button',name='架空Aと入れ替えて登録' if failure=='delete' else '架空Bと入れ替えて登録' if flags['created'] else '登録',exact=True).click()
        page.wait_for_url('**/couple/'+new)
        page.get_by_role('heading',name='ふたりの年表',exact=True).first.wait_for()
        assert len([c for c in calls if c==('DELETE','/api/web/partners/'+old)])==(2 if failure=='delete' else 1)
        assert not any(c[0]=='DELETE' and new in c[1] for c in calls), 'never delete the registered replacement'
        assert len(set(operation_ids))==1, 'retries reuse operationId'
        assert len(operation_ids)==(2 if failure in ['register','lost-response'] else 1)
        assert flags['rows']==[new_row] and flags['meeting']==2020
        assert not forbidden and not errors,(forbidden,errors)
        print('PASS replacement',failure or '204-success','same operation, retained input, explicit recovery, no duplicate/deletion')
        ctx.close()
    browser.close()
