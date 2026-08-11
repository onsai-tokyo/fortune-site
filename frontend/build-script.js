import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://fate-lab.com';
const SITE_NAME = 'Fate Lab';
const UPDATED = '2026-08-11';
const distDir = path.join(process.cwd(), 'dist');
const lpPath = path.join(distDir, 'lp.html');
const indexPath = path.join(distDir, 'index.html');
const topPagePath = path.join(process.cwd(), 'public', 'index.html');

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
  {
    path: 'guides/ziwei-doushu', title: '紫微斗数とは？十二宮と主星から命盤を読む基本',
    description: '紫微斗数の命宮・官禄宮・夫妻宮など十二宮、主星、出生時間が重要になる理由を解説します。',
    body: `<p>紫微斗数は、生年月日と出生時刻から十二の宮を配置し、紫微星をはじめとする星の組み合わせで人生の領域ごとの傾向を整理する東洋占術です。</p><h2>十二宮が表す領域</h2><p>本人の性質を見る命宮、仕事を見る官禄宮、対人関係を見る交友宮、パートナーシップを見る夫妻宮など、宮ごとに観察するテーマが異なります。ひとつの星だけで結論を出さず、宮・主星・補助星の組み合わせを確認します。</p><h2>出生時刻が必要な理由</h2><p>出生時刻によって命宮などの配置が変わるため、時刻が不明な場合に確定命盤を表示することはできません。Fate Labでは推測時刻による命盤を確定結果として扱いません。</p><h2>統合鑑定での役割</h2><p>十二宮から得た領域別の傾向を、四柱推命や西洋占星術など独立した計算結果と照合し、共通点がある場合に鑑定文へ反映します。</p>`
  },
  {
    path: 'guides/vedic-astrology', title: 'インド占星術とは？西洋占星術との違いと出生図の見方',
    description: 'インド占星術の恒星黄道、ラグナ、ナクシャトラと、西洋占星術との計算上の違いを解説します。',
    body: `<p>インド占星術（ジョーティッシュ）は、惑星と星座の位置から性質や時期を読む体系です。一般に恒星黄道を採用するため、回帰黄道を使う西洋占星術とは同じ出生条件でも星座位置が異なることがあります。</p><h2>ラグナと月の役割</h2><p>出生時刻と場所から算出するラグナは、本人の表れ方や人生全体を見る基準です。月の位置やナクシャトラも心理傾向や時期判断の重要な手がかりになります。</p><h2>結果が違って見える理由</h2><p>黄道の基準、ハウスやアスペクトの扱い、重視する天体が異なるため、西洋占星術と結果を単純に一致させることはできません。Fate Labでは両方を独立計算します。</p><h2>使う際の注意</h2><p>流派によってアヤナーンシャなどの設定が異なります。計算条件を明示し、異なる方式の結果を混同しないことが重要です。</p>`
  },
  {
    path: 'guides/kyusei-kigaku', title: '九星気学とは？本命星・月命星と節入りの基本',
    description: '九星気学の本命星と月命星、立春で年が切り替わる考え方、吉方位を見る際の注意点を解説します。',
    body: `<p>九星気学は、生年月日を一白水星から九紫火星までの九星へ対応させ、性質や方位、時間の巡りを考える体系です。</p><h2>1月1日では切り替わらない</h2><p>本命星の年は一般に立春を境に切り替えます。そのため1月から立春前に生まれた人は、暦年だけで計算すると異なる星になる場合があります。月命星も節入りを基準にします。</p><h2>本命星と月命星</h2><p>本命星は大きな性質、月命星は内面や若年期の傾向を見る手がかりとされます。実際の判断では盤の巡りや他の条件も合わせます。</p><h2>方位結果の注意点</h2><p>引越しや旅行は距離・期間・出発日などでも条件が変わります。安全、費用、生活条件を優先し、方位だけで重要な移動を決めないでください。</p>`
  },
  {
    path: 'guides/numerology', title: '数秘術とは？ライフパスナンバーの計算と読み方',
    description: '生年月日からライフパスナンバーを計算する方法と、11・22・33のマスターナンバーの扱いを解説します。',
    body: `<p>数秘術は、生年月日や名前を数へ置き換えて性質やテーマを整理する方法です。Fate Labでは生年月日の数字を合計するライフパスを主要指標のひとつとして扱います。</p><h2>計算例</h2><p>1995年2月20日なら、1＋9＋9＋5＋2＋2＋0＝28、2＋8＝10、1＋0＝1となります。方式によって途中のまとめ方が異なるため、比較するときは計算規則を揃える必要があります。</p><h2>マスターナンバー</h2><p>11・22・33を一桁へ縮約せず残す方式があります。Fate Labもこの規則を採用しますが、通常数より優れているという意味ではありません。</p><h2>単独で断定しない</h2><p>同じ数字でも環境や経験で表れ方は変わります。他の占術との共通点を確認し、自己理解の仮説として利用してください。</p>`
  },
  {
    path: 'guides/sukuyo', title: '宿曜占星術とは？二十七宿と相性の基本',
    description: '月の位置を基にした二十七宿、命宿、相性関係の基本と、暦による違いを解説します。',
    body: `<p>宿曜占星術は、月の運行と二十七宿を基に性質や人間関係を整理する占術です。生まれた日の宿である命宿を入口にします。</p><h2>二十七宿と暦</h2><p>宿の算出は旧暦との対応を含み、採用する暦や方式によって境界日の結果が異なる場合があります。サイト間で結果を比較するときは計算基準を確認してください。</p><h2>相性は関係の型を見る</h2><p>栄親・友衰・安壊などの関係は、二人の関係に出やすい動きを表す分類です。良い・悪いの一語で人間関係を決めるものではありません。</p><h2>Fate Labでの扱い</h2><p>宿曜単独の評価は行わず、四柱推命や数秘術などから得た対人傾向と照合して、共通する特徴をまとめます。</p>`
  },
  {
    path: 'guides/sanmeigaku', title: '算命学とは？陰陽五行と天中殺の読み方',
    description: '算命学で使われる陰陽五行、十大主星、十二大従星、天中殺を読む際の基本姿勢を解説します。',
    body: `<p>算命学は、生年月日を干支へ置き換え、陰陽五行の関係から性質や環境との関わりを考える体系です。四柱推命と共通する素材を使いますが、解釈体系は同一ではありません。</p><h2>星は役割を整理する記号</h2><p>十大主星は行動や才能の方向、十二大従星はエネルギーの質を表す手がかりとされます。星名の印象だけで吉凶を決めず、配置と全体の関係を見ます。</p><h2>天中殺を怖がらない</h2><p>天中殺は一定の周期を示す概念であり、必ず不幸が起きる期間ではありません。大きな決断では現実の条件と専門家の助言を優先してください。</p><h2>四柱推命との統合</h2><p>同じ干支を使う結果を重複票として数えすぎないよう、Fate Labでは近い体系同士の関連性を考慮して文章化します。</p>`
  },
  {
    path: 'guides/nayin', title: '納音とは？六十干支を30種類に分類する見方',
    description: '納音が六十干支を海中金・炉中火など30種類の象意へ分類する仕組みと活用上の注意を解説します。',
    body: `<p>納音は、六十干支を二つずつ組にして30種類の象意へ対応させる考え方です。海中金、炉中火、大林木など、自然物にたとえた名称が使われます。</p><h2>日干や五行とは別の分類</h2><p>納音の名称に含まれる木・火・土・金・水は、命式全体の五行バランスをそのまま示すものではありません。異なる分類を混同しないことが大切です。</p><h2>象意の使い方</h2><p>自然物のイメージを、性質を考える補助線として使います。一つの納音だけで職業、結婚、健康などを断定することはできません。</p><h2>統合時の位置づけ</h2><p>Fate Labでは納音を補助的な情報として扱い、独立性の高い複数占術で同様の傾向が確認できた場合に説明へ加えます。</p>`
  },
  {
    path: 'guides/setsuiri-boundary', title: '立春前後で四柱推命の結果が変わる理由｜節入りの検証',
    description: '1月・2月生まれの年柱や月柱がサイトによって違う原因と、Fate Labが立春直前・直後をテストする方法を解説します。',
    body: `<p>四柱推命の年柱と月柱は、一般的なカレンダーの1月1日や毎月1日には切り替わりません。二十四節気の節入りを境にするため、とくに立春付近の出生条件では計算方式の違いが表面化します。</p><h2>立春前は前年として扱う</h2><p>たとえば暦の上では2月でも、立春より前なら四柱推命上の年は前年側です。月柱も同様に節入りで切り替わります。単純に西暦と月番号だけから干支を求める実装では、1月・2月や節入り当日にずれが生じます。</p><h2>Fate Labの境界テスト</h2><p>Fate Labでは、立春の直前では前年・前月の干支を返し、立春を過ぎた直後に年柱と月柱が同時に切り替わることを自動テストしています。代表日だけでなく、境界の両側を固定条件として残すことで、計算処理を変更した際の後戻りを検出します。</p><h2>同じ誕生日なのに結果が違うとき</h2><p>まず出生年、出生地、出生時刻、タイムゾーン、節入りの採用方式を確認してください。とくに境界当日は時刻がないと確定できないことがあります。結果だけを比較せず、各サービスが計算条件を公開しているかを確認することが重要です。</p><h2>元日と立春を混同しない</h2><p>九星気学でも年の切り替えに立春を用いる方式がありますが、四柱推命と九星気学は別の体系です。共通の境界を使う項目があっても、解釈やその他の計算規則まで同一とは限りません。</p>`
  },
  {
    path: 'guides/same-birthdate', title: '同じ生年月日なら同じ運命？占い結果と人生が違う理由',
    description: '同じ誕生日でも出生時刻・場所・経験によって結果や人生が異なる理由と、再現性のある占いの正しい使い方を説明します。',
    body: `<p>同じ生年月日を入力すれば、固定された計算規則から得られる命式や数字は同じになります。しかし、同じ人生になるわけではありません。計算結果の再現性と、人間の未来を決定することは別の話です。</p><h2>出生時刻と場所で変わる項目</h2><p>四柱推命の時柱、紫微斗数の命宮、西洋・インド占星術の上昇点やハウスは出生時刻と場所の影響を受けます。同じ日でも入力条件が違えば、一部の計算結果は変わります。</p><h2>同じ命式でも経験は異なる</h2><p>家庭環境、教育、文化、健康、仕事、本人の選択は生年月日だけから決まりません。同じ傾向があっても、支援的な環境では強みとして、合わない環境では負担として現れることがあります。</p><h2>再現性が意味するもの</h2><p>Fate Labが重視する再現性は「同じ入力と同じ計算バージョンなら同じ結果を返す」という意味です。当日の気分やランダム処理で鑑定の土台が変わらないため、利用者が結果を比較・検証できます。</p><h2>結果を仮説として使う</h2><p>当てはまる記述は具体的な経験と照合し、当てはまらないものは無理に受け入れないでください。占いは人生の答えではなく、自分や相手への問いを作る参考資料として使うのが適切です。</p>`
  },
];

