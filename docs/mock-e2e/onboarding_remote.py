"""Fresh anonymous REMOTE onboarding. All auth/API traffic is synthetic and external traffic blocked."""
import os, json, time, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://127.0.0.1:4242')
def segment(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')

user = {'id': '11111111-1111-4111-8111-111111111111', 'is_anonymous': True,
        'aud': 'authenticated', 'role': 'authenticated', 'app_metadata': {}, 'user_metadata': {}}
token = segment({'alg': 'HS256'}) + '.' + segment({'sub': user['id'], 'exp': int(time.time()) + 3600}) + '.fixture'
session = {'access_token': token, 'refresh_token': 'fixture', 'expires_in': 3600,
           'expires_at': int(time.time()) + 3600, 'token_type': 'bearer', 'user': user}
source = '22222222-2222-4222-8222-222222222222'
other_user = {**user, 'id': '33333333-3333-4333-8333-333333333333'}
other_token = segment({'alg': 'HS256'}) + '.' + segment({'sub': other_user['id'], 'exp': int(time.time()) + 3600}) + '.fixture'
other_session = {**session, 'access_token': other_token, 'user': other_user}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for entry, failure in [('/welcome', None), ('/', None), ('/welcome', 'signup'),
                           ('/welcome', 'calc'), ('/welcome', 'generate'), ('/welcome', 'save'),
                           ('/welcome', 'owner-switch'), ('/welcome', 'stale-history')]:
        ctx = browser.new_context(ignore_https_errors=True, viewport={'width': 390, 'height': 844})
        flags = {'failure': failure, 'saved': False, 'hold': True}
        pending, held_history, calls, errors, forbidden = [], [], [], [], []
        def route(r):
            req = r.request
            parsed = urlparse(req.url)
            path = parsed.path
            if parsed.netloc == 'mock.invalid':
                calls.append(('auth', path))
                if path == '/auth/v1/signup':
                    assert req.method == 'POST'
                    if flags['failure'] == 'signup':
                        return r.fulfill(status=503, json={'msg': 'synthetic signup failure'})
                    return r.fulfill(json=session)
                if path == '/auth/v1/user':
                    return r.fulfill(json=user)
                forbidden.append(path)
                return r.abort()
            if path.startswith('/api/'):
                calls.append((req.method, path))
                assert req.headers.get('authorization') in ['Bearer ' + token, 'Bearer ' + other_token]
                if req.method != 'GET': assert req.headers.get('authorization') == 'Bearer ' + token
                if path == '/api/web/calc/divination':
                    assert req.post_data_json['birthDate'] == '1990-01-15'
                    if flags['hold']:
                        pending.append(r)
                        return
                    return r.fulfill(status=503 if flags['failure'] == 'calc' else 200, json={})
                if path == '/api/web/preview/generate':
                    assert 'x-fatelab-ai-consent' not in req.headers
                    if flags['failure'] == 'generate':
                        return r.fulfill(status=503, json={'error': 'synthetic generation failure'})
                    body = 'data: ' + json.dumps({'type': 'complete', 'report': {'reportText': '合成の本人本文', 'calculatedData': {}}}) + '\n\n'
                    return r.fulfill(content_type='text/event-stream', body=body)
                if path == '/api/web/reading/conversations':
                    if req.method == 'POST':
                        if flags['failure'] == 'save':
                            return r.fulfill(status=503, json={'error': 'synthetic save failure'})
                        flags['saved'] = True
                        return r.fulfill(json={'id': source})
                    if failure == 'stale-history' and not flags['saved']:
                        held_history.append(r)
                        return
                    return r.fulfill(json={'conversations': [{'id': source, 'kind': 'self', 'birth_data': {
                        'birthDate': '1990-01-15', 'gender': 'female', 'birthplace': '東京都'}}] if flags['saved'] else []})
                if path == '/api/web/books/status': return r.fulfill(json={'remaining': 0})
                if path == '/api/web/books': return r.fulfill(json={'books': []})
                if path == '/api/web/partners': return r.fulfill(json={'partners': []})
                if path == '/api/web/reading/saves': return r.fulfill(json={'saves': []})
                if path.endswith('/timing-history'):
                    return r.fulfill(json={'cards': [{'id': 'turning-year-2026', 'title': '合成の2026年', 'summary': '本人の要約', 'pages': [{'text': '本人の年の本文'}]}]})
                if path.endswith('/cards'):
                    return r.fulfill(json={'cards': [{'id': 'personality-actual', 'title': '合成の本人見出し', 'kind': 'essence', 'scope': 'self', 'pages': [{'text': '本人の性格本文'}]}]})
                forbidden.append(path)
                return r.abort()
            if parsed.netloc != urlparse(B).netloc:
                return r.abort()
            r.continue_()
        ctx.route('**/*', route)
        if failure == 'stale-history':
            ctx.add_init_script('localStorage.setItem("sb-mock-auth-token",' + json.dumps(json.dumps(session)) + ')')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(B + entry)
        date = page.get_by_label('生年月日', exact=True)
        date.fill('1990-01-15')
        page.get_by_role('button', name='女性', exact=True).click()
        start = page.get_by_role('button', name='同意して、無料で読む', exact=True)
        start.click()
        if failure != 'signup':
            deadline = time.time() + 10
            while not pending and time.time() < deadline: page.wait_for_timeout(30)
            assert pending, (entry, failure, 'calc request never reached')
            page.wait_for_timeout(250)
            assert date.input_value() == '1990-01-15', 'new SIGNED_IN must not discard the initial form'
            assert page.get_by_role('button', name='読みものをつくっています…', exact=True).is_disabled()
            if failure == 'owner-switch':
                page.evaluate('s=>{const c=new BroadcastChannel("sb-mock-auth-token");c.postMessage({event:"SIGNED_IN",session:s});c.close()}', other_session)
                page.wait_for_timeout(150)
            flags['hold'] = False
            for r in pending:
                r.fulfill(status=503 if failure == 'calc' else 200, json={})
            pending.clear()
        if failure == 'owner-switch':
            page.get_by_role('alert').filter(has_text='読みものを作成できませんでした').wait_for()
            assert not flags['saved']
            assert not any(path == '/api/web/preview/generate' for _, path in calls)
            page.goto(B + '/you')
            page.wait_for_url(B + '/welcome?returnTo=%2Fyou')
            assert '1990-01-15' not in page.get_by_label('生年月日', exact=True).input_value()
            assert not forbidden and not errors
            print('PASS initial signup owner switch / old write stopped / new owner hydrated / no profile leakage')
            ctx.close()
            continue
        if failure in ['signup', 'calc', 'generate', 'save']:
            page.get_by_role('alert').filter(has_text='読みものを作成できませんでした').wait_for()
            assert date.input_value() == '1990-01-15'
            assert page.get_by_role('button', name='同意して、無料で読む', exact=True).is_enabled()
            flags['failure'] = None
            flags['hold'] = False
            page.get_by_role('button', name='同意して、無料で読む', exact=True).click()
        page.wait_for_url(B + '/you')
        page.get_by_role('heading', name='合成の本人見出し', exact=True).wait_for()
        if failure == 'stale-history':
            assert held_history, 'fixture must delay an older empty-history response'
            for r in held_history: r.fulfill(json={'conversations': []})
            held_history.clear()
            page.wait_for_timeout(200)
            assert page.get_by_role('heading', name='合成の本人見出し', exact=True).is_visible()
        assert '1990年1月15日生まれ' in page.locator('body').inner_text()
        assert '［サンプル］' not in page.locator('body').inner_text()
        if entry == '/welcome' and failure is None:
            page.screenshot(path='/private/tmp/fatelab-onboarding-fixed-local-20261019.png', full_page=True)
        assert flags['saved'] and not forbidden and not errors, (forbidden, errors)
        assert sum(path == '/auth/v1/signup' for _, path in calls) == (0 if failure == 'stale-history' else 2 if failure == 'signup' else 1)
        # Reload must recover the server profile, not bounce back to welcome.
        page.reload()
        page.get_by_role('heading', name='合成の本人見出し', exact=True).wait_for()
        assert page.url == B + '/you'
        print('PASS fresh anonymous onboarding', entry, failure or 'success', '/ retained input / retry / persisted reload / no AI')
        ctx.close()
    browser.close()
