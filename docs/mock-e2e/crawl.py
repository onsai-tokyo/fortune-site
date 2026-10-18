# 各状態で全画面のリンクをたどり、エラー・リダイレクト・画像切れ・はみ出しを集める
from playwright.sync_api import sync_playwright
import time, ssl
B='https://localhost:4173'
for i in range(40):
    try:
        import urllib.request; urllib.request.urlopen(B, context=ssl._create_unverified_context()); break
    except Exception: time.sleep(0.5)
presets={'default':'通常の状態で使ってみる','first':'トップ（はじめて来た人）','linked':'設定（引き継ぎ用メール登録済み）','nopartner':'ふたり（相手がいないとき）','zero':'一冊つくる（まだ買っていない）','failed':'本棚（作成に失敗したとき）'}
issues=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for key,label in presets.items():
        pg=b.new_context(ignore_https_errors=True, viewport={'width':390,'height':844}).new_page()
        errs=[]
        pg.on('pageerror',lambda e:errs.append('pageerror '+str(e)))
        pg.on('console',lambda m:errs.append('console '+m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts' not in m.text else None)
        pg.on('response',lambda r:errs.append(f'http {r.status} {r.url}') if r.status>=400 and 'fonts' not in r.url else None)
        pg.goto(B+'/demo'); pg.wait_for_timeout(300)
        if label.startswith('通常'): pg.get_by_role('link',name=label).click()
        else: pg.get_by_role('button',name=label).click()
        pg.wait_for_timeout(300)
        seen=set(); queue=[pg.evaluate('location.pathname+location.search')]
        while queue:
            path=queue.pop(0)
            if path in seen or len(seen)>60: continue
            seen.add(path)
            pg.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}",path); pg.wait_for_timeout(250)
            final=pg.evaluate('location.pathname+location.search')
            if final!=path and not path.startswith('/you/years/2026/ask'): issues.append(f'[{key}] {path} -> redirected {final}')
            sw=pg.evaluate('document.documentElement.scrollWidth')
            if sw>390: issues.append(f'[{key}] {final} overflow {sw}')
            broken=pg.evaluate("[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src)")
            for s in broken: issues.append(f'[{key}] {final} broken image {s}')
            h1=pg.locator('h1').count()
            if h1!=1 and final not in ('/demo',): issues.append(f'[{key}] {final} h1 count {h1}')
            nolabel=pg.evaluate("[...document.querySelectorAll('button,a')].filter(e=>!(e.innerText.trim()||e.getAttribute('aria-label'))&&e.tabIndex!==-1).map(e=>e.outerHTML.slice(0,80))")
            for n in nolabel: issues.append(f'[{key}] {final} unlabeled control {n}')
            links=pg.evaluate("[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))")
            for l in links:
                if l.startswith('/') and not l.startswith('//'): 
                    if l not in seen: queue.append(l)
        for e in errs: issues.append(f'[{key}] {e}')
        print(key,'visited',len(seen))
        pg.close()
    b.close()
print('\n'.join(sorted(set(issues))) or 'no issues')
