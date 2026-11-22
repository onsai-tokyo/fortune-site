// Public examples are checked against the production calculation functions by
// scripts/article-data/reader-evidence.test.ts. All people are fictional.
export const birthTimeExample = {
  date: '1995-02-20',
  withTime: { time: '05:40', pillars: ['乙亥', '戊寅', '壬午', '癸卯'], scores: [2.5, 0.9, 1.4, 0, 2.6] },
  withoutTime: { pillars: ['乙亥', '戊寅', '壬午'], scores: [1.9, 0.9, 1.4, 0, 1.6] },
};

export const birthTimeComparison = `<section aria-labelledby="birth-time-example"><h2 id="birth-time-example">計算例：出生時刻を入れた場合と空欄の場合</h2>
<p>架空の人物として、1995年2月20日生まれの命式を比べます。時刻ありでは5時40分を入力し、時刻なしでは空欄にします。この日は節入り当日ではないため、年柱・月柱・日柱は同じです。</p>
<div class="table-scroll"><table><thead><tr><th scope="col">確認する項目</th><th scope="col">5時40分を入力</th><th scope="col">出生時刻は空欄</th></tr></thead><tbody>
${['年柱', '月柱', '日柱', '時柱'].map((label, i) => `<tr><th scope="row">${label}</th><td>${birthTimeExample.withTime.pillars[i]}</td><td>${birthTimeExample.withoutTime.pillars[i] ?? '表示しない'}</td></tr>`).join('')}
<tr><th scope="row">五行参考値（木・火・土・金・水）</th><td>${birthTimeExample.withTime.scores.join('・')}</td><td>${birthTimeExample.withoutTime.scores.join('・')}</td></tr>
</tbody></table></div><p>時刻なしの五行参考値には時柱の分を含めません。木が2.5から1.9、水が2.6から1.6になるのは、時柱を集計から外すためです。数字の合計が違う結果を、そのまま性格や運勢の優劣として比べないでください。</p>
<p>自分の場合は<a href="/tools/shichu-suimei-calculator">四柱推命の無料計算</a>で、時刻を入力した場合と空欄の場合を確認できます。立春・節入り当日に生まれた場合の注意点は<a href="/guides/setsuiri-boundary">年柱・月柱の境界の計算例</a>をご覧ください。</p></section>`;

export const calculationEvidence = `<h2 id="verification-examples">自分でも確認できる計算例</h2>
<p>次の例は、公開ツールと共通の計算方法で確認しています。入力条件をそろえて結果を比較するための例であり、占いによる将来予測の精度を示すものではありません。</p>
<div class="table-scroll"><table><thead><tr><th scope="col">確認すること</th><th scope="col">入力と結果</th><th scope="col">詳しい説明</th></tr></thead><tbody>
<tr><th scope="row">立春の前後</th><td>2024年2月4日17時00分は癸卯年・乙丑月、18時00分は甲辰年・丙寅月。日柱はいずれも戊戌。</td><td><a href="/guides/setsuiri-boundary">時刻と年柱・月柱の比較表</a></td></tr>
<tr><th scope="row">出生時刻の有無</th><td>1995年2月20日5時40分は乙亥・戊寅・壬午・癸卯。時刻なしは前三柱のみ。</td><td><a href="/guides/unknown-birth-time#birth-time-example">時柱と五行参考値の比較表</a></td></tr>
<tr><th scope="row">数秘術の計算</th><td>1995年2月20日は各桁の合計が28、2＋8＝10、1＋0＝1。2000年1月8日は合計11のため、そのまま11を表示。</td><td><a href="/tools/life-path-number">運命数を自分で計算する</a></td></tr>
</tbody></table></div><h2>暦の参照資料と計算の前提</h2>
<p>2024年の立春時刻は、<a href="https://eco.mtk.nao.ac.jp/koyomi/yoko/2024/rekiyou242.html">国立天文台「令和6年 暦要項・二十四節気および雑節」</a>の2月4日17時27分（日本標準時）と照らして確認しています。この暦資料が示すのは節気の時刻で、占術の解釈や的中率を裏付ける資料ではありません。</p>
<p>干支・節入りなどの暦計算には<a href="https://github.com/6tail/lunar-javascript">lunar-javascript</a>を使用しています。日柱・時柱では出生地経度による真太陽時補正を行いません。流派や時刻補正が異なるサービスと比較する際は、<a href="/tools/shichu-suimei-calculator#calculation-spec">公開計算ツールの仕様</a>も確認してください。</p>`;
