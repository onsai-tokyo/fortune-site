"""Round-two regressions: all auth/API responses are synthetic; no live services."""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
B=os.environ.get('MOCK_E2E_BASE_URL','https://127.0.0.1:4307')
assert urlparse(B).hostname in ('127.0.0.1','localhost')
OWNER='11111111-1111-4111-8111-111111111111'
SOURCE='22222222-2222-4222-8222-222222222222'
FAILED='44444444-4444-4444-8444-444444444444'
NEW='55555555-5555-4555-8555-555555555555'
A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
PB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
C='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
Q='最近仕事の進め方に迷っています。今年はどんな姿勢で取り組むとよいでしょうか。'
def segment(v):return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
def session(owner=OWNER):
    user={'id':owner,'email':'reader@example.invalid','is_anonymous':False,'aud':'authenticated','role':'authenticated','app_metadata':{},'user_metadata':{}}
    token=segment({'alg':'HS256'})+'.'+segment({'sub':owner,'exp':int(time.time())+3600})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
def partner(pid,name):return {'id':pid,'display_name':name,'birth_date':'1990-05-05','birthplace':'東京都','relationship_label':'友人','relationship_type':'friend','gender':'female'}
def card(cid,title):return {'id':cid,'title':title,'kind':'essence','scope':'self','summary':'要約','pages':[{'text':title+'の本文'}]}
def failed():return {'id':FAILED,'sourceId':SOURCE,'focusCardId':'turning-year-2026','title':'失敗したブック','theme':'時期の判断','question':Q,'state':'failed','createdAt':'2026-10-19T00:00:00Z'}
cases=['post-reject-402','post-reject-422','post-503','post-409','post-402-unknown',
       'retry-delivered','retry-queued','retry-lost','retry-read-failed','retry-two-tabs','retry-owner-switch','retry-legacy','retry-legacy-source-mismatch',
       'partners-unknown','partners-full','partners-selected','partners-changed','partners-delete-lost','partners-target-disappeared']
