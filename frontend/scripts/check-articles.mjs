// 生成した解説記事に、テンプレート由来の不自然な文が残っていないかを確かめる。
// `npm run build` の最後に実行し、問題があれば記事と理由を出力して終了コード1で止める。
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'dist', 'guides');
const bannedWords = ['解釈マスタ', '計算マスタ', '鑑定エンジン', 'エンジンに定義'];

const decode = text => text
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const plain = html => decode(html.replace(/<[^>]+>/g, '')).trim();

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name === 'index.html' ? [full] : [];
  });
}

const problems = [];
for (const file of htmlFiles(root)) {
  const html = fs.readFileSync(file, 'utf8');
  const article = html.match(/<article>([\s\S]*?)<\/article>/)?.[1];
  if (!article) continue;
  const name = path.relative(root, path.dirname(file)) || '(index)';
  const title = plain(article.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? '');
  const body = article
    .replace(/<h1>[\s\S]*?<\/h1>/, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '');
  const text = plain(body.replace(/<\/(p|li|td|th|h2|h3|div|section)>/g, '\n'));

  if (title && text.includes(title)) problems.push([name, '記事タイトルが本文の文中に入っている']);

  const headings = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(match => plain(match[1]));
  for (const heading of new Set(headings)) {
    if (headings.filter(item => item === heading).length > 1) problems.push([name, `同じ見出しが2回以上ある：${heading}`]);
  }

  const promptCount = (body.match(/<strong>あなたの場合は？<\/strong>/g) ?? []).length;
  if (promptCount > 1) problems.push([name, `「あなたの場合は？」の案内が${promptCount}つある`]);

  for (const word of bannedWords) {
    if (text.includes(word)) problems.push([name, `社内向けの言葉が残っている：${word}`]);
  }

  const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(match => plain(match[1])).filter(item => item.length >= 40);
  for (const paragraph of new Set(paragraphs)) {
    if (paragraphs.filter(item => item === paragraph).length > 1) problems.push([name, `同じ段落が2回以上ある：${paragraph.slice(0, 30)}…`]);
  }
}

if (problems.length) {
  for (const [name, reason] of problems) console.error(`✖ ${name}: ${reason}`);
  console.error(`記事チェック：${problems.length}件の問題があります。`);
  process.exit(1);
}
console.log('記事チェック：問題はありません。');
