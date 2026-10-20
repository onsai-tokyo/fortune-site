"""Local synthetic auth only; never sends real credentials."""
import os, json, time, base64
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
B = os.environ.get("MOCK_E2E_BASE_URL", "https://127.0.0.1:4322")
assert urlparse(B).hostname in ("localhost", "127.0.0.1")
def enc(v):
    return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip("=")
uid = "11111111-1111-4111-8111-111111111111"
user = {"id":uid,"email":"test@example.invalid","email_confirmed_at":"2026-01-01T00:00:00Z","is_anonymous":False,"aud":"authenticated","role":"authenticated","app_metadata":{},"user_metadata":{}}
token = enc({"alg":"HS256"})+"."+enc({"sub":uid,"exp":int(time.time())+3600})+".fixture"
session = {"access_token":token,"refresh_token":"fixture","token_type":"bearer","expires_in":3600,"user":user}
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True)
    unexpected, updates, oauth, errors = [], [], [], []
    def route(r):
        u = urlparse(r.request.url)
        if u.netloc == "mock.invalid":
            if u.path == "/auth/v1/token":
                if r.request.post_data_json["password"] != "fixture-password":
                    return r.fulfill(status=400, json={"error":"invalid_grant","error_description":"Invalid credentials"})
                return r.fulfill(json=session)
            if u.path == "/auth/v1/user":
                if r.request.method == "PUT":
                    assert r.request.headers["authorization"] == "Bearer "+token
                    updates.append(True)
                return r.fulfill(json=user)
            if u.path == "/auth/v1/authorize":
                oauth.append(parse_qs(u.query))
                return r.fulfill(content_type="text/html", body="<h1>Google fixture</h1>")
            unexpected.append(u.path)
            return r.abort()
        if u.netloc != urlparse(B).netloc:
            return r.abort()
        if u.path.startswith("/api/"):
            if r.request.method != "GET":
                unexpected.append(u.path)
                return r.abort()
            payload = {"cards":[]}
            if u.path.endswith("/conversations"):
                payload = {"conversations":[{"id":"owned","kind":"self","birth_data":{"birthDate":"1994-05-12","gender":"female"}}]}
            elif u.path.endswith("/partners"): payload = {"partners":[],"limit":1}
            elif u.path.endswith("/saves"): payload = {"saves":[]}
            elif u.path.endswith("/books"): payload = {"books":[]}
            elif u.path.endswith("/status"): payload = {"remaining":0}
            return r.fulfill(json=payload)
        r.continue_()
    ctx.route("**/*", route)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(B+"/restore?returnTo=https%3A%2F%2Fevil.invalid")
    page.locator("#password-login-email").fill("test@example.invalid")
    page.locator("#password-login-password").fill("wrong")
    page.get_by_role("button", name="パスワードでログイン", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("メールアドレス・パスワードを確認")
    page.locator("#password-login-password").fill("fixture-password")
    page.get_by_role("button", name="パスワードでログイン", exact=True).click()
    page.wait_for_url(B+"/books")
    page.goto(B+"/settings/link")
    page.locator("#new-password").fill("fixture-new-password")
    page.locator("#confirm-password").fill("mismatch")
    expect(page.get_by_role("button",name="パスワードを設定",exact=True)).to_be_disabled()
    page.locator("#confirm-password").fill("fixture-new-password")
    page.get_by_role("button",name="パスワードを設定",exact=True).click()
    expect(page.get_by_role("status")).to_contain_text("パスワードを設定しました")
    assert len(updates) == 1
    page.goto(B+"/restore?returnTo=%2Fbooks")
    page.get_by_role("button",name="Googleでログイン",exact=True).click()
    page.get_by_role("heading",name="Google fixture").wait_for()
    assert oauth[0]["provider"] == ["google"]
    redirect = urlparse(oauth[0]["redirect_to"][0])
    assert redirect.netloc == urlparse(B).netloc and redirect.path == "/restore"
    assert redirect.query == "oauth=1"
    assert not unexpected and not errors, (unexpected, errors)
    browser.close()
print("PASS password rejection/success, safe returnTo, password setup, Google redirect; no external requests")