const infoPages = [
  { path: 'about', title: 'Fate Labについて', description: 'Fate Labの目的、提供する無料統合占い、運営会社と運営方針についてご案内します。', body: `<p>Fate Lab（フェイトラボ）は、生年月日・出生時刻・出生地から複数の占術を計算し、自己理解の材料を提供するオンラインサービスです。</p><h2>提供するもの</h2><p>東洋・西洋・インドの9つの占術を独立して計算し、複数の体系で共通して現れた本質・仕事・恋愛などの傾向を統合鑑定書として表示します。</p><h2>大切にしていること</h2><p>同じ入力条件には同じ結果を返すこと、計算できない項目を推測で埋めないこと、結果を人生の断定ではなく対話の出発点として提示することを大切にしています。</p><h2>運営会社</h2><p>Fate Labは温齋株式会社が企画・開発・運営し、Fate Lab編集部が解説コンテンツの制作と計算仕様の確認を行っています。運営情報は<a href="/tokushohou">特定商取引法に基づく表記</a>、ご連絡は<a href="/contact">お問い合わせページ</a>をご覧ください。</p>` },
  { path: 'methodology', title: '鑑定ロジックと計算方針', description: 'Fate Labが9つの占術を計算・統合する方法、境界日の検証、再現性、出生時間が不明な場合の扱いを説明します。', body: `<p>Fate Labは、入力された生年月日・出生時刻・出生地・性別から各占術を個別に計算し、定めた解釈ルールで結果を統合します。</p><h2>独立計算</h2><p>四柱推命、算命学、納音、宿曜、九星気学、数秘術、紫微斗数、西洋占星術、インド占星術を、それぞれの前提に沿って計算します。異なる体系の記号を無理に同一視しません。</p><h2>境界条件と再現テスト</h2><p>立春の直前と直後における年柱・月柱の切り替え、出生時刻がある場合だけ返す時柱、11・22・33を保持する数秘術、代表日の宿曜・納音・九星を固定テストで検証します。1995年2月20日5時40分など基準となる出生条件では、詳細命式、西洋・インド占星術の天体位置、紫微斗数十二宮まで同じ結果を再現できることを確認しています。</p><h2>一致する傾向を優先</h2><p>3種類以上の占術で共通して現れる行動傾向を中心に鑑定書へ反映します。ただし四柱推命と算命学のように素材を共有する体系は、完全に独立した証拠として過大評価しません。単独の結果は補足として扱い、強い断定を避けます。</p><h2>不明情報の扱い</h2><p>出生時間が不明な場合、時柱、ハウス、紫微斗数命盤など時刻に依存する項目を省略します。推測した時刻を確定情報として使用しません。</p><h2>限界</h2><p>占術は科学的な性格検査や医療診断ではありません。結果はエンターテインメントおよび自己理解を目的とし、重要な意思決定の唯一の根拠にはできません。</p>` },
  { path: 'editorial-policy', title: 'コンテンツ制作方針', description: 'Fate Labの占い解説記事、計算根拠、更新、表現、免責に関する制作方針です。', body: `<p>Fate Labは、読者が占術の前提と限界を理解し、結果を安全に活用できるコンテンツを目指します。</p><h2>制作原則</h2><p>計算方法と解釈を区別し、複数の流派がある事項は一つを絶対視しません。恐怖をあおる表現、健康・投資・法律上の結果を保証する表現を使用しません。</p><h2>更新と訂正</h2><p>計算仕様や解説を変更した場合は内容を見直し、記事の更新日を表示します。誤りのご連絡は<a href="/contact">お問い合わせページ</a>から受け付けます。</p><h2>AIの扱い</h2><p>初回の統合鑑定書は各占術の計算結果と固定ルールから生成します。記事や結果は、最終的に利用者自身が経験や客観情報と照合できる表現にします。</p>` },
  { path: 'contact', title: 'お問い合わせ', description: 'Fate Labへのお問い合わせ、内容の訂正依頼、個人情報に関する窓口をご案内します。', body: `<p>サービスに関するご質問、表示内容の訂正、個人情報に関するご相談は、下記窓口へご連絡ください。</p><h2>メール窓口</h2><p><a href="mailto:support@fate-lab.com">support@fate-lab.com</a></p><p>お問い合わせの際は、対象ページのURLと状況をお書きください。パスワード、クレジットカード番号などの機密情報は送信しないでください。</p><h2>返信について</h2><p>内容を確認のうえ順次返信します。営業・勧誘、鑑定結果の個別解釈、緊急性の高い医療・法律相談には対応できません。</p>` },
  { path: 'press', title: 'Fate Labプレスキット', description: 'Fate Labのサービス概要、運営会社、正式表記、対応占術、ロゴ利用、お問い合わせ先をメディア向けにまとめています。', body: `<p>Fate Lab（フェイトラボ）をご紹介いただく際に利用できる公式情報です。事実確認や取材のご相談は<a href="mailto:support@fate-lab.com">support@fate-lab.com</a>へご連絡ください。</p><h2>正式名称と概要</h2><p><strong>サービス名：</strong>Fate Lab（フェイトラボ）<br><strong>URL：</strong><a href="https://fate-lab.com/">https://fate-lab.com/</a><br><strong>運営：</strong>温齋株式会社</p><p>Fate Labは、東洋・西洋・インドの9つの占術を同じ出生条件から個別に計算し、複数体系で一致した傾向をまとめる無料オンライン占いです。</p><h2>対応する9占術</h2><p>四柱推命、算命学、納音、宿曜、九星気学、数秘術、紫微斗数、西洋占星術、インド占星術に対応しています。</p><h2>サービスの特徴</h2><ul><li>同じ入力条件と同じ計算バージョンなら同じ結果を返す</li><li>出生時刻が不明な場合、時刻依存項目を推測で確定しない</li><li>複数占術で共通する傾向を優先し、単独結果による断定を避ける</li><li>境界日や代表出生条件を自動テストで検証する</li></ul><h2>ロゴ・画像</h2><p>サービス紹介には<a href="/og-fate-lab.png">公式OG画像（1200×630 PNG）</a>をご利用いただけます。画像の縦横比、色、文字を変更せず、Fate Labの紹介目的に限ってお使いください。</p><h2>紹介文</h2><p>「Fate Lab（フェイトラボ）は、四柱推命や紫微斗数、西洋占星術、インド占星術など9つの占術を固定ルールで統合する、生年月日の無料オンライン占いです。」</p><h2>注意事項</h2><p>本サービスは医療、法律、金融、採用などの専門的判断を代替しません。「科学的に未来を予測する」「必ず当たる」など、提供内容と異なる表現は使用しないでください。</p>` },
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

const sharedStyle = `body{margin:0;background:#faf7ef;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;line-height:1.9}header,main,footer{max-width:820px;margin:auto;padding:20px 24px}header{border-bottom:1px solid #d4c5a0}a{color:#72500f;text-underline-offset:3px}h1{font-size:clamp(28px,6vw,42px);line-height:1.4;margin:44px 0 20px}h2{font-size:24px;margin-top:44px;border-left:4px solid #c9a961;padding-left:14px}p{margin:18px 0}nav{display:flex;gap:18px;flex-wrap:wrap;font-size:14px}.breadcrumb{font-size:13px;color:#685f55;margin-top:24px}.meta{font-size:13px;color:#685f55;border-block:1px solid #e2d8c4;padding:12px 0}.cta{display:block;margin:48px 0 24px;padding:18px;text-align:center;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px}.author,.sources,.related{margin-top:34px;padding:20px;background:#fffdf8;border:1px solid #d4c5a0;border-radius:8px}.author p,.sources p{margin:8px 0}.sources ul{margin:8px 0;padding-left:22px}.related a{display:block;margin:8px 0}footer{margin-top:48px;border-top:1px solid #d4c5a0;font-size:13px;color:#5f564c}@media(max-width:560px){header,main,footer{padding-inline:18px}h2{font-size:21px}}`;
const nav = `<nav><a href="/">Fate Lab</a><a href="/guides/">占い解説</a><a href="/methodology">鑑定ロジック</a><a href="/about">運営情報</a></nav>`;
const footer = `<footer><nav><a href="/about">Fate Labについて</a><a href="/editorial-policy">制作方針</a><a href="/press">プレスキット</a><a href="/contact">お問い合わせ</a><a href="/privacy">プライバシー</a><a href="/terms">利用規約</a></nav><p>© Fate Lab</p></footer>`;
const analytics = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-FPZ7QKTXLJ"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-FPZ7QKTXLJ');document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;if(a.matches('.cta'))gtag('event','guide_to_fortune',{page_path:location.pathname,link_url:a.href});else if(a.closest('.related'))gtag('event','related_guide_click',{page_path:location.pathname,link_url:a.href})})</script>`;

function staticHtml(page, type = 'Article') {
  const canonical = `${SITE_URL}/${page.path}`;
  const title = `${page.title}｜${SITE_NAME}`;
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': type, headline: page.title, name: page.title, description: page.description, inLanguage: 'ja', mainEntityOfPage: canonical, datePublished: '2026-08-10', dateModified: UPDATED, author: { '@type': 'Organization', '@id': `${SITE_URL}/#editorial`, name: 'Fate Lab編集部', url: `${SITE_URL}/editorial-policy` }, reviewedBy: { '@type': 'Organization', name: '温齋株式会社', url: `${SITE_URL}/about` }, publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, url: `${SITE_URL}/`, logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-fate-lab.png`, width: 1200, height: 630 } }, image: { '@type': 'ImageObject', url: `${SITE_URL}/og-fate-lab.png`, width: 1200, height: 630 } },
      { '@type': 'BreadcrumbList', itemListElement: type === 'Article' ? [{ '@type': 'ListItem', position: 1, name: 'Fate Lab', item: `${SITE_URL}/` }, { '@type': 'ListItem', position: 2, name: '占い解説', item: `${SITE_URL}/guides/` }, { '@type': 'ListItem', position: 3, name: page.title, item: canonical }] : [{ '@type': 'ListItem', position: 1, name: 'Fate Lab', item: `${SITE_URL}/` }, { '@type': 'ListItem', position: 2, name: page.title, item: canonical }] }
    ]
  };
  const currentIndex = guides.findIndex(g => g.path === page.path);
  const relatedGuides = currentIndex < 0 ? guides.slice(0, 4) : Array.from({ length: Math.min(4, guides.length - 1) }, (_, offset) => guides[(currentIndex + offset + 1) % guides.length]);
  const related = relatedGuides.map(g => `<a href="/${g.path}">${escapeHtml(g.title)}</a>`).join('');
  const editorial = type === 'Article' ? `<div class="meta">公開日：2026-08-10　更新日：${UPDATED}</div><aside class="author"><strong>執筆・検証：Fate Lab編集部</strong><p>温齋株式会社が運営するFate Labの計算仕様と検証用固定データを基に制作しています。複数流派がある事項は断定を避け、計算方法と解釈を区別します。</p><a href="/editorial-policy">コンテンツ制作・検証方針</a>　<a href="/methodology">鑑定ロジック</a></aside><aside class="sources"><strong>参考情報と検証方針</strong><ul><li>各占術の暦・天体・干支計算は、公開された暦法と実装ライブラリの固定テストで検証</li><li>境界日や出生時間の有無で結果が変わる条件を明示</li><li>占術は科学的診断ではなく、自己理解の参考情報として提供</li></ul></aside>` : '';
  return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#faf7ef"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(page.description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="${canonical}"><meta property="og:type" content="${type === 'Article' ? 'article' : 'website'}"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="Fate Lab"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(page.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-fate-lab.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${SITE_URL}/og-fate-lab.png">${analytics}<style>${sharedStyle}</style><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head><body><header>${nav}</header><main><div class="breadcrumb"><a href="/">Fate Lab</a> › ${type === 'Article' ? '<a href="/guides/">占い解説</a> › ' : ''}${escapeHtml(page.title)}</div><article><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p>${editorial}${page.body}</article>${type === 'Article' ? `<aside class="related"><strong>関連する占い解説</strong>${related}</aside>` : ''}<a class="cta" href="/#form">生年月日を入力して無料で鑑定する</a><p>最終更新日：${UPDATED}</p></main>${footer}</body></html>`;
}

