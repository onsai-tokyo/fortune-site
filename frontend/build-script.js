import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://fate-lab.com';
const SITE_NAME = 'Fate Lab';
const UPDATED = '2026-08-11';
const distDir = path.join(process.cwd(), 'dist');
const lpPath = path.join(distDir, 'lp.html');
const indexPath = path.join(distDir, 'index.html');

const appRoutes = [
  ['feature/self', '無料の自己分析｜強み・適職・人生の転換期を命式で診断', '生年月日から複数の占術を統合し、性格の本質、強み・弱み、適職、人生の転換期を診断します。'],
  ['feature/compat', '無料の相性診断｜生年月日で恋愛・仕事の相性を鑑定', '2人の生年月日から、恋愛や仕事の相性、価値観、関係を良くするヒントを複数の占術で読み解きます。'],
  ['feature/marriage', '結婚相性占い｜生年月日で夫婦関係・結婚生活を診断', '2人の生年月日から結婚相性、夫婦の力関係、結婚生活を円満にするヒントを統合鑑定で読み解きます。'],
  ['feature/org', '組織診断｜チームの人間関係と相性を命式で分析', 'メンバーの生年月日から、チームのキーパーソン、役割、人間関係、組織の戦い方を分析します。'],
  ['feature/recruit', '採用・他己分析｜候補者の強みと適性を命式で診断', '候補者の生年月日から強み、仕事の適性、面接官との相性を複数の占術で分析します。'],
  ['feature/boss', '上司との相性占い｜接し方とコミュニケーションを診断', '上司とあなたの生年月日から、相性、伝わりやすい言葉、関係を良くするヒントを診断します。'],
  ['feature/subordinate', '部下との相性占い｜育成・マネジメントのコツを診断', '部下とあなたの生年月日から、モチベーション、成長ポイント、効果的な接し方を診断します。'],
  ['feature/client', '取引先との相性占い｜信頼構築と商談の進め方を診断', '取引先担当者とあなたの生年月日から、意思決定の傾向、相性、信頼構築のポイントを診断します。'],
  ['feature/direction', '吉方位診断｜九星気学と四柱推命で方位を鑑定', '生年月日から九星気学と四柱推命を統合し、引越し、出張、旅行、デスク配置の方位を診断します。'],
  ['privacy', 'プライバシーポリシー', 'Fate Labにおける個人情報の取り扱いについて説明します。'],
  ['terms', '利用規約', 'Fate Labのサービス利用条件について説明します。'],
  ['tokushohou', '特定商取引法に基づく表記', 'Fate Labの特定商取引法に基づく表記です。'],
].map(([path, title, description]) => ({ path, title, description }));

