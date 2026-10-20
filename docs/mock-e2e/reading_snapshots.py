"""Local synthetic REMOTE only. No production network or real account writes."""
import os,json,time,base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
B=os.environ.get("MOCK_E2E_BASE_URL","https://127.0.0.1:4336")
assert urlparse(B).hostname in ("localhost","127.0.0.1")
def enc(x):return base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip("=")
uid="11111111-1111-4111-8111-111111111111"
user={"id":uid,"email":"fixture@example.invalid","is_anonymous":False,"aud":"authenticated","role":"authenticated","app_metadata":{},"user_metadata":{}}
token=enc({"alg":"HS256"})+"."+enc({"sub":uid,"exp":int(time.time())+3600})+".fixture"
session={"access_token":token,"refresh_token":"fixture","token_type":"bearer","expires_at":int(time.time())+3600,"expires_in":3600,"user":user}
chapter={"id":"personality-1","kind":"personality","title":"保存テストの性格","sections":[{"heading":"特徴","body":"最初の本文を保存します。"}]}
year={"id":"turning-year-2026","kind":"timing","title":"年表のテスト","sections":[{"heading":"流れ","body":"年表の本文。"}]}
report={"version":3,"reportText":"架空の鑑定","cards":[chapter,year]}
with sync_playwright() as p:
    browser=p.chromium.launch()
    ctx=browser.new_context(ignore_https_errors=True,viewport={"width":390,"height":844})
    ctx.add_init_script("if(!localStorage.getItem('sb-mock-auth-token'))localStorage.setItem('sb-mock-auth-token',"+json.dumps(json.dumps(session))+");")
    history=[];snapshots=[];errors=[];writes=[]
    state={"failSave":False,"lostResponse":False,"shelfFail":False,"hold":False}
    held=[]
    def route(r):
        u=urlparse(r.request.url)
        if u.netloc=="mock.invalid":
            if u.path=="/auth/v1/user":return r.fulfill(json=user)
            return r.abort()
        if u.netloc!=urlparse(B).netloc:return r.abort()
        path=u.path;method=r.request.method
        if not path.startswith("/api/"):return r.continue_()
        if path.endswith("/snapshots"):
            if method=="GET":
                if state["shelfFail"]:return r.fulfill(status=503,json={"error":"fixture"})
                return r.fulfill(json={"snapshots":snapshots})
            data=r.request.post_data_json;writes.append(data)
            if state["failSave"]:return r.fulfill(status=503,json={"error":"fixture"})
            existing=next((s for s in snapshots if s["payload"]==data["payload"] and s["source_id"]==data["sourceId"]),None)
            row=existing or {"id":"saved-"+str(len(snapshots)+1),"source_id":data["sourceId"],"partner_id":data["partnerId"],"payload":data["payload"],"created_at":"2026-10-21"}
            if not existing:snapshots.insert(0,row)
            if state["lostResponse"]:
                state["lostResponse"]=False
                return r.abort("connectionfailed")
            return r.fulfill(json={"snapshot":row})
        if "/snapshots/" in path and method=="DELETE":
            snapshots[:]=[s for s in snapshots if s["id"]!=path.split("/")[-1]]
            return r.fulfill(status=204)
        if path.endswith("/preview/generate"):
            return r.fulfill(content_type="text/event-stream",body="data: "+json.dumps({"type":"complete","report":report})+"\n\n")
        if path.endswith("/conversations"):
            if method=="POST":
                data=r.request.post_data_json
                ident="22222222-2222-4222-8222-"+str(len(history)+1).zfill(12)
                history.insert(0,{"id":ident,"kind":"self","birth_data":data["birthData"]})
                return r.fulfill(json={"id":ident})
            if state["hold"]:
                held.append(r);return
            return r.fulfill(json={"conversations":history})
        if path.endswith("/timing-history"):return r.fulfill(json={"cards":[year]})
        if path.endswith("/cards"):return r.fulfill(json={"cards":[chapter]})
        if path.endswith("/partners"):return r.fulfill(json={"partners":[]})
        if path.endswith("/saves"):
            assert method=="GET","Legacy bookmarks must never be rewritten by snapshot saving"
            return r.fulfill(json={"saves":[{"save_key":"chapter-personality-1"}]})
        if path.endswith("/books"):return r.fulfill(json={"books":[]})
        if path.endswith("/status"):return r.fulfill(json={"remaining":0})
        raise AssertionError(path)
    ctx.route("**/*",route)
    page=ctx.new_page();page.on("pageerror",lambda e:errors.append(str(e)))
    page.on("dialog",lambda d:d.accept())
    def create(date="1990"):
        for label,value in [("年",date),("月","04"),("日","15")]:
            page.get_by_label("生まれた"+label,exact=True).select_option(value)
        page.get_by_role("button",name="男性",exact=True).click()
        page.get_by_role("button",name="同意して、無料で読む",exact=True).click()
        page.wait_for_url(B+"/you")
        expect(page.get_by_role("heading",name="保存テストの性格",exact=True)).to_be_visible()
    page.goto(B+"/welcome");create()
    # UI navigation never removes a loaded reading while auth refresh is pending.
    state["hold"]=True
    page.evaluate("window.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(800);assert held
    expect(page.get_by_role("heading",name="保存テストの性格",exact=True)).to_be_visible()
    state["hold"]=False
    for r in held:r.fulfill(status=503,json={"error":"fixture"})
    page.get_by_role("link",name="保存テストの性格",exact=False).first.click()
    save=page.get_by_role("button",name="本棚に保存する",exact=True)
    state["failSave"]=True;save.click()
    expect(page.get_by_role("alert")).to_be_visible();assert len(snapshots)==0
    state["failSave"]=False;state["lostResponse"]=True;save.click()
    expect(page.get_by_role("alert")).to_be_visible();assert len(snapshots)==1
    save.click();expect(page.get_by_role("button",name="保存を取り消す",exact=True)).to_be_visible()
    assert len(snapshots)==1
    original=json.loads(json.dumps(snapshots[0]))
    page.goto(B+"/settings")
    page.get_by_role("button",name="入力をリセットして、別の鑑定を読む",exact=True).click()
    page.wait_for_url(B+"/welcome")
    expect(page.get_by_label("生まれた年",exact=True)).to_have_value("")
    create("1991")
    assert snapshots[0]==original
    # Hard reload represents a fresh browsing session: no automatic unsaved recovery.
    page.reload();page.wait_for_url(B+"/welcome?returnTo=%2Fyou")
    expect(page.get_by_label("生まれた年",exact=True)).to_have_value("")
    page.goto(B+"/books/saved")
    expect(page.get_by_text("以前の保存項目 1件は残っています。",exact=False)).to_be_visible()
    page.get_by_role("link",name="保存テストの性格",exact=False).click()
    expect(page.get_by_text("最初の本文を保存します。",exact=True)).to_be_visible()
    assert snapshots[0]==original
    page.screenshot(path="/private/tmp/fatelab-snapshot-20261021.png",full_page=True)
    page.get_by_role("button",name="本棚から削除",exact=True).click()
    expect(page.get_by_text("この保存項目は見つかりません。",exact=True)).to_be_visible()
    assert not snapshots and not errors,errors
    page.goto(B+"/books/legacy/chapter-personality-1")
    expect(page.get_by_text("確認できる鑑定がありません。",exact=False)).to_be_visible()
    expect(page.get_by_role("button",name="この内容で保存し直す")).to_have_count(0)
    page.goto(B+"/welcome");create("1992")
    page.get_by_role("button",name="メニューを開く").click()
    page.get_by_role("navigation",name="メニュー",exact=True).get_by_role("link",name="本棚",exact=False).click()
    page.get_by_role("link",name="お気に入りの鑑定",exact=False).click()
    page.get_by_role("link",name="性格の章（以前の保存）",exact=True).click()
    expect(page.get_by_text("保存当時の本文の復元ではなく",exact=False)).to_be_visible()
    re_save=page.get_by_role("button",name="この内容で保存し直す",exact=True)
    expect(re_save).to_be_disabled()
    page.get_by_role("checkbox").check()
    state["failSave"]=True;re_save.click()
    expect(page.get_by_role("alert")).to_be_visible();assert not snapshots
    state["failSave"]=False;re_save.click()
    expect(page.get_by_text("この内容は保存済みです。",exact=False)).to_be_visible()
    expect(re_save).to_have_count(0)
    assert len(snapshots)==1 and not errors,errors
    page.screenshot(path="/private/tmp/fatelab-legacy-review-20261021.png",full_page=True)
    print("PASS snapshots: explicit save, failure/retry, response loss idempotence, reset, fresh start, immutable saved display, legacy retention, delete")
    print("PASS legacy review: unavailable input, explicit confirmation, failed save retry, immutable original bookmark, saved-only action")
    browser.close()
