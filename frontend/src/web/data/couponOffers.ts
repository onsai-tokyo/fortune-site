export type CouponOffer = {
  id: string
  name: string
  channel: 'phone' | 'chat'
  no: string
  prefix?: string
  facts: { target: string; terms: string; validity: string }
  redemption: string
  amount: string
  unit: string
  example?: string
  officialDetailsUrl: string
  compactTerms?: string
  adHtml?: string
}

// Keep A8.net’s complete 「通常広告用」 HTML, including its impression image.
export const couponOffers: readonly CouponOffer[] = [
  {
    id: 'coconala-phone',
    name: 'ココナラ電話占い',
    channel: 'phone',
    no: '01',
    facts: { target: 'はじめて会員登録する方', terms: '電話占いページの専用バナーから新規登録', validity: '利用期限・適用条件は公式案内へ' },
    redemption: '下のボタンから公式案内を開き、ココナラ電話占いの専用バナーから新規登録してください。',
    amount: '3,000',
    unit: '円分無料',
    example: 'アプリ通話で1分300円なら、鑑定料10分分が無料',
    officialDetailsUrl: 'https://coconala.com/magazine/32107',
    compactTerms: '初めての会員登録で、電話占いページの専用バナーからの登録が対象。',
    adHtml: `<a href="https://px.a8.net/svt/ejp?a8mat=4BAE5C+IGJMA+2PEO+C3BAQ" rel="nofollow">電話占い【ココナラ】新規会員登録で3,000円無料クーポンプレゼント中</a>

<img border="0" width="1" height="1" src="https://www17.a8.net/0.gif?a8mat=4BAE5C+IGJMA+2PEO+C3BAQ" alt="">`,
  },
  {
    id: 'spacia-phone',
    name: '電話占い 恋愛応援スペーシア',
    channel: 'phone',
    no: '02',
    facts: { target: 'スペーシアを初めて利用する方', terms: '会員登録不要。鑑定師のプロフィールで無料鑑定を選び、電話番号を入力', validity: '公式サイトでご確認ください' },
    redemption: '下のボタンから公式ガイドを開き、鑑定師のプロフィールで「10分間の無料電話占い」を選んでください。',
    amount: '10',
    unit: '分の鑑定が無料',
    example: '1人3回まで。無料鑑定は10分で自動終了します。',
    officialDetailsUrl: 'https://spacia-koiuranai.com/gopage.php?page=beginner',
    compactTerms: '会員登録不要。占い師のプロフィールから無料鑑定を選び、電話番号を入力。',
    adHtml: `<a href="https://px.a8.net/svt/ejp?a8mat=4BGK7S+C37Z2Q+3SKE+60H7M" rel="nofollow">当たる占い！3回まで無料【霊感霊視の電話占いスペーシア】</a>

<img border="0" width="1" height="1" src="https://www13.a8.net/0.gif?a8mat=4BGK7S+C37Z2Q+3SKE+60H7M" alt="">`,
  },
  {
    id: 'miror-phone',
    name: 'MIROR（ミラー）電話占い',
    channel: 'phone',
    no: '03',
    prefix: '最大',
    facts: { target: '電話鑑定が初めてで、対象クーポンをお持ちの方', terms: '対象の占い師に限り1人1回。別途通話料1分30円', validity: 'クーポンの有無・割引額・期限はログイン後に確認' },
    redemption: '下のボタンからログインして対象クーポンを確認し、申込みの決済画面で「クーポンを使用する」を選んでください。',
    amount: '2,000',
    unit: '円分の割引',
    example: '対象の占い師に限り1人1回。通話料は別途1分30円。',
    officialDetailsUrl: 'https://miror.jp/campaigns/tel_fortune/1',
    compactTerms: '初回電話鑑定で対象クーポンをお持ちの方が対象。',
    adHtml: `<a href="https://px.a8.net/svt/ejp?a8mat=4BGK7S+CNGPN6+4PWE+62ENM" rel="nofollow">ミラー</a>

<img border="0" width="1" height="1" src="https://www12.a8.net/0.gif?a8mat=4BGK7S+CNGPN6+4PWE+62ENM" alt="">`,
  },
  {
    id: 'miror-chat',
    name: 'MIROR（ミラー）チャット占い',
    channel: 'chat',
    no: '04',
    facts: { target: 'MIRORを初めて利用する方', terms: '公式キャンペーン掲載の鑑定メニューのみ', validity: '期間限定。実施状況と適用条件は申込み前に確認' },
    redemption: '下のボタンからキャンペーンを開き、対象の無料鑑定メニューを選んで申し込んでください。',
    amount: '初回無料',
    unit: '',
    example: '公式キャンペーンに掲載されている鑑定メニューが対象。',
    officialDetailsUrl: 'https://miror.jp/lp/1',
    compactTerms: '初めて利用する方で、公式キャンペーン対象メニューに限ります。',
    adHtml: `<a href="https://px.a8.net/svt/ejp?a8mat=4BGK7S+B89FMA+4PWE+C1DUQ" rel="nofollow">ミラーチャット占い</a>

<img border="0" width="1" height="1" src="https://www11.a8.net/0.gif?a8mat=4BGK7S+B89FMA+4PWE+C1DUQ" alt="">`,
  },
  {
    id: 'brillante-chat',
    name: 'チャット占い ブリランテ',
    channel: 'chat',
    no: '05',
    facts: { target: '新規のお客様限定', terms: 'メッセージの送受信などにポイントを使用。必要ポイントは鑑定師ごとに異なります', validity: '公式サイトで利用条件をご確認ください' },
    redemption: '下のボタンから公式案内を開き、新規登録後に付与されたポイントを確認してからご利用ください。',
    amount: '500',
    unit: '円分のポイント',
    example: '新規登録でもらえるポイント。メッセージの送受信などに使えます。',
    officialDetailsUrl: 'https://www.lp.brillante-uranai.com/',
    compactTerms: '新規登録限定。必要ポイントは鑑定師によって異なります。',
    adHtml: `<a href="https://px.a8.net/svt/ejp?a8mat=4BGK7S+BXV2MQ+5SGG+5YJRM" rel="nofollow">チャット占い【ブリランテ】</a>

<img border="0" width="1" height="1" src="https://www16.a8.net/0.gif?a8mat=4BGK7S+BXV2MQ+5SGG+5YJRM" alt="">`,
  },
  {
    id: 'destiny-phone',
    name: '電話占いデスティニー',
    channel: 'phone',
    no: '06',
    prefix: '初回',
    amount: '10',
    unit: '分の鑑定が無料',
    example: '最大2,450円分。初回は20分以上の利用条件なし。',
    facts: {
      target: '無料会員登録後、初めて電話鑑定を利用する方',
      terms: '占い師1人まで。後払いでは10分または2,450円を超えると鑑定料が発生します。',
      validity: '最新の適用条件は公式案内でご確認ください',
    },
    redemption: '下のボタンから公式案内を開き、無料会員登録後に占い師を選んで電話鑑定をご利用ください。',
    officialDetailsUrl: 'https://d-ny.jp/ssl/Visitor.php',
    compactTerms: '新規登録後の初回電話鑑定で占い師1人まで。後払いは10分または2,450円を超えると鑑定料が発生します。',
    adHtml: `<a href="https://px.a8.net/svt/ejp?a8mat=4BGK7S+C213V6+1SZG+TS3OI" rel="nofollow">電話占いデスティニー</a>

<img border="0" width="1" height="1" src="https://www12.a8.net/0.gif?a8mat=4BGK7S+C213V6+1SZG+TS3OI" alt="">`,
  },
]