if os.environ.get('ROUND2_CASES'):cases=os.environ['ROUND2_CASES'].split(',')
with sync_playwright() as p:
    browser=p.chromium.launch()
    for case in cases:
        ctx=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844})
        s=session(); draft_key='fatelab:web:compose-draft:v1:'+OWNER
        seed={'sb-mock-auth-token':json.dumps(s),draft_key:Q}
        ctx.add_init_script('if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");const seed='+json.dumps(seed)+';for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v)}')
        retry=case.startswith('retry-'); multi=case.startswith('partners-')
        state={'credits':3 if retry else 1,'books':[failed()] if retry else [],'operations':{},'rows':[partner(A,'相手A'),partner(PB,'相手B')] if multi else [],'posts':[],'hold':[],'read_fail':case=='retry-read-failed','rejected':False,'delete_lost':False}
        if case=='partners-target-disappeared':state['rows']=[partner(A,'相手A')]
        if case in ('retry-legacy','retry-legacy-source-mismatch'):
            legacy={**failed(),'id':'66666666-6666-4666-8666-666666666666','state':'delivered','createdAt':'2026-10-20T00:00:00Z','title':'以前に作成済みの同じ相談'}
            if case=='retry-legacy-source-mismatch':legacy['sourceId']=A
            state['books'].insert(0,legacy)
        calls=[]; unexpected=[]; errors=[]
        def route(r):
            req=r.request; u=urlparse(req.url); path=u.path; method=req.method
            if u.netloc=='mock.invalid':
                if path=='/auth/v1/user':return r.fulfill(json=s['user'])
                unexpected.append(path);return r.abort()
            if path.startswith('/api/'):
                calls.append((method,path))
                if path=='/api/web/books/validate':return r.fulfill(json={'valid':True})
                if '/books/operations/' in path:
                    if retry and state['read_fail']:return r.fulfill(status=503,json={'error':'再作成の確認に失敗しました'})
                    if case in ('retry-two-tabs','retry-owner-switch') and not state['operations']:
                        state['hold'].append(r);return
                    return r.fulfill(json={'book':state['operations'].get(path.rsplit('/',1)[1])})
                if path=='/api/web/books' and method=='POST':
                    payload=req.post_data_json;state['posts'].append(payload)
                    if case.startswith('post-') and not state['rejected']:
                        state['rejected']=True
                        code,status={'post-reject-402':('BOOK_NO_CREDITS',402),'post-reject-422':('BOOK_SOURCE',422),'post-503':('BOOK_UNAVAILABLE',503),'post-409':('BOOK_OPERATION_CONFLICT',409),'post-402-unknown':('UNKNOWN',402)}[case]
                        return r.fulfill(status=status,json={'code':code,'error':'会員プランで1通980円で追加できます。' if code=='BOOK_NO_CREDITS' else 'この相談を受け付けられませんでした'})
                    op=payload['operationId']; existing=state['operations'].get(op)
                    if not existing:
                        book={'id':NEW,'sourceId':SOURCE,'focusCardId':'turning-year-2026','title':'再作成したブック' if retry else '届いたブック','theme':'時期の判断','question':Q,'state':'queued' if case=='retry-queued' else 'delivered','createdAt':'2026-10-20T00:00:00Z','document':{'title':'答え','sections':[]}}
                        state['operations'][op]=book;state['books'].insert(0,book);state['credits']-=1
                    if case=='retry-lost' and len(state['posts'])==1:return r.abort('failed')
                    return r.fulfill(status=201,json={'book':state['operations'][op]})
                if path=='/api/web/partners' and method=='GET':
                    # Simulate an addition after the user saw the original two rows.
                    if state.get('inject_change'):
                        state['rows'].append(partner(C,'別タブの相手'));state['inject_change']=False
                    value={'partners':state['rows']}
                    if case!='partners-unknown':value['limit']=1 if case=='partners-full' else 10
                    return r.fulfill(json=value)
                if path.startswith('/api/web/partners/') and method=='DELETE':
                    assert path.endswith('/'+PB),'only explicitly selected B may be deleted'
                    state['rows']=[row for row in state['rows'] if row['id']!=PB]
                    if case=='partners-delete-lost' and not state['delete_lost']:
                        state['delete_lost']=True;return r.abort('failed')
                    return r.fulfill(status=204,body='')
                if path=='/api/web/partners' and method=='POST':
                    assert [row['id'] for row in state['rows']]==[A]
                    state['rows'].append(partner(C,'相手C'));return r.fulfill(status=201,json={'partner':{'id':C}})
                if path.endswith('/cancel'):return r.fulfill(json={'state':'cancelled'})
                if '/couple-timeline-settings/' in path and method=='PATCH':return r.fulfill(json={})
                if 'couple-timeline' in path:return r.fulfill(json={'status':'ready','meetingYear':None,'entries':[{'year':2026,'contentStatus':'ready','card':card('couple-2026','合成のふたり年')}]})
                if path=='/api/web/reading/conversations':return r.fulfill(json={'conversations':[{'id':SOURCE,'kind':'self','birth_data':{'birthDate':'1990-01-15','gender':'female','birthplace':'東京都'}}]})
                if path=='/api/web/books/status':return r.fulfill(json={'remaining':state['credits'],'purchasedRemaining':state['credits']})
                if path=='/api/web/books':return r.fulfill(json={'books':state['books']})
                if path=='/api/web/reading/saves':return r.fulfill(json={'saves':[]})
                if path.endswith('/timing-history'):return r.fulfill(json={'cards':[card('turning-year-2026','合成の2026年')]})
                if path.endswith('/cards'):return r.fulfill(json={'cards':[card('personality-a','合成の性格')]})
                unexpected.append((method,path));return r.fulfill(status=404,json={})
            if u.netloc!=urlparse(B).netloc:return r.abort()
            r.continue_()
        ctx.route('**/*',route)
        page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)))
        def pending():return page.evaluate('Object.keys(localStorage).filter(k=>k.includes("pending-book"))')
        def retry_click(pg=page):pg.get_by_role('button',name='もう一度つくる',exact=True).click()
        if case.startswith('post-'):
            page.goto(B+'/compose');expect(page.get_by_label('相談したいこと',exact=False)).to_have_value(Q)
            page.get_by_role('checkbox').check();page.get_by_role('button',name='一冊つくる',exact=False).click()
            expect(page.get_by_role('alert')).to_be_visible()
            expect(page.get_by_label('相談したいこと',exact=False)).to_have_value(Q)
            if case.startswith('post-reject-'):
                assert not pending();assert state['credits']==1
                if case=='post-reject-402':
                    expect(page.get_by_role('alert')).to_contain_text('利用できる冊数がありません')
                    assert '980円' not in page.get_by_role('alert').inner_text()
                page.reload();expect(page.get_by_label('相談したいこと',exact=False)).to_have_value(Q)
                page.get_by_role('checkbox').check();page.get_by_role('button',name='一冊つくる',exact=False).click()
                page.wait_for_url(B+'/books');expect(page.get_by_text('届いたブック',exact=True).first).to_be_visible()
                assert len(state['posts'])==2 and state['posts'][0]['operationId']!=state['posts'][1]['operationId']
                assert state['credits']==0 and len(state['operations'])==1
            else:
                assert pending()
                page.get_by_role('button',name='一冊つくる',exact=False).click()
                expect(page.get_by_role('alert').filter(has_text='前の相談の受付状況')).to_be_visible()
                assert len(state['posts'])==1 and pending()
        elif retry:
            page.goto(B+'/books');expect(page.get_by_text('ブックを作成できませんでした',exact=True)).to_be_visible()
            if case=='retry-two-tabs':
                second=ctx.new_page();second.set_default_timeout(10000);second.goto(B+'/books')
                retry_click();retry_click(second)
                deadline=time.time()+5
                while len(state['hold'])<2 and time.time()<deadline:page.wait_for_timeout(25)
                assert len(state['hold'])==2
                for held in state['hold']:held.fulfill(json={'book':None})
                state['hold']=[]
            else:retry_click()
            if case=='retry-owner-switch':
                deadline=time.time()+5
                while not state['hold'] and time.time()<deadline:page.wait_for_timeout(25)
                assert state['hold']
                page.evaluate('s=>{const c=new BroadcastChannel("sb-mock-auth-token");c.postMessage({event:"SIGNED_IN",session:s});c.close()}',session(NEW))
                page.wait_for_timeout(250);state['hold'].pop().fulfill(json={'book':None});page.wait_for_timeout(250)
                assert not state['posts'] and not pending()
            else:
                if case in ('retry-lost','retry-read-failed'):
                    expect(page.get_by_role('alert').filter(has_text='受付結果を確認できません' if case=='retry-lost' else '再作成の確認に失敗').last).to_be_visible()
                    assert len(state['posts'])==(1 if case=='retry-lost' else 0)
                    state['read_fail']=False;retry_click()
                if case=='retry-legacy':
                    expect(page.get_by_role('link',name='同じ相談のブックを確認',exact=True)).to_have_attribute('href','/books/66666666-6666-4666-8666-666666666666')
                    assert not state['posts'] and state['credits']==3
                    page.reload();retry_click()
                    expect(page.get_by_role('link',name='同じ相談のブックを確認',exact=True)).to_be_visible()
                    assert not state['posts'] and not pending()
                    assert not unexpected and not errors,(case,unexpected,errors)
                    print('PASS',case,flush=True);ctx.close();continue
                expect(page.get_by_role('link',name='同じ相談のブックを確認',exact=True)).to_have_attribute('href','/books/'+NEW)
                assert state['credits']==2 and len(state['operations'])==1
                before=len(state['posts']);page.reload()
                expect(page.get_by_role('button',name='もう一度つくる',exact=True)).to_be_visible();retry_click()
                expect(page.get_by_role('link',name='同じ相談のブックを確認',exact=True)).to_be_visible()
                assert len(state['posts'])==before and state['credits']==2
                assert len({post['operationId'] for post in state['posts']})==1
        elif case=='partners-target-disappeared':
            page.goto(B+'/couple/new?replace='+PB);page.get_by_label('表示名').fill('相手C')
            expect(page.get_by_role('alert').filter(has_text='選択した相手が見つかりません')).to_be_visible()
            expect(page.get_by_role('button',name='登録',exact=True)).to_be_disabled()
            assert not [x for x in calls if x[0]!='GET']
            page.get_by_role('button',name='対象を選び直す',exact=True).click()
            expect(page.get_by_role('button',name='相手Aと入れ替えて登録',exact=True)).to_be_enabled()
            assert not [x for x in calls if x[0]!='GET']
        else:
            page.goto(B+'/couple');expect(page.get_by_role('heading',name='ふたりの相手を選ぶ',exact=True)).to_be_visible()
            assert '相手A' in page.locator('body').inner_text() and '相手B' in page.locator('body').inner_text()
            page.goto(B+'/couple/new');page.get_by_label('表示名').fill('相手C')
            picker=page.get_by_label('入れ替える相手',exact=True)
            expect(page.get_by_role('button',name='登録',exact=True)).to_be_disabled()
            picker.select_option(PB)
            button=page.get_by_role('button',name='相手Bと入れ替えて登録',exact=True)
            if case in ('partners-unknown','partners-full'):
                expect(button).to_be_disabled();assert not [x for x in calls if x[0]!='GET']
                assert not page.evaluate('Object.keys(localStorage).some(k=>k.includes("pending-partner"))')
                page.get_by_role('link',name='相手Bとの年表を読む',exact=True).click();page.wait_for_url('**/couple/'+PB)
                page.goto(B+'/settings');expect(page.get_by_role('link',name='ふたりの相手',exact=False)).to_contain_text('2人（選択して読む）')
            else:
                if case=='partners-changed':state['inject_change']=True
                button.click()
                if case=='partners-changed':
                    expect(page.get_by_role('alert').filter(has_text='登録状況が変わった')).to_be_visible()
                    assert not [x for x in calls if x[0] in ('DELETE','POST')]
                    page.get_by_role('button',name='未完了の登録を取り消して入力し直す',exact=True).click()
                    expect(page.get_by_label('表示名')).to_have_value('')
                    assert len(state['rows'])==3
                else:
                    if case=='partners-delete-lost':
                        expect(page.get_by_role('alert').filter(has_text='削除結果を確認できません')).to_be_visible()
                        assert [row['id'] for row in state['rows']]==[A]
                        page.reload();expect(page.get_by_label('表示名')).to_have_value('相手C')
                        page.get_by_role('button',name='登録状況を再確認する',exact=True).click()
                    page.wait_for_url('**/couple/'+C)
                    assert [row['id'] for row in state['rows']]==[A,C]
                    assert [x for x in calls if x[0]=='DELETE']==[('DELETE','/api/web/partners/'+PB)]
                    assert len([x for x in calls if x==('POST','/api/web/partners')])==1
        assert not unexpected and not errors,(case,unexpected,errors)
        print('PASS',case,flush=True);ctx.close()
    browser.close()