function guideIndexHtml() {
  const page = { path: 'guides/', title: '生年月日占い・四柱推命の基礎知識', description: '四柱推命、命式、日干、五行、性格、適職、相性など、生年月日占いの基礎をFate Labが解説します。' };
  const cards = guides.map(g => `<li><a href="/${g.path}"><strong>${escapeHtml(g.title)}</strong><span>${escapeHtml(g.description)}</span></a></li>`).join('');
  page.body = `<p>占術の計算方法、結果の読み方、注意点をテーマ別にまとめています。診断結果を決めつけに使わず、自分の経験と照らし合わせるための参考資料としてご利用ください。</p><ul class="guide-list">${cards}</ul><style>.guide-list{list-style:none;padding:0;display:grid;gap:14px}.guide-list a{display:block;padding:18px;background:#fffdf8;border:1px solid #d4c5a0;border-radius:8px;text-decoration:none}.guide-list strong,.guide-list span{display:block}.guide-list span{font-size:14px;color:#5f564c;margin-top:6px}</style>`;
  return staticHtml(page, 'CollectionPage');
}

if (!fs.existsSync(lpPath) || !fs.existsSync(indexPath) || !fs.existsSync(topPagePath)) {
  console.error('Build output or top page source is missing');
  process.exit(1);
}

const appTemplate = fs.readFileSync(indexPath, 'utf-8');
fs.writeFileSync(path.join(distDir, 'app.html'), appTemplate);
for (const route of appRoutes) writePage(route.path, appPageHtml(appTemplate, route));
for (const guide of guides) writePage(guide.path, staticHtml(guide));
for (const page of infoPages) writePage(page.path, staticHtml(page, 'WebPage'));
writePage('guides', guideIndexHtml());
fs.copyFileSync(topPagePath, indexPath);
console.log(`Generated SEO HTML for /, ${appRoutes.length} app routes, ${guides.length} guides, and ${infoPages.length} information pages`);
