"""REMOTE-only reading regression: synthetic two users x two partners; no live API."""
import os, json, base64, time, re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
B=os.environ.get('MOCK_E2E_BASE_URL','https://127.0.0.1:4192')
dist=Path(os.environ.get('REMOTE_DIST','/private/tmp/fatelab-remote-real-readings'))
for file in (dist/'assets').glob('*.js'):
    text=file.read_text()
    for forbidden in ['［サンプル］','静かに、深く根を張る人','歩幅をそろえ直す一年','みさきさん']:
        assert forbidden not in text, (file.name,'demo prose shipped')
def uid(n): return f'{n:08d}-1111-4111-8111-111111111111'
def segment(x): return base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for index,birth in enumerate(['1994-05-12','1983-01-28'],1):
        source=uid(index+10); partners=[uid(index+20),uid(index+30)]; year=2030+index
        user={'id':uid(index),'email':f'fixture{index}@example.invalid','is_anonymous':False,'aud':'authenticated','role':'authenticated','app_metadata':{},'user_metadata':{}}
        token=segment({'alg':'HS256'})+'.'+segment({'sub':user['id'],'exp':int(time.time())+3600})+'.fixture'
        session={'access_token':token,'refresh_token':'fixture','expires_at':int(time.time())+3600,'expires_in':3600,'token_type':'bearer','user':user}
        ctx=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844})
        ctx.add_init_script('localStorage.setItem("sb-mock-auth-token",'+json.dumps(json.dumps(session))+')')
        flags={'hold':True,'fail':False,'pairFail':False}; held=[]; writes=[]; saves=[]; seen=[]; errors=[]
        def headline(): return f'本人{index}の実データ見出し'
        def card(card_id,title,body): return {'id':card_id,'title':title,'kind':'essence','scope':'self','summary':'実際の要約','pages':[{'label':'章の本文','text':body}]}
        def route(r):
            req=r.request; path=urlparse(req.url).path
            if req.url.startswith('https://mock.invalid/auth/v1/user'): return r.fulfill(json=user)
            if path.startswith('/api/'):
                seen.append(path)
                assert req.headers.get('authorization')=='Bearer '+token
                if req.method!='GET': writes.append((req.method,path,req.post_data_json))
                if path=='/api/web/reading/conversations': return r.fulfill(json={'conversations':[{'id':uid(99),'kind':'compatibility','birth_data':{'birthDate':'1900-01-01'}},{'id':source,'kind':'self','title':'本人の読みもの','birth_data':{'birthDate':birth,'nickname':f'本人{index}','birthplace':'東京都'}}]})
                if path=='/api/web/books/status':
                    if flags['hold']: held.append(r); return
                    return r.fulfill(json={'remaining':1,'purchasedRemaining':1})
                if path=='/api/web/books' and req.method=='GET': return r.fulfill(json={'books':[]})
                if path=='/api/web/partners': return r.fulfill(json={'partners':[{'id':x,'display_name':f'相手{index}-{j}','birth_date':['1996-08-23','1990-11-07'][j],'birthplace':'東京都','relationship_label':['夫婦','友人'][j],'relationship_type':['romantic','friend'][j]} for j,x in enumerate(partners)]})
                if path=='/api/web/reading/saves': return r.fulfill(json={'saves':[{'save_key':f'couple-{partners[0]}-{year+5}'}]})
                if path.startswith('/api/web/reading/saves/') and req.method=='PUT': saves.append(path.rsplit('/',1)[-1]); return r.fulfill(json={})
                if path.endswith('/timing-history'):
                    assert source in path
                    if flags['fail']: return r.fulfill(status=503,json={'error':'synthetic failure'})
                    return r.fulfill(json={'cards':[card(f'turning-year-{year}',f'本人{index}の{year}年',f'{birth}からの本物の年の文章')]})
                if path.endswith('/cards'):
                    assert source in path
                    if flags['fail']: return r.fulfill(status=503,json={'error':'synthetic failure'})
                    return r.fulfill(json={'cards':[card(f'personality-{index}-actual',headline(),f'本人{index}の本物の性格本文')]})
                if '/couple-timeline' in path:
                    assert source in path
                    pair=next((j for j,x in enumerate(partners) if x in path),None); assert pair is not None
                    if flags['pairFail']: return r.fulfill(status=503,json={})
                    if req.method=='POST':
                        assert req.post_data_json['year']==year+5+pair
                        return r.fulfill(json={'sourceId':uid(50+index+pair),'sourceCardId':f'couple-{index}-{pair}-{year+5+pair}'})
                    return r.fulfill(json={'status':'ready','meetingYear':2020,'entries':[{'year':year+5+pair,'label':'実際の年','contentStatus':'ready','card':{'id':f'couple-{index}-{pair}-{year+5+pair}','title':f'本人{index}と相手{pair}の固有の年','sections':[{'heading':'ふたり','body':f'本人{index}相手{pair}だけの実計算本文'}]}}]})
                if path=='/api/web/books/validate': return r.fulfill(json={'valid':True})
                if path=='/api/web/books' and req.method=='POST':
                    data=req.post_data_json
                    assert data['sourceId']==uid(50+index+1) and data['focusCardId']==f'couple-{index}-1-{year+6}' and data['theme']=='人間関係'
                    return r.fulfill(json={'book':{'id':uid(88),'state':'queued'}})
                if '/books/operations/' in path: return r.fulfill(json={'book':{'id':uid(88)}})
                raise AssertionError('Unexpected fixture API '+path)
            if urlparse(req.url).netloc!=urlparse(B).netloc: return r.abort()
            r.continue_()
        ctx.route('**/*',route); page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
        def clean():
            text=page.locator('body').inner_text()
            for phrase in ['［サンプル］','静かに、深く根を張る人','歩幅をそろえ直す一年','みさき'] : assert phrase not in text
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        def nav(path): page.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}",path)
        page.goto(B+'/you'); page.get_by_role('status').filter(has_text='読み込み中').wait_for(); clean()
        flags['hold']=False
        for r in held: r.fulfill(json={'remaining':1,'purchasedRemaining':1})
        page.get_by_role('heading',name=headline(),exact=True).wait_for(); clean()
        nav(f'/you/years/{year}'); page.get_by_text(f'{birth}からの本物の年の文章',exact=True).wait_for(); clean()
        nav(f'/you/chapters/personality-{index}-actual'); page.get_by_text(f'本人{index}の本物の性格本文',exact=True).wait_for(); clean()
        for pair,pid in enumerate(partners):
            nav(f'/couple/{pid}'); page.get_by_role('heading',name=f'本人{index}と相手{pair}の固有の年',exact=True).wait_for()
            page.get_by_text(f'本人{index}相手{pair}だけの実計算本文',exact=True).wait_for(); clean()
            page.get_by_role('button',name=re.compile('本棚に保存する|保存を取り消す')).click()
            results.append((birth,pid,year+5+pair))
        nav('/compose'); page.locator('#source').wait_for()
        options=page.locator('#source').inner_text(); assert f'本人{index}の{year}年' in options and headline() in options
        assert all(f'本人{index}と相手{j}の固有の年' in options for j in range(2)); clean()
        page.locator('#source').select_option(f'/you/chapters/personality-{index}-actual')
        page.get_by_role('link',name='選んでいる読みものを読む').click(); page.get_by_text(f'本人{index}の本物の性格本文',exact=True).wait_for()
        nav('/compose'); page.locator('#source').select_option(f'/couple/{partners[1]}?year={year+6}')
        page.locator('#question').fill('今の関係について、相手との距離のとり方を詳しく知りたいです。')
        page.get_by_role('checkbox').check(); page.get_by_role('button',name=re.compile('一冊つくる')).click()
        page.wait_for_url(B+'/books'); page.wait_for_timeout(400)
        assert any(x[1]=='/api/web/books' and x[0]=='POST' for x in writes)
        assert f'couple-{partners[1]}-{year+6}' in saves
        nav('/books/saved'); page.get_by_role('link',name=re.compile(f'{year+5}年 本人{index}と相手0')).wait_for(); clean()
        flags['pairFail']=True; nav('/couple/'+partners[0]); page.reload()
        page.get_by_role('alert').filter(has_text='読み込めませんでした').wait_for(); clean()
        flags['pairFail']=False; page.get_by_role('button',name='再読み込み',exact=True).click()
        page.get_by_role('heading',name=f'本人{index}と相手0の固有の年',exact=True).wait_for()
        flags['fail']=True
        for path in ['/you',f'/you/years/{year}',f'/you/chapters/personality-{index}-actual','/compose']:
            page.goto(B+path); page.get_by_role('alert').filter(has_text='読み込めませんでした').wait_for(); clean()
        flags['fail']=False; page.get_by_role('button',name='再読み込み',exact=True).click()
        page.get_by_role('heading',name='いま、知りたいことを。',exact=True).wait_for()
        assert not errors,errors
        print(f'PASS synthetic owner {index}: real headline/year/chapter, two partners, sources/IDs/themes, save keys, loading/failure/retry, no demo')
        ctx.close()
    assert len(set(results))==4
    browser.close()
print('PASS REMOTE assets exclude demo prose; two birthdays x two partners differ')