const guides = [
  {
    path: 'guides/shichu-suimei',
    title: '四柱推命とは？命式の見方と生年月日でわかること',
    description: '四柱推命の年柱・月柱・日柱・時柱、十干十二支、出生時間が不明な場合の考え方を初心者向けに解説します。',
    body: `<p>四柱推命は、生まれた年・月・日・時刻を「年柱・月柱・日柱・時柱」という4つの柱に置き換え、十干と十二支の組み合わせから傾向を読み解く占術です。4つの柱を合わせた表は「命式」と呼ばれます。</p><h2>四柱は何を表すのか</h2><p><strong>年柱</strong>は家系や幼少期、<strong>月柱</strong>は仕事や社会性、<strong>日柱</strong>は本人の本質や配偶者との関係、<strong>時柱</strong>は内面や晩年を見る手がかりとされます。ひとつの柱だけで断定せず、命式全体の五行や陰陽のバランスを合わせて解釈します。</p><h2>出生時間が不明でも鑑定できる？</h2><p>出生時間がわからない場合は時柱を除く三柱で大枠を確認できます。ただし、時柱を使う項目は判断材料が減るため、Fate Labでは不明な時刻を推測で埋めません。母子手帳などで確認できる場合は時刻まで入力してください。</p><h2>Fate Labでの扱い</h2><p>Fate Labは四柱推命だけで結論を出さず、東洋・西洋・インドの複数占術で繰り返し現れる特徴を整理します。結果は未来を保証するものではなく、自己理解や対話の材料として提供します。</p>`
  },
  {
    path: 'guides/birthdate-fortune',
    title: '生年月日占いでわかること｜9つの占術の違いを解説',
    description: '生年月日占いでわかる性格・適職・恋愛傾向と、Fate Labが扱う9つの占術の役割を解説します。',
    body: `<p>生年月日占いは、生まれた日時を暦、天体、数の体系に当てはめ、性格や行動の傾向を整理する方法です。Fate Labは、四柱推命・算命学・納音・宿曜・九星気学・数秘術・紫微斗数・西洋占星術・インド占星術を扱います。</p><h2>東洋・西洋・インドで見る角度が違う</h2><p>四柱推命や算命学は干支と暦、西洋占星術は出生時の天体配置、インド占星術は恒星黄道、数秘術は生年月日の数を軸にします。異なる体系なので、同じ意味を別の言葉で示す場合も、異なる側面を強調する場合もあります。</p><h2>統合する理由</h2><p>Fate Labでは、占術を単に並べず、3種類以上で一致した性質を中心にまとめます。一つの占術だけに現れる特徴は断定せず、補足情報として扱います。</p><h2>結果の活用方法</h2><p>結果は「当たる・外れる」だけでなく、自分の経験と照らし合わせてください。医療・法律・金融・採用など重要な判断は、資格を持つ専門家や客観的な情報と合わせて決めましょう。</p>`
  },
  {
    path: 'guides/compatibility',
    title: '生年月日による相性占い｜恋愛・結婚・仕事で見るポイント',
    description: '生年月日から恋愛、結婚、仕事の相性を見る観点と、結果を関係改善に活かす方法を解説します。',
    body: `<p>相性占いは、2人の生年月日から性格や行動の傾向を比較し、噛み合いやすい点と違いが出やすい点を整理するものです。良し悪しを一つの点数で断定するより、関係を築くヒントとして使うのが適しています。</p><h2>目的によって見る観点が違う</h2><p><strong>恋愛</strong>では感情表現や距離感、<strong>結婚</strong>では生活リズムや役割分担、<strong>仕事</strong>では意思決定や報告の仕方を重視します。同じ2人でも、関係の目的によって相性の現れ方は変わります。</p><h2>違いは弱点とは限らない</h2><p>似ている2人は意思疎通が早い一方、同じ弱点を抱えることがあります。異なる2人は誤解が生じやすい反面、役割を補い合える場合があります。</p><h2>決めつけに使わない</h2><p>相性診断は別れや結婚を指示するものではありません。気になる表現は相手を決めつける材料にせず、実際の会話で確認してください。</p>`
  },
  {
    path: 'guides/birth-chart', title: '命式とは？無料鑑定で確認する年柱・月柱・日柱・時柱',
    description: '四柱推命の命式を構成する四つの柱と、無料鑑定で確認できる項目を解説します。',
    body: `<p>命式は、生年月日時を暦の規則に沿って干支へ置き換えた表です。四柱推命では年・月・日・時の四つの柱を使い、それぞれに天干と地支が入ります。</p><h2>命式で最初に見る項目</h2><p>中心になるのは日柱の天干である「日干」です。そのうえで月令、五行の偏り、陰陽の配分、柱同士の関係を確認します。単独の記号だけで性格や運勢を断定するものではありません。</p><h2>節入りと出生地</h2><p>年柱と月柱は元日や毎月1日ではなく節入りで切り替わります。境界付近では出生時刻が結果に影響します。また方式によって時刻補正の扱いが異なるため、計算基準の明示が重要です。</p><h2>無料鑑定での確認</h2><p>Fate Labは入力条件から命式を計算し、他の占術と共通する傾向を統合します。時刻が不明な場合は、時刻を必要とする項目を省略して表示します。</p>`
  },
  {
    path: 'guides/day-master', title: '日干とは？十干から見る自分の本質',
    description: '四柱推命で本人を表す日干と、甲・乙・丙・丁・戊・己・庚・辛・壬・癸の基本的な見方を解説します。',
    body: `<p>日干は、日柱の上段にある天干です。四柱推命では「自分自身」を表す基準点として扱い、甲・乙・丙・丁・戊・己・庚・辛・壬・癸の10種類があります。</p><h2>十干と五行・陰陽</h2><p>甲乙は木、丙丁は火、戊己は土、庚辛は金、壬癸は水に属します。同じ五行でも陽と陰で表れ方が異なると考えます。たとえば甲は大樹、乙は草花というように象徴で説明されます。</p><h2>日干だけで性格は決まらない</h2><p>日干は入口ですが、季節を示す月支、周囲の干支、五行の強弱によって同じ日干でも表れ方が変わります。「甲だから必ずリーダー」のような決めつけは避ける必要があります。</p><h2>統合鑑定での役割</h2><p>Fate Labでは日干の象徴を、算命学や星座、数秘など別の体系から得た傾向と照合し、共通点を中心に文章化します。</p>`
  },
  {
    path: 'guides/five-elements', title: '五行バランスとは？木・火・土・金・水の見方',
    description: '四柱推命や算命学で使われる五行の意味、過不足の読み方、日常への活かし方を解説します。',
    body: `<p>五行は、自然や物事の働きを木・火・土・金・水の五つに整理する考え方です。命式では各干支を五行へ対応させ、どの要素が強いか、支え合うか、抑え合うかを見ます。</p><h2>多いほど良いわけではない</h2><p>特定の要素が多いことを、そのまま才能や幸運と判断することはできません。季節、日干との関係、他の要素との循環によって意味が変わります。</p><h2>欠けている五行の扱い</h2><p>命式にない要素が即座に弱点を意味するわけでもありません。環境、行動、仕事、人間関係の中で別の形として補われる場合があります。</p><h2>結果との付き合い方</h2><p>五行バランスは、自分が力を使いやすい場面や疲れやすいパターンを考える補助線として使ってください。健康状態の診断には使用できません。</p>`
  },
  {
    path: 'guides/personality', title: '生年月日で性格診断｜本質・強み・弱みの読み解き方',
    description: '生年月日から性格、本質、強み、弱みを読み解くときの考え方と、診断結果の活用方法を解説します。',
    body: `<p>生年月日による性格診断は、行動を一つに決めつけるものではなく、反応しやすい傾向や価値を置きやすい領域を整理するものです。育った環境や経験によって実際の行動は変わります。</p><h2>本質と社会的な振る舞い</h2><p>内面で大切にする価値観と、職場や家庭で見せる姿は一致しないことがあります。複数占術を使うと、内面、対人表現、意思決定など異なる層を分けて考えやすくなります。</p><h2>強みと弱みは表裏一体</h2><p>慎重さは正確さにも決断の遅さにもなり、行動力は推進力にも見切り発車にもなります。診断では性質そのものより、どの環境で活かしやすいかを見ることが大切です。</p><h2>結果を検証する</h2><p>当てはまる記述には具体的な経験を書き出し、当てはまらない記述は無理に受け入れないでください。自己理解の仮説として扱うのが適切です。</p>`
  },
  {
    path: 'guides/career', title: '生年月日で適職診断｜才能と働き方を考えるヒント',
    description: '生年月日占いを適職、強み、働き方の検討に活かす方法と、注意点を解説します。',
    body: `<p>適職診断は特定の職業を断定するものではありません。人と関わる量、変化の多さ、裁量、専門性、成果が出るまでの時間など、力を発揮しやすい働き方の条件を考えるために使います。</p><h2>才能と職業名を分ける</h2><p>同じ分析力でも、研究、企画、経理、エンジニアリングなど複数の職業で活かせます。診断結果は職業名より、得意な役割や課題への向き合い方として読む方が実用的です。</p><h2>環境との相性</h2><p>能力があっても、評価制度やチーム文化が合わなければ消耗します。個人作業と協働、安定と変化、短期成果と長期育成のどちらを好むかも確認しましょう。</p><h2>重要な判断は客観情報と合わせる</h2><p>転職や採用は、経験、スキル、労働条件、面接、適性検査など客観的な情報を中心に判断してください。占いだけを採否の根拠にしてはいけません。</p>`
  },
  {
    path: 'guides/unknown-birth-time', title: '出生時間がわからない場合の占い｜何が変わる？',
    description: '出生時間が不明な場合に四柱推命・紫微斗数・西洋占星術などで変わる項目と、確認方法を解説します。',
    body: `<p>出生時間が不明でも、生年月日だけで確認できる占術はあります。ただし、四柱推命の時柱、西洋占星術のハウス、紫微斗数の命盤など、時刻を必要とする項目は精度を保ったまま確定できません。</p><h2>推測で入力しない</h2><p>正午など仮の時刻を入れる方法もありますが、確定結果と誤解しやすくなります。Fate Labでは不明を選べるようにし、時刻依存の項目を省略します。</p><h2>確認できる資料</h2><p>母子手帳、出生届の控え、病院の記録、家族の記憶が手がかりになります。「朝」「夕方」まで分かる場合でも、境界付近では結果が変わる可能性があります。</p><h2>不明でも分かること</h2><p>四柱推命の三柱、数秘術、九星気学など、生年月日だけで算出できる範囲から性格や行動傾向の大枠を整理できます。</p>`
  },
  {
    path: 'guides/east-west-astrology', title: '四柱推命と西洋占星術の違い｜統合して読む理由',
    description: '四柱推命と西洋占星術の計算方法、得意な見方、結果が異なる理由を初心者向けに解説します。',
    body: `<p>四柱推命は生年月日時を干支と節気の暦へ置き換え、西洋占星術は出生時の太陽・月・惑星の位置を円形のチャートに表します。前提となる体系が違うため、同じ人物を別の言葉で説明します。</p><h2>四柱推命が見るもの</h2><p>日干を中心に、季節、五行、陰陽、干支同士の関係を読みます。10年単位の大運など、時間の流れを段階的に捉える仕組みがあります。</p><h2>西洋占星術が見るもの</h2><p>惑星がどの星座やハウスにあるか、惑星同士がどの角度を作るかを見ます。出生時間が分かると、上昇星座やハウスを詳しく確認できます。</p><h2>統合する際の注意</h2><p>異なる体系を無理に一対一対応させず、独立して計算したうえで、複数の結果に共通する行動傾向を抽出することが大切です。</p>`
  },
];

