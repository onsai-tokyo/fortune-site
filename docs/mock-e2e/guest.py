from playwright.sync_api import sync_playwright
B='https://localhost:4173'; errs=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(ignore_https_errors=True, viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    def nav(path): pg.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}",path); pg.wait_for_timeout(350)
    # first visit
    pg.goto(B+'/demo'); pg.wait_for_timeout(400); pg.get_by_role('button',name='トップ（はじめて来た人）').click(); pg.wait_for_timeout(300)
    ok(pg.get_by_role('link',name='別の端末から引き継ぐ').count()==1,'top shows 引き継ぐ, no login')
    nav('/welcome'); ok('/welcome' in pg.url,'birth input page reachable '+pg.url)
    pg.fill('#birthdate','1994-05-12'); pg.get_by_role('button',name='女性').click()
    sub=pg.get_by_role('button',name='同意して、無料で読む'); ok(sub.is_enabled(),'required fields filled')
    sub.click(); pg.wait_for_timeout(3600); pg.wait_for_timeout(300)
    ok(pg.url.endswith('/you'),'reading opens without login '+pg.url)
    nav('/couple'); ok('/couple' in pg.url and pg.get_by_text('相手を登録する').count()>0,'couple empty state')
    nav('/couple/new'); pg.fill('#pname','みさき'); pg.fill('#pbirth','1995-11-03'); pg.get_by_role('button',name='登録',exact=True).click(); pg.wait_for_timeout(300)
    ok(pg.get_by_text('あなた と みさき').count()==1,'partner registered')
    pg.get_by_role('link',name='相手を変える').first.click(); pg.wait_for_timeout(300)
    ok(pg.get_by_text('いまの相手（みさき）').count()==1,'swap warning shown')
    pg.fill('#pname','けん'); pg.fill('#pbirth','1990-02-02'); pg.get_by_role('button',name='みさきと入れ替えて登録').click(); pg.wait_for_timeout(300)
    ok(pg.get_by_text('あなた と けん').count()==1 and pg.get_by_text('あなた と みさき').count()==0,'swapped to けん (one slot)')
    # compose with 0 credits -> buy
    nav('/compose'); ok(pg.get_by_role('button',name='500円で一冊つくる').count()==1,'paid from start: 0 credits, no free book')
    nav('/credits'); buy=pg.get_by_role('button',name='5冊セットを買う（1,980円）')
    ok(buy.is_disabled(),'email required to buy'); pg.fill('#receipt-email','me@example.com'); buy.click(); pg.wait_for_timeout(3200)
    ok(pg.get_by_text('5冊セットを追加しました').count()==1,'purchase done')
    ok(pg.get_by_text('別の端末でも使えるようにする').count()==1,'link offer after purchase')
    ok(pg.input_value('#link-email')=='me@example.com','prefilled with receipt email')
    pg.get_by_role('button',name='確認コードを送る').click(); pg.fill('#link-code','123456'); pg.get_by_role('button',name='登録する').click(); pg.wait_for_timeout(200)
    ok(pg.get_by_text('引き継ぎ用に登録しました').count()==1,'email linked')
    nav('/settings'); ok(pg.get_by_text('me@example.com').count()>=1,'settings shows linked email')
    # book questions
    nav('/books/b-distance'); 
    nav('/demo'); pg.get_by_role('button',name='ブックへの質問').click(); pg.wait_for_timeout(400)
    ok(pg.get_by_text('あと2回').count()>=1,'book has 2 questions')
    pg.get_by_role('checkbox').check(); pg.fill('#ask','この時期はいつ頃ですか？'); pg.get_by_role('button',name='送信').click(); pg.wait_for_timeout(1700)
    ok(pg.get_by_text('あと1回').count()>=1,'question consumed per book')
    nav('/you/years/2026'); ok(pg.get_by_role('link',name='この読みものについて質問する').count()==0,'no free reading questions')
    # restore on another device
    pg2=b.new_page(viewport={'width':390,'height':844}); pg2.goto(B+'/demo'); pg2.wait_for_timeout(300); pg2.get_by_role('button',name='別の端末から引き継ぐ').click(); pg2.wait_for_timeout(300)
    pg2.fill('#restore-email','me@example.com'); pg2.get_by_role('button',name='コードを送る').click(); pg2.fill('#restore-code','12'); 
    ok(pg2.get_by_role('button',name='引き継ぐ').is_disabled(),'needs 6 digits'); pg2.fill('#restore-code','654321'); pg2.get_by_role('button',name='引き継ぐ').click(); pg2.wait_for_timeout(300)
    ok('/books' in pg2.url,'restored to bookshelf '+pg2.url)
    pg2.close()
    # anonymous settings warning
    nav('/demo'); pg.get_by_role('button',name='設定（この端末だけで利用中）').click(); pg.wait_for_timeout(300)
    ok(pg.get_by_text('いまはこの端末だけで使っています').count()==1 and pg.get_by_role('button',name='この端末での利用をやめる').count()==0,'anonymous: warning, no logout')
    b.close()
print('pageerrors',errs)
