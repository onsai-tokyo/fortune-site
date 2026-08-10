import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
const lpPath = path.join(distDir, 'lp.html');
const indexPath = path.join(distDir, 'index.html');

const routes = [
  { path: 'feature/self', title: '無料の自己分析｜強み・適職・人生の転換期を命式で診断', description: '生年月日から四柱推命・算命学など6つの占術を統合し、性格の本質、強み・弱み、適職、人生の転換期を診断します。' },
  { path: 'feature/compat', title: '無料の相性診断｜生年月日で恋愛・仕事の相性を鑑定', description: '2人の生年月日から、恋愛や仕事の相性、価値観、関係を良くするヒントを複数の占術で読み解きます。' },
  { path: 'feature/marriage', title: '結婚相性占い｜生年月日で夫婦関係・結婚生活を診断', description: '2人の生年月日から結婚相性、夫婦の力関係、結婚生活を円満にするヒントを統計学鑑定で読み解きます。' },
  { path: 'feature/org', title: '組織診断｜チームの人間関係と相性を命式で分析', description: 'メンバーの生年月日から、チームのキーパーソン、役割、人間関係、組織の戦い方を分析します。' },
  { path: 'feature/recruit', title: '採用・他己分析｜候補者の強みと適性を命式で診断', description: '候補者の生年月日から強み、仕事の適性、面接官との相性を複数の占術で分析します。' },
  { path: 'feature/boss', title: '上司との相性占い｜接し方とコミュニケーションを診断', description: '上司とあなたの生年月日から、相性、喜ばれる言葉、避けたい言葉、関係を良くするヒントを診断します。' },
  { path: 'feature/subordinate', title: '部下との相性占い｜育成・マネジメントのコツを診断', description: '部下とあなたの生年月日から、モチベーション、成長ポイント、効果的な接し方を診断します。' },
  { path: 'feature/client', title: '取引先との相性占い｜信頼構築と商談の進め方を診断', description: '取引先担当者とあなたの生年月日から、意思決定の傾向、相性、信頼構築のポイントを診断します。' },
  { path: 'feature/direction', title: '吉方位診断｜九星気学と四柱推命で方位を鑑定', description: '生年月日から九星気学と四柱推命を統合し、引越し、出張、旅行、デスク配置の方位を診断します。' },
  { path: 'privacy', title: 'プライバシーポリシー', description: 'Fate Lab 統計学鑑定における個人情報の取り扱いについて説明します。' },
  { path: 'terms', title: '利用規約', description: 'Fate Lab 統計学鑑定のサービス利用条件について説明します。' },
  { path: 'tokushohou', title: '特定商取引法に基づく表記', description: 'Fate Lab 統計学鑑定の特定商取引法に基づく表記です。' },
];

