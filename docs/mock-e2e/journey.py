from playwright.sync_api import sync_playwright
import time, urllib.request, ssl
import os
B=os.environ.get('MOCK_E2E_BASE_URL', 'https://localhost:4173'); errs=[]
for i in range(40):
    try: urllib.request.urlopen(B, context=ssl._create_unverified_context()); break
    except Exception: time.sleep(0.5)
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(ignore_https_errors=True, viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    def nav(path): pg.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}",path); pg.wait_for_timeout(350)
    pg.goto(B+'/demo'); pg.wait_for_timeout(300); pg.get_by_role('button',name='トップ（はじめて来た人）').click(); pg.wait_for_timeout(300)
    ok(pg.get_by_text('みさき').count()==0,'top: no stranger names')
    btn=pg.get_by_role('button',name='同意して、無料で読む'); ok(btn.is_disabled(),'top form needs date+gender')
    pg.fill('#top-birthdate','1994-05-12'); pg.get_by_role('button',name='女性').click(); btn.click(); pg.wait_for_timeout(300)
    ok('/creating' in pg.url and 'つくっています' in pg.locator('h1').inner_text(),'creating screen shown')
    pg.wait_for_timeout(3600); ok(pg.url.endswith('/you'),'auto-continues to /you '+pg.url)
    ok(pg.get_by_role('heading',name='あなたの読みものができました').count()==1,'first-visit guide shown')
    ok(pg.get_by_text('残り').count()==0,'no remaining count before first purchase')
    pg.get_by_role('link',name='出生時刻がわかる方は、足すともっと正確に読めます').click(); pg.wait_for_timeout(300)
    ok(pg.locator('details[open]').count()==1,'edit opens optional details'); pg.fill('#birthtime','07:30'); pg.fill('#nickname','ゆう'); pg.get_by_role('button',name='保存する').click(); pg.wait_for_timeout(300)
    ok(pg.url.endswith('/you') and pg.get_by_role('heading',name='ゆうさんの読みものができました').count()==1,'returns to /you with nickname')
    pg.get_by_role('button',name='案内を閉じる').click(); ok(pg.get_by_role('heading',name='ゆうさんの読みものができました').count()==0,'guide dismissible')
    # compose at 0 -> pay -> auto create
    nav('/compose'); ok(pg.get_by_text('残りがありません').count()==0,'no negative banner on compose')
    pg.select_option('#source','/you/chapters/distance'); pg.wait_for_timeout(100)
    ok(pg.locator('section:has(#source)').inner_text().find('人との距離')>=0,'source picker changes source')
    pg.fill('#question','人と仲良くなるのに時間がかかります。距離の縮め方のコツを知りたいです。どうすればよいですか。')
    pay=pg.get_by_role('button',name='500円で一冊つくる'); ok(pay.is_disabled(),'consent needed before pay')
    pg.get_by_role('checkbox').check(); pay.click(); pg.wait_for_timeout(300)
    ok('/credits' in pg.url and pg.get_by_role('heading',name='支払うと、すぐにつくり始めます').count()==1,'purchase page in compose mode')
    ok(pg.locator('[role=radio][aria-checked=true]').inner_text().startswith('1冊'),'single plan preselected')
    pg.fill('#receipt-email','me@example.com'); pg.get_by_role('button',name='1冊を買う（500円）').click(); pg.wait_for_timeout(3300)
    ok('つくり始めています' in pg.locator('h1').inner_text(),'auto-started book after payment')
    pg.get_by_role('link',name='本棚で待つ').click(); pg.wait_for_timeout(300)
    ok(pg.get_by_text('人との距離について').count()>=1,'book is on shelf (generating)')
    ok(pg.get_by_text('残り 0冊').count()==1,'header now shows 冊 count after purchase')
    nav('/compose'); ok(pg.get_by_role('textbox',name='相談したいこと（20〜400文字）').input_value()=='','draft cleared after auto-create')
    # empty shelf state for new user other device
    pg.goto(B+'/demo'); pg.wait_for_timeout(300); pg.get_by_role('button',name='一冊つくる（まだ買っていない）').click(); pg.wait_for_timeout(300)
    nav('/books'); ok(pg.get_by_role('link',name='最初の一冊をつくる').count()==1,'empty bookshelf invites first book')
    # abandoned pending create should not auto-create later
    nav('/compose'); pg.fill('#question','仕事で頼まれごとを引き受けすぎてしまいます。自分のペースを守るにはどうしたらよいでしょうか。'); pg.get_by_role('checkbox').check()
    pg.get_by_role('button',name='500円で一冊つくる').click(); pg.wait_for_timeout(200)
    nav('/settings'); nav('/credits'); pg.fill('#receipt-email','a@b.jp'); pg.get_by_role('button',name='5冊セットを買う（1,980円）').click(); pg.wait_for_timeout(3300)
    ok(pg.get_by_text('5冊セットを追加しました').count()==1,'abandoned pending create not triggered on later purchase')
    b.close()
print('pageerrors',errs)