const infoPages = [
  { path: 'about', title: 'Fate Labについて', description: 'Fate Labの目的、提供する無料統合占い、運営方針についてご案内します。', body: `<p>Fate Lab（フェイトラボ）は、生年月日・出生時刻・出生地から複数の占術を計算し、自己理解の材料を提供するオンラインサービスです。</p><h2>提供するもの</h2><p>東洋・西洋・インドの9つの占術を独立して計算し、複数の体系で共通して現れた本質・仕事・恋愛などの傾向を統合鑑定書として表示します。</p><h2>大切にしていること</h2><p>同じ入力条件には同じ結果を返すこと、計算できない項目を推測で埋めないこと、結果を人生の断定ではなく対話の出発点として提示することを大切にしています。</p><h2>運営</h2><p>Fate Lab運営事務局が企画・開発・運営しています。お問い合わせは<a href="/contact">お問い合わせページ</a>をご覧ください。</p>` },
  { path: 'methodology', title: '鑑定ロジックと計算方針', description: 'Fate Labが複数占術を計算・統合する方法、再現性、出生時間が不明な場合の扱いを説明します。', body: `<p>Fate Labは、入力された生年月日・出生時刻・出生地・性別から各占術を個別に計算し、定めた解釈ルールで結果を統合します。</p><h2>独立計算</h2><p>四柱推命、算命学、納音、宿曜、九星気学、数秘術、紫微斗数、西洋占星術、インド占星術を、それぞれの前提に沿って計算します。異なる体系の記号を無理に同一視しません。</p><h2>一致する傾向を優先</h2><p>3種類以上の占術で共通して現れる行動傾向を中心に鑑定書へ反映します。単独の結果は補足として扱い、強い断定を避けます。</p><h2>不明情報の扱い</h2><p>出生時間が不明な場合、時柱、ハウスなど時刻に依存する項目を省略します。推測した時刻を確定情報として使用しません。</p><h2>限界</h2><p>占術は科学的な性格検査や医療診断ではありません。結果はエンターテインメントおよび自己理解を目的とし、重要な意思決定の唯一の根拠にはできません。</p>` },
  { path: 'editorial-policy', title: 'コンテンツ制作方針', description: 'Fate Labの占い解説記事、計算根拠、更新、表現、免責に関する制作方針です。', body: `<p>Fate Labは、読者が占術の前提と限界を理解し、結果を安全に活用できるコンテンツを目指します。</p><h2>制作原則</h2><p>計算方法と解釈を区別し、複数の流派がある事項は一つを絶対視しません。恐怖をあおる表現、健康・投資・法律上の結果を保証する表現を使用しません。</p><h2>更新と訂正</h2><p>計算仕様や解説を変更した場合は内容を見直し、記事の更新日を表示します。誤りのご連絡は<a href="/contact">お問い合わせページ</a>から受け付けます。</p><h2>AIの扱い</h2><p>初回の統合鑑定書は各占術の計算結果と固定ルールから生成します。記事や結果は、最終的に利用者自身が経験や客観情報と照合できる表現にします。</p>` },
  { path: 'contact', title: 'お問い合わせ', description: 'Fate Labへのお問い合わせ、内容の訂正依頼、個人情報に関する窓口をご案内します。', body: `<p>サービスに関するご質問、表示内容の訂正、個人情報に関するご相談は、下記窓口へご連絡ください。</p><h2>メール窓口</h2><p><a href="mailto:support@fate-lab.com">support@fate-lab.com</a></p><p>お問い合わせの際は、対象ページのURLと状況をお書きください。パスワード、クレジットカード番号などの機密情報は送信しないでください。</p><h2>返信について</h2><p>内容を確認のうえ順次返信します。営業・勧誘、鑑定結果の個別解釈、緊急性の高い医療・法律相談には対応できません。</p>` },
];

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const writePage = (routePath, html) => {
  const routeDir = path.join(distDir, ...routePath.split('/'));
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), html);
};

