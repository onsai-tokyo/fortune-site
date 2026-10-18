"""Local demo-only OTP UI regression. No real email, keys, or account creation."""
import os
from playwright.sync_api import sync_playwright

B = os.environ.get('MOCK_E2E_BASE_URL', 'https://localhost:4173')
length = int(os.environ.get('MOCK_E2E_OTP_LENGTH', '8'))
assert length in range(6, 11)
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(ignore_https_errors=True)
    errors = []
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(B + '/demo')
    page.get_by_role('button', name='別の端末から引き継ぐ').click()
    assert page.get_by_text(f'届いた{length}桁のコード', exact=False).count() == 1
    page.fill('#restore-email', 'otp-fixture@example.invalid')
    page.get_by_role('button', name='コードを送る', exact=True).click()
    field = page.get_by_label(f'確認コード（{length}桁）', exact=True)
    assert field.get_attribute('maxlength') == str(length)
    assert page.get_by_text(f'に{length}桁のコードを送りました', exact=False).count() == 1
    assert page.get_by_text('メールに記載された有効期限内', exact=False).count() == 1
    submit = page.get_by_role('button', name='引き継ぐ', exact=True)
    field.fill('1' * (length - 1))
    assert submit.is_disabled()
    # Exercise the validation guard even if a client bypasses the disabled button.
    field.evaluate('(input) => input.form.requestSubmit()')
    assert page.get_by_role('alert').inner_text() == f'メールに届いた{length}桁の数字を入力してください。'
    field.fill('a1b2')
    assert field.input_value() == '12' and submit.is_disabled()
    field.fill('0' * length)
    assert submit.is_enabled()
    assert page.get_by_role('alert').count() == 0
    submit.click()
    page.wait_for_url(B + '/books')
    assert not errors, errors
    print(f'PASS OTP {length} digits: help / label / maxlength / error / leading zeros / restore; pageerrors []')
    browser.close()
