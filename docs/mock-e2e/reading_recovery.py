"""Synthetic REMOTE only: lost generation response, explicit recovery, empty reading UI."""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
B = os.environ.get("MOCK_E2E_BASE_URL", "https://127.0.0.1:4322")
assert urlparse(B).hostname in ("localhost", "127.0.0.1")
def enc(v):
    return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip("=")
uid = "11111111-1111-4111-8111-111111111111"
user = {"id":uid,"is_anonymous":True,"aud":"authenticated","role":"authenticated","app_metadata":{},"user_metadata":{}}
token = enc({"alg":"HS256"})+"."+enc({"sub":uid,"exp":int(time.time())+3600})+".fixture"
session = {"access_token":token,"refresh_token":"fixture","token_type":"bearer","expires_at":int(time.time())+3600,"expires_in":3600,"user":user}
birth = {"birthDate":"1994-05-12","gender":"female"}
chapter = {"id":"personality-1","kind":"personality","title":"確認用の性格","summary":"人生の軸","sections":[{"heading":"特徴","body":"合成APIの性格本文です。"}]}
year = {"id":"turning-year-2026","kind":"timing","title":"確認用の今年","sections":[{"heading":"流れ","body":"合成APIの年表本文です。"}]}
report = {"version":3,"reportText":"確認用の鑑定","cards":[chapter,year]}
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True, viewport={"width":390,"height":844})
    ctx.add_init_script("localStorage.setItem('sb-mock-auth-token', "+json.dumps(json.dumps(session))+");")
    state = {"saved":False,"empty":False,"generates":0,"checks":0,"saves":0}
    errors = []
    def route(r):
        u = urlparse(r.request.url)
        if u.netloc == "mock.invalid":
            if u.path == "/auth/v1/user": return r.fulfill(json=user)
            return r.abort()
        if u.netloc != urlparse(B).netloc: return r.abort()
        if u.path.startswith("/api/"):
            if "/preview/generations/" in u.path:
                state["checks"] += 1
                return r.fulfill(json={"state":"completed","result":report})
            if u.path.endswith("/preview/generate"):
                state["generates"] += 1
                payload = r.request.post_data_json
                assert payload["birthplace"] == ""
                assert payload["birthTimeZone"] == "Asia/Tokyo"
                if state["saved"]:
                    return r.fulfill(content_type="text/event-stream", body="data: "+json.dumps({"type":"complete","report":report})+"\n\n")
                return r.abort("connectionfailed")
            if u.path.endswith("/conversations"):
                if r.request.method == "POST":
                    payload = r.request.post_data_json["birthData"]
                    assert payload["birthplace"] == ""
                    assert payload["birthTimeZone"] == "Asia/Tokyo"
                    state["saved"] = True
                    state["saves"] += 1
                    return r.fulfill(json={"id":"owned"})
                return r.fulfill(json={"conversations":[{"id":"owned","kind":"self","birth_data":birth}] if state["saved"] else []})
            if u.path.endswith("/timing-history"): return r.fulfill(json={"cards":[] if state["empty"] else [year]})
            if u.path.endswith("/cards"): return r.fulfill(json={"cards":[] if state["empty"] else [chapter]})
            if u.path.endswith("/partners"): return r.fulfill(json={"partners":[]})
            if u.path.endswith("/saves"): return r.fulfill(json={"saves":[]})
            if u.path.endswith("/books"): return r.fulfill(json={"books":[]})
            if u.path.endswith("/status"): return r.fulfill(json={"remaining":0})
            raise AssertionError(u.path)
        r.continue_()
    ctx.route("**/*", route)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(B+"/")
    for label, value in [('年','1994'),('月','05'),('日','12')]:
        page.get_by_label('生まれた'+label, exact=True).select_option(value)
    page.get_by_role("button",name="女性",exact=True).click()
    page.get_by_role("button",name="同意して、無料で読む",exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("入力は残っています")
    page.reload()
    page.get_by_role("link",name="出生情報を確認して再開",exact=True).click()
    expect(page.get_by_label("生まれた年",exact=True)).to_have_value("1994")
    page.get_by_role("button",name="保存する",exact=True).click()
    page.wait_for_url(B+"/you")
    expect(page.get_by_role("heading",name="確認用の性格",exact=True)).to_be_visible()
    assert (state["generates"],state["checks"],state["saves"]) == (1,1,1), state
    state["empty"] = True
    page.reload()
    expect(page.get_by_role("link",name="出生情報を確認して作成する",exact=True)).to_be_visible()
    page.goto(B+"/")
    expect(page.get_by_role("link",name="出生情報を確認して再開",exact=True)).to_be_visible()
    assert page.get_by_text("あなたの読みものは、この端末に用意してあります。",exact=True).count() == 0
    page.get_by_role("link",name="出生情報を確認して再開",exact=True).click()
    page.get_by_role("button",name="保存する",exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("読みものを作成できませんでした。入力は残っています")
    assert state["saves"] == 2, state
    assert "/welcome" in page.url, page.url
    assert not errors, errors
    print("PASS synthetic REMOTE: lost response recovered without regeneration; empty result is not advertised as ready")
    browser.close()
