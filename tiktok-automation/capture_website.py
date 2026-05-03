"""
Webサイトキャプチャモジュール
Playwright で fate-lab.com を操作し、芸能人の生年月日を入力して
鑑定結果ページのフルスクリーンショットを取得する
"""

import os
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout


# TikTok映えするスマホビューポート
VIEWPORT = {"width": 390, "height": 844}
SITE_URL = os.getenv("SITE_URL", "https://fate-lab.com/")


def capture_fortune_result(
    celebrity: dict,
    output_dir: str = "output/captures",
) -> dict:
    """
    fate-lab.com で芸能人の生年月日を入力し、結果ページをキャプチャする

    Returns: {
        "form_screenshot": "フォーム画面のパス",
        "result_screenshot": "結果ページのフルスクショパス",
        "result_height": "結果ページの高さ(px)",
        "tekichu_y_ratio": 的中テキスト位置の比率(0.0〜1.0)のリスト
    }
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    name = celebrity["name"]

    result = {
        "form_screenshot": "",
        "result_screenshot": "",
        "result_height": 0,
        "tekichu_y_ratios": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=2,           # Retina風の高解像度
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
            locale="ja-JP",
        )
        page = context.new_page()

        try:
            # ── Step 1: トップページ表示 ──────────────────────────
            print(f"  fate-lab.com に接続中...")
            page.goto(SITE_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)

            # フォームセクションまでスクロール
            page.evaluate("window.scrollTo(0, 300)")
            page.wait_for_timeout(500)

            form_path = f"{output_dir}/{name}_form.png"
            page.screenshot(path=form_path)
            result["form_screenshot"] = form_path
            print(f"  フォーム画面キャプチャ完了")

            # ── Step 2: フォーム入力 ──────────────────────────────
            year  = str(celebrity["birth_year"])
            month = str(celebrity["birth_month"])
            day   = str(celebrity["birth_day"])

            # 年の select を探して選択
            try:
                year_sel = page.locator("select").first
                year_sel.select_option(value=year, timeout=5000)
            except Exception:
                try:
                    page.locator("select[name*='year'], select:nth-child(1)").select_option(year)
                except Exception:
                    pass

            page.wait_for_timeout(300)

            # 月・日
            selects = page.locator("select").all()
            if len(selects) >= 2:
                try:
                    selects[1].select_option(value=month)
                except Exception:
                    pass
            if len(selects) >= 3:
                try:
                    selects[2].select_option(value=day)
                except Exception:
                    pass

            page.wait_for_timeout(300)

            # 送信ボタンをクリック
            submitted = False
            for selector in [
                "button[type='submit']",
                "button:has-text('鑑定')",
                "button:has-text('生成')",
                "button:has-text('指南書')",
                ".btn-submit",
                "button.btn-primary",
            ]:
                try:
                    btn = page.locator(selector).first
                    if btn.is_visible(timeout=2000):
                        btn.click()
                        submitted = True
                        print(f"  フォーム送信完了 ({selector})")
                        break
                except Exception:
                    continue

            if not submitted:
                print("  送信ボタンが見つからず → 結果プレビューをキャプチャします")

            # ── Step 3: 結果ページ待機 ────────────────────────────
            print("  結果ページ読み込み待機中...")
            try:
                # 結果コンテンツが表示されるまで待機（最大20秒）
                page.wait_for_selector(
                    ".result-preview, .result-body, .result-section, [class*='result']",
                    timeout=20000,
                )
            except PWTimeout:
                # タイムアウトでも続行（プレビューが表示されている可能性）
                pass

            page.wait_for_timeout(2000)

            # ── Step 4: 結果ページ全体をキャプチャ ───────────────
            # ページ全体の高さを取得
            page_height = page.evaluate("document.body.scrollHeight")
            print(f"  ページ高さ: {page_height}px")

            result_path = f"{output_dir}/{name}_result.png"
            page.screenshot(path=result_path, full_page=True)
            result["result_screenshot"] = result_path
            result["result_height"] = page_height
            print(f"  結果ページキャプチャ完了: {result_path}")

            # ── Step 5: 的中テキストの Y 座標を取得 ──────────────
            # 各セクションの位置を取得して的中ポイントの候補を記録
            section_selectors = [
                ".result-section",
                "[class*='result-section']",
                ".section-content",
                "h2, h3",
            ]
            y_ratios = []
            for sel in section_selectors:
                elements = page.locator(sel).all()
                for el in elements[:5]:  # 最大5要素
                    try:
                        bbox = el.bounding_box()
                        if bbox and bbox["y"] > 100:
                            ratio = bbox["y"] / page_height
                            y_ratios.append(round(ratio, 3))
                    except Exception:
                        pass

            if y_ratios:
                # 重複排除・ソート・最大3点
                y_ratios = sorted(list(set(y_ratios)))
                # 真ん中あたりの位置を的中ポイントとして使う
                result["tekichu_y_ratios"] = y_ratios[:3]
            else:
                # フォールバック：ページの 30%, 55% 付近
                result["tekichu_y_ratios"] = [0.30, 0.55]

        except Exception as e:
            print(f"  キャプチャエラー: {e}")

        finally:
            browser.close()

    return result


def capture_toppage_preview(output_dir: str = "output/captures") -> str:
    """
    フォームが表示された状態のトップページをキャプチャ（フォールバック用）
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    output_path = f"{output_dir}/toppage_preview.png"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport=VIEWPORT,
            device_scale_factor=2,
        )
        page.goto(SITE_URL, wait_until="networkidle", timeout=20000)
        page.wait_for_timeout(1000)
        page.screenshot(path=output_path, full_page=True)
        browser.close()

    return output_path


if __name__ == "__main__":
    test_celeb = {
        "name": "大谷翔平",
        "birth_year": 1994,
        "birth_month": 7,
        "birth_day": 5,
    }
    result = capture_fortune_result(test_celeb)
    print(json.dumps(result, ensure_ascii=False, indent=2))