function appPageHtml(template, route) {
  const canonical = `${SITE_URL}/${route.path}`;
  const title = route.path.startsWith('feature/') ? route.title : `${route.title}｜${SITE_NAME}`;
  const robots = route.path.startsWith('feature/') ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  return template
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${robots}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`);
}

const sharedStyle = `body{margin:0;background:#faf7ef;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;line-height:1.9}header,main,footer{max-width:820px;margin:auto;padding:20px 24px}header{border-bottom:1px solid #d4c5a0}a{color:#72500f}h1{font-size:clamp(28px,6vw,42px);line-height:1.4;margin:44px 0 20px}h2{font-size:24px;margin-top:44px;border-left:4px solid #c9a961;padding-left:14px}p{margin:18px 0}nav{display:flex;gap:18px;flex-wrap:wrap;font-size:14px}.breadcrumb{font-size:13px;color:#685f55;margin-top:24px}.cta{display:block;margin:48px 0 24px;padding:18px;text-align:center;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px}.related{padding:20px;background:#fffdf8;border:1px solid #d4c5a0;border-radius:8px}.related a{display:block;margin:8px 0}footer{margin-top:48px;border-top:1px solid #d4c5a0;font-size:13px;color:#5f564c}`;
const nav = `<nav><a href="/">Fate Lab</a><a href="/guides/">占い解説</a><a href="/methodology">鑑定ロジック</a><a href="/about">運営情報</a></nav>`;
const footer = `<footer><nav><a href="/about">Fate Labについて</a><a href="/editorial-policy">制作方針</a><a href="/contact">お問い合わせ</a><a href="/privacy">プライバシー</a><a href="/terms">利用規約</a></nav><p>© Fate Lab</p></footer>`;

function staticHtml(page, type = 'Article') {
  const canonical = `${SITE_URL}/${page.path}`;
  const title = `${page.title}｜${SITE_NAME}`;
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': type, headline: page.title, name: page.title, description: page.description, inLanguage: 'ja', mainEntityOfPage: canonical, datePublished: '2026-08-10', dateModified: UPDATED, author: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` }, publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/`, logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-fate-lab.png` } }, image: `${SITE_URL}/og-fate-lab.png` },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Fate Lab', item: `${SITE_URL}/` }, { '@type': 'ListItem', position: 2, name: page.title, item: canonical }] }
    ]
  };
  const related = guides.filter(g => g.path !== page.path).slice(0, 4).map(g => `<a href="/${g.path}">${escapeHtml(g.title)}</a>`).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(page.description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="${canonical}"><meta property="og:type" content="${type === 'Article' ? 'article' : 'website'}"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="Fate Lab"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(page.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-fate-lab.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${SITE_URL}/og-fate-lab.png"><style>${sharedStyle}</style><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head><body><header>${nav}</header><main><div class="breadcrumb"><a href="/">Fate Lab</a> › ${type === 'Article' ? '<a href="/guides/">占い解説</a> › ' : ''}${escapeHtml(page.title)}</div><article><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p>${page.body}</article>${type === 'Article' ? `<aside class="related"><strong>関連する占い解説</strong>${related}</aside>` : ''}<a class="cta" href="/#form">生年月日を入力して無料で鑑定する</a><p>最終更新日：${UPDATED}</p></main>${footer}</body></html>`;
}

function guideIndexHtml() {
  const page = { path: 'guides/', title: '生年月日占い・四柱推命の基礎知識', description: '四柱推命、命式、日干、五行、性格、適職、相性など、生年月日占いの基礎をFate Labが解説します。' };
  const cards = guides.map(g => `<li><a href="/${g.path}"><strong>${escapeHtml(g.title)}</strong><span>${escapeHtml(g.description)}</span></a></li>`).join('');
  page.body = `<p>占術の計算方法、結果の読み方、注意点をテーマ別にまとめています。診断結果を決めつけに使わず、自分の経験と照らし合わせるための参考資料としてご利用ください。</p><ul class="guide-list">${cards}</ul><style>.guide-list{list-style:none;padding:0;display:grid;gap:14px}.guide-list a{display:block;padding:18px;background:#fffdf8;border:1px solid #d4c5a0;border-radius:8px;text-decoration:none}.guide-list strong,.guide-list span{display:block}.guide-list span{font-size:14px;color:#5f564c;margin-top:6px}</style>`;
  return staticHtml(page, 'CollectionPage');
}

if (!fs.existsSync(lpPath) || !fs.existsSync(indexPath)) {
  console.error('Build output is missing index.html or lp.html');
  process.exit(1);
}

const appTemplate = fs.readFileSync(indexPath, 'utf-8');
for (const route of appRoutes) writePage(route.path, appPageHtml(appTemplate, route));
for (const guide of guides) writePage(guide.path, staticHtml(guide));
for (const page of infoPages) writePage(page.path, staticHtml(page, 'WebPage'));
writePage('guides', guideIndexHtml());
fs.copyFileSync(lpPath, indexPath);
console.log(`Generated SEO HTML for /, ${appRoutes.length} app routes, ${guides.length} guides, and ${infoPages.length} information pages`);