const guides = [
  {
    path: 'guides/shichu-suimei',
    title: '四柱推命とは？命式の見方と生年月日でわかること',
    description: '四柱推命の年柱・月柱・日柱・時柱、十干十二支、出生時間が不明な場合の考え方を初心者向けに解説します。',
    body: `
      <p>四柱推命は、生まれた年・月・日・時刻を「年柱・月柱・日柱・時柱」という4つの柱に置き換え、十干と十二支の組み合わせから傾向を読み解く占術です。4つの柱を合わせた表は「命式」と呼ばれます。</p>
      <h2>四柱は何を表すのか</h2>
      <p><strong>年柱</strong>は家系や幼少期、社会から見える背景、<strong>月柱</strong>は仕事や社会性、青年期、<strong>日柱</strong>は本人の本質や配偶者との関係、<strong>時柱</strong>は晩年や内面、子どもとの関係を見る際の手がかりとされます。ただし、ひとつの柱だけで性格や未来を断定するものではありません。命式全体のバランスを合わせて解釈します。</p>
      <h2>出生時間が不明でも鑑定できる？</h2>
      <p>出生時間がわからない場合は時柱を除く3つの柱で大枠を読み解けます。性格の本質や社会的な傾向を知る目的なら参考になりますが、出生時間を使う分析より情報量は少なくなります。母子手帳や出生記録が確認できる場合は、時刻まで入力すると分析範囲が広がります。</p>
      <h2>Fate Labの統計学鑑定</h2>
      <p>Fate Labでは四柱推命だけで結論を出さず、算命学・納音・宿曜・九星気学・数秘術も組み合わせます。異なる見方で繰り返し現れる特徴を整理し、自己理解の材料として提示します。鑑定は将来を保証するものではなく、選択肢を考えるための参考情報としてご利用ください。</p>`
  },
  {
    path: 'guides/birthdate-fortune',
    title: '生年月日占いでわかること｜6つの占術の違いを解説',
    description: '生年月日占いでわかる性格・適職・恋愛傾向と、四柱推命、算命学、納音、宿曜、九星気学、数秘術の違いを解説します。',
    body: `
      <p>生年月日占いは、生まれた日を暦や数の体系に当てはめ、性格や行動の傾向を整理する方法です。よく検索される「性格」「適職」「恋愛傾向」「相性」「人生の転換期」は、占術ごとに異なる角度から読み解かれます。</p>
      <h2>6つの占術は何が違う？</h2>
      <p><strong>四柱推命</strong>は十干十二支と命式のバランス、<strong>算命学</strong>は生まれ持った性質と環境との関係、<strong>納音</strong>は干支の組み合わせによる象徴、<strong>宿曜</strong>は月の運行をもとにした宿、<strong>九星気学</strong>は九星と方位、<strong>数秘術</strong>は生年月日の数字を使って特徴を見ます。</p>
      <h2>複数の占術を組み合わせる理由</h2>
      <p>ひとつの占術だけでは、特定の象徴が強く見える場合があります。複数の体系を照らし合わせることで、共通して現れる特徴と、ひとつの占術だけに現れる特徴を分けやすくなります。Fate Labは6つの結果を統合し、重なる傾向を中心に鑑定書を構成します。</p>
      <h2>結果をどう活用するか</h2>
      <p>鑑定結果は「当たる・外れる」だけでなく、自分の経験と照らし合わせて使うことが大切です。強みは再現できる行動として、弱みは環境や習慣で補える課題として捉えてください。医療・法律・金融・採用など重要な判断は、資格を持つ専門家や客観的な情報と合わせて決めましょう。</p>`
  },
  {
    path: 'guides/compatibility',
    title: '生年月日による相性占い｜恋愛・結婚・仕事で見るポイント',
    description: '生年月日から恋愛、結婚、仕事の相性を見るときのポイントと、相性診断の結果を関係改善に活かす方法を解説します。',
    body: `
      <p>相性占いは、2人の生年月日から性格や行動の傾向を比較し、関係の中で噛み合いやすい点と違いが出やすい点を整理するものです。相性の良し悪しを一つの点数で断定するより、関係を築くための具体的なヒントとして使うのが適しています。</p>
      <h2>恋愛・結婚・仕事では見る観点が違う</h2>
      <p><strong>恋愛</strong>では感情表現や距離感、安心を感じる条件、<strong>結婚</strong>では生活リズムや役割分担、長期的な価値観、<strong>仕事</strong>では意思決定、報告の仕方、得意な役割を重視します。同じ2人でも、目的によって相性の現れ方は変わります。</p>
      <h2>相性が違うことは悪いことではない</h2>
      <p>似ている2人は意思疎通が早い一方、同じ弱点を抱えることがあります。異なる2人は誤解が生じやすい反面、役割を補い合える場合があります。大切なのは「合わない」という結論ではなく、違いがどの場面に現れ、どう伝えれば理解しやすいかを知ることです。</p>
      <h2>診断結果の使い方</h2>
      <p>気になる表現があれば、相手を決めつける材料にせず、実際の会話で確認してください。相性診断は関係を保証したり、別れや結婚を指示したりするものではありません。2人の経験、希望、話し合いを中心に置き、関係改善の問いを見つける補助として活用しましょう。</p>`
  }
];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function pageHtml(template, route) {
  const canonical = `https://fate-lab.com/${route.path}`;
  const title = route.path.startsWith('feature/') ? route.title : `${route.title}｜Fate Lab 統計学鑑定`;
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(route.description);
  const robots = route.path.startsWith('feature/') ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  return template
    .replace(/<title>.*?<\/title>/, `<title>${escapedTitle}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapedDescription}" />`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${robots}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapedTitle}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapedDescription}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`);
}

function guideHtml(guide) {
  const canonical = `https://fate-lab.com/${guide.path}`;
  const title = `${guide.title}｜Fate Lab`;
  return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(guide.description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="Fate Lab 統計学鑑定"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(guide.description)}"><meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary"><script async src="https://www.googletagmanager.com/gtag/js?id=G-FPZ7QKTXLJ"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-FPZ7QKTXLJ');</script><style>body{margin:0;background:#faf7ef;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;line-height:1.9}header,main,footer{max-width:760px;margin:auto;padding:20px 24px}header{border-bottom:1px solid #d4c5a0}a{color:#72500f}h1{font-size:clamp(28px,6vw,42px);line-height:1.4;margin:44px 0 20px}h2{font-size:24px;margin-top:44px;border-left:4px solid #c9a961;padding-left:14px}p{margin:18px 0}nav{display:flex;gap:18px;flex-wrap:wrap;font-size:14px}.cta{display:block;margin:48px 0 24px;padding:18px;text-align:center;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px}footer{margin-top:48px;border-top:1px solid #d4c5a0;font-size:13px;color:#5f564c}</style><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: guide.title, description: guide.description, inLanguage: 'ja', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: 'Fate Lab 統計学鑑定', url: 'https://fate-lab.com/' } }).replace(/</g, '\\u003c')}</script></head><body><header><nav><a href="/">Fate Lab 統計学鑑定</a><a href="/guides/shichu-suimei">四柱推命</a><a href="/guides/birthdate-fortune">生年月日占い</a><a href="/guides/compatibility">相性占い</a></nav></header><main><article><h1>${escapeHtml(guide.title)}</h1><p>${escapeHtml(guide.description)}</p>${guide.body}</article><a class="cta" href="/#form">生年月日を入力して無料で鑑定する</a><p>最終更新日：2026年8月10日</p></main><footer><a href="/privacy">プライバシーポリシー</a> ・ <a href="/terms">利用規約</a><p>© Fate Lab 統計学鑑定</p></footer></body></html>`;
}

if (!fs.existsSync(lpPath) || !fs.existsSync(indexPath)) {
  console.error('Build output is missing index.html or lp.html');
  process.exit(1);
}

const appTemplate = fs.readFileSync(indexPath, 'utf-8');
for (const route of routes) {
  const routeDir = path.join(distDir, ...route.path.split('/'));
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), pageHtml(appTemplate, route));
}

for (const guide of guides) {
  const guideDir = path.join(distDir, ...guide.path.split('/'));
  fs.mkdirSync(guideDir, { recursive: true });
  fs.writeFileSync(path.join(guideDir, 'index.html'), guideHtml(guide));
}

fs.copyFileSync(lpPath, indexPath);
console.log(`Generated SEO HTML for /, ${routes.length} app routes, and ${guides.length} guides`);
