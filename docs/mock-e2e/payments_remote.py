"""Local REMOTE-mode contract test. Synthetic auth/API only; no real backend requests.

Build with VITE_SUPABASE_URL=https://mock.invalid VITE_SUPABASE_ANON_KEY=mock-anon-key
and VITE_PAYMENTS_ENABLED=false (or true with MOCK_PAYMENTS_ENABLED=true).
"""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://localhost:4176')
enabled = os.environ.get('MOCK_PAYMENTS_ENABLED') == 'true'
uid = '11111111-1111-4111-8111-111111111111'
source_id = '22222222-2222-4222-8222-222222222222'
book_id = '33333333-3333-4333-8333-333333333333'
user = {'id': uid, 'aud': 'authenticated', 'role': 'authenticated', 'is_anonymous': True, 'created_at': '2026-01-01T00:00:00Z', 'app_metadata': {}, 'user_metadata': {}}
def segment(data): return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')
token = segment({'alg': 'HS256', 'typ': 'JWT'}) + '.' + segment({'sub': uid, 'exp': int(time.time()) + 3600, 'role': 'authenticated'}) + '.synthetic-signature'
session = {'access_token': token, 'refresh_token': 'synthetic-refresh-only', 'expires_at': int(time.time()) + 3600, 'expires_in': 3600, 'token_type': 'bearer', 'user': user}

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True, viewport={'width': 390, 'height': 844})
    ctx.add_init_script('localStorage.setItem("sb-mock-auth-token", ' + json.dumps(json.dumps(session)) + ')')
    state = {'credits': 0, 'books': [], 'creates': 0, 'questions': 0, 'checkout': 0, 'birthDate': '1994-05-12'}
    external = []
    def route(r):
        request = r.request
        path = urlparse(request.url).path
        if path.startswith('/api/web/'):
            path = '/api/' + path[len('/api/web/'):]
        if request.url.startswith('https://mock.invalid/auth/v1/user'):
            return r.fulfill(json=user)
        if path.startswith('/api/'):
            if path.startswith('/api/web-payments'): state['checkout'] += 1
            data = {}
            if path == '/api/reading/conversations': data = {'conversations': [{'id': source_id, 'kind': 'self', 'title': 'テスト読みもの', 'birth_data': {'birthDate': state['birthDate'], 'gender': 'female'}}]}
            elif path == '/api/books/status': data = {'enabled': True, 'remaining': state['credits'], 'purchasedRemaining': state['credits']}
            elif path == '/api/partners': data = {'partners': []}
            elif path == '/api/reading/saves': data = {'saves': []}
            elif path.endswith('/timing-history'): data = {'cards': [{'id': 'year-2026', 'title': '2026年', 'sections': []}]}
            elif path.endswith('/cards'): data = {'cards': [{'id': 'distance', 'title': '人との距離', 'sections': []}]}
            elif path == '/api/books/validate': data = {'valid': True}
            elif path == '/api/books' and request.method == 'POST':
                assert state['credits'] > 0
                state['creates'] += 1; state['credits'] -= 1
                body = request.post_data_json
                assert len(body['question']) >= 20 and body['sourceId'] == source_id
                state['books'] = [{'id': book_id, 'sourceId': source_id, 'title': 'テストブック', 'targetTitle': 'テスト読みもの', 'question': body['question'], 'state': 'delivered', 'createdAt': '2026-10-18', 'theme': 'その他', 'questionsLeft': 2, 'document': {'title': 'テストブック', 'summary': 'テスト要約', 'answer': 'テスト回答', 'sections': [], 'actions': []}}]
                data = {'book': state['books'][0]}
            elif '/questions' in path and request.method == 'POST':
                state['questions'] += 1; data = {'state': 'completed', 'answer': 'テスト用回答です。'}
            elif path.startswith('/api/books/operations/'): data = {'book': state['books'][0] if state['books'] else None}
            elif path == '/api/books': data = {'books': state['books']}
            else: raise AssertionError('Unexpected mock API: ' + path)
            return r.fulfill(json=data)
        if urlparse(request.url).netloc == urlparse(B).netloc: return r.continue_()
        external.append(request.url)
        return r.abort()
    ctx.route('**/*', route)
    page = ctx.new_page(); errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(B + '/'); page.get_by_role('link', name='つづきを読む').first.wait_for()
    def nav(path):
        page.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}", path)
        page.wait_for_timeout(350)
    nav('/demo'); assert urlparse(page.url).path == '/'  # REMOTE cannot inject demo credits.
    nav('/credits')
    if enabled:
        page.fill('#receipt-email', 'synthetic@example.invalid')
        page.get_by_role('button', name='5冊セットを買う（1,980円）').click()
        page.get_by_role('alert').get_by_text('お支払い機能は接続準備中です。', exact=False).wait_for()
    else:
        page.get_by_role('heading', name='相談のブックは準備中です', exact=True).wait_for()
        assert page.get_by_role('button', name='買う', exact=False).count() == 0
        nav('/credits/return?plan=pack5&status=done')
        page.get_by_role('heading', name='相談のブックは準備中です', exact=True).wait_for()
    page.wait_for_timeout(3000)
    nav('/compose')
    question = '人と仲良くなるのに時間がかかります。距離の縮め方について具体的に教えてください。'
    page.fill('#question', question)
    page.get_by_role('checkbox').check()
    if enabled:
        assert page.get_by_role('button', name='500円で一冊つくる', exact=True).count() == 1
        assert page.get_by_text('残り 5冊', exact=True).count() == 0
    if not enabled:
        assert page.get_by_role('button', name='相談のブックは準備中です', exact=True).is_disabled()
        nav('/books'); nav('/compose'); assert page.input_value('#question') == question
        # Restore session/profile asynchronously after reload, then reopen compose.
        page.goto(B + '/'); page.get_by_role('link', name='つづきを読む').first.wait_for(); nav('/compose')
        assert page.input_value('#question') == question
        nav('/'); assert page.get_by_text('500円', exact=False).count() == 0
        nav('/books'); page.get_by_role('button', name='メニューを開く').click()
        assert page.get_by_role('link', name='買い足す', exact=False).count() == 0
    assert state['credits'] == 0 and state['creates'] == 0 and state['checkout'] == 0
    print('PASS REMOTE purchase and direct return never mint credits; disabled UI/draft checked')
    # Simulate one server-confirmed administrator grant; do not invoke an actual grant RPC.
    state['credits'] = 1
    page.goto(B + '/'); page.get_by_role('link', name='つづきを読む').first.wait_for()
    nav('/compose'); page.get_by_text('残り 1冊', exact=True).wait_for(); page.fill('#question', question)
    page.get_by_role('checkbox').check(); page.get_by_role('button', name='一冊つくる（残り1冊）', exact=True).click()
    page.get_by_role('link', name='テストブック', exact=False).wait_for()
    assert state['credits'] == 0 and state['creates'] == 1
    nav('/books/' + book_id + '/ask')
    for index in range(2):
        if page.get_by_role('checkbox').count(): page.get_by_role('checkbox').check()
        page.fill('#ask', 'このブックの内容をもう少し具体的に教えてください。')
        page.get_by_role('button', name='送信', exact=True).click()
        page.get_by_text('あと' + str(1 - index) + '回', exact=True).wait_for()
    assert state['questions'] == 2 and not errors
    assert not any('onrender.com' in url or 'supabase.co' in url or 'anthropic' in url for url in external)
    print('PASS administrator-granted credit permits real-API-shaped create and two questions; pageerrors []')
    # Even administrator-granted credits must not enable AI for minors.
    from datetime import datetime, timezone, timedelta
    current_year = datetime.now(timezone(timedelta(hours=9))).year
    for age in (15, 17):
        state['birthDate'] = str(current_year-age) + '-01-01'
        state['credits'] = 1
        state['books'][0]['questionsLeft'] = 2
        before = (state['creates'], state['questions'])
        page.goto(B + '/'); page.get_by_role('link', name='つづきを読む').first.wait_for()
        nav('/compose')
        page.fill('#question', question)
        page.get_by_role('status').get_by_text('AIの相談ブック作成・質問は18歳以上', exact=False).wait_for()
        assert page.get_by_role('button', name='一冊つくる（残り1冊）', exact=True).is_disabled()
        nav('/books'); nav('/compose')
        assert page.input_value('#question') == question
        nav('/books/' + book_id + '/ask')
        assert page.locator('#ask').is_disabled()
        assert page.get_by_role('button', name='送信', exact=True).is_disabled()
        assert (state['creates'], state['questions']) == before and state['credits'] == 1
    assert not errors, errors
    print('PASS ages 15/17 retain drafts and existing books but cannot create/ask, even with a granted credit')
    browser.close()
