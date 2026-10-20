"""Computed foreground/background checks against the local demo build only."""
import os, re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL','https://127.0.0.1:4242')
def rgb(value): return tuple(float(v) for v in re.findall(r'[\d.]+',value)[:3])
def luminance(color):
    values=[v/255 for v in color]
    values=[v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4 for v in values]
    return sum(v*w for v,w in zip(values,[0.2126,0.7152,0.0722]))
def check_controls(page, label, minimum=1):
    controls=page.locator('.fl-root .bg-fl-ink.text-white, .fl-root .bg-fl-danger.text-white')
    count=0
    for control in controls.all():
        if not control.is_visible(): continue
        data=control.evaluate('(e)=>{const s=getComputedStyle(e);return {fg:s.color,bg:s.backgroundColor,disabled:e.matches(":disabled")}}')
        fg,bg=rgb(data['fg']),rgb(data['bg'])
        if data['disabled']:
            assert fg==(108,112,104), (label,'disabled foreground',data)
        else:
            assert fg==(255,255,255), (label,'dark control must have white text',data)
            lo,hi=sorted([luminance(fg),luminance(bg)])
            assert (hi+0.05)/(lo+0.05)>=4.5,(label,'contrast below 4.5:1',data)
        count+=1
    assert count>=minimum,(label,'no tested controls')
    print('PASS contrast',label,count,'dark/disabled controls')

with sync_playwright() as p:
    browser=p.chromium.launch()
    for width in [320,390,1280]:
        ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':900})
        ctx.route('**/*',lambda r:r.continue_() if urlparse(r.request.url).netloc==urlparse(B).netloc else r.abort())
        page=ctx.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(B+'/you')
        page.locator('h1').wait_for()
        if page.get_by_role('button',name='案内を閉じる',exact=True).count(): page.get_by_role('button',name='案内を閉じる',exact=True).click()
        for path in ['/you','/couple/p-misaki?year=2026','/books/saved','/compose','/credits']:
            page.evaluate('p=>{history.pushState({},"",p);dispatchEvent(new PopStateEvent("popstate"))}',path)
            page.wait_for_timeout(150)
            check_controls(page,f'{width}px {path}')
        page.evaluate('()=>{history.pushState({},"","/settings");dispatchEvent(new PopStateEvent("popstate"))}')
        page.get_by_role('button',name='退会する（アカウントを削除）',exact=True).click()
        check_controls(page,f'{width}px danger confirmation')
        page.get_by_role('button',name='やめる',exact=True).click()
        page.evaluate('()=>{history.pushState({},"","/demo");dispatchEvent(new PopStateEvent("popstate"))}')
        page.wait_for_timeout(200)
        # The demo button's accessible name also includes its route suffix '/'.
        page.get_by_role('button',name='トップ（はじめて来た人）').click()
        page.locator('#top-birthdate').wait_for()
        check_controls(page,f'{width}px disabled primary')
        for label, value in [('年','1990'),('月','01'),('日','15')]: page.get_by_label('生まれた'+label, exact=True).select_option(value)
        page.get_by_role('button',name='女性',exact=True).click()
        page.wait_for_timeout(200)  # allow the control's color transition to settle
        check_controls(page,f'{width}px enabled primary')
        if width==390: page.screenshot(path='/private/tmp/fatelab-control-contrast-fixed-20261020.png',full_page=False)
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth')<=width
        ctx.close()
    browser.close()
