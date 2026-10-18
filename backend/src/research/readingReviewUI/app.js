'use strict';
const $=id=>document.getElementById(id), token=document.querySelector('meta[name="review-token"]').content;
const verdicts={unreviewed:'未評価',close:'合っている',partial:'一部合う',wrong:'違う',unknown:'判断できない'};
const issues={content:'内容が違う／合う',timing:'時期が違う',vague:'曖昧・誰にでも当てはまる',wording:'表現の好み'};
const observers={unknown:'情報源は未確認',self:'自分の体験',friend:'本人から聞いた'};
const certainty={unknown:'確かさは未確認',confirmed:'事実として確認済み',approximate:'だいたい・記憶が曖昧'};
const domains={love:'恋愛・結婚',work:'仕事',home:'暮らし・家族',study:'進路・勉強',other:'その他'};
let run=null, feedback=null, allRuns=[], dirty=false, conflict=false, saving=null, timer=null, edit=0, loadSequence=0;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const message=(text,error=false)=>{const el=run?$('status'):$('global-status');el.textContent=text;el.className=error?'error':''};
async function api(path,value){const response=await fetch(path,{method:value===undefined?'GET':'POST',headers:{'X-Review-Token':token,...(value===undefined?{}:{'Content-Type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})});const data=await response.json();if(!response.ok){const error=new Error(data.error||'処理を完了できませんでした');error.status=response.status;throw error}return data}
function draftKey(){return 'fatelab-review-draft:'+run.id}
function keepDraft(){try{localStorage.setItem(draftKey(),JSON.stringify({revision:run.revision,feedback}))}catch{message('下書きの保存容量が足りません。JSON書き出しも利用してください。',true)}}
function count(){if(!feedback)return;$('count').textContent=`評価済み ${feedback.items.filter(i=>i.verdict!=='unreviewed').length}件 ／ 出来事 ${feedback.events.filter(e=>e.actual.trim()).length}件。未評価・判断できないは「外れ」に数えません。`}
function changed(){dirty=true;edit++;keepDraft();count();message(conflict?'別画面との競合があります。JSONを書き出してからページを開き直してください。':'保存待ち…',conflict);clearTimeout(timer);if(!conflict)timer=setTimeout(()=>flush(),900)}
async function flush(){
 clearTimeout(timer);if(conflict)return false;if(saving)return saving;
 saving=(async()=>{while(dirty&&run){const id=run.id,version=edit,sent=structuredClone(feedback);try{
  message('保存中…');const saved=await api(`/api/runs/${id}/feedback`,{revision:run.revision,contentHash:run.contentHash,feedback:sent});
  run=saved;dirty=edit!==version;updateSavedList(saved);
  if(dirty)keepDraft();else {try{localStorage.removeItem(draftKey())}catch{}message('このMacに保存しました · '+new Date().toLocaleTimeString('ja-JP'))}
 }catch(error){conflict=error.status===409;message(error.message+' 入力は画面に残っています。',true);return false}}
 return true})().finally(()=>saving=null);return saving;
}
function select(values,value,onchange){const el=node('select');for(const [key,label]of Object.entries(values))el.add(new Option(label,key));el.value=value;el.addEventListener('change',()=>onchange(el.value));return el}
function label(text,control){const el=node('label',text);el.append(control);return el}
function input(value,oninput,placeholder=''){const el=node('input');el.value=value;el.placeholder=placeholder;el.addEventListener('input',()=>oninput(el.value));return el}
function textarea(value,oninput,placeholder=''){const el=node('textarea');el.value=value;el.placeholder=placeholder;el.addEventListener('input',()=>oninput(el.value));return el}
function itemFor(targetID){return feedback.items.find(i=>i.targetID===targetID)||{targetID,verdict:'unreviewed',issue:'content',actual:'',period:'',observer:'unknown',certainty:'unknown'}}
function targetView(t){
 const section=node('section',undefined,'target'),item=itemFor(t.id);section.append(node('h3',t.heading),node('p',t.body,'copy'));
 const evidence=node('details');evidence.append(node('summary','この文章の根拠'));if(t.claimID)evidence.append(node('p',t.claimID,'muted'));
 if(t.selectionTrace){const trace=t.selectionTrace;
  evidence.append(node('h4','この文章を採用した条件'),node('p',`${trace.claimID}：${trace.trigger.kind} → ${trace.findingKey}${trace.findingKey==='initiative'?'（実装上の「自分から動く」という分類）':''}`));
  evidence.append(node('p','以下は現行コードの採用理由です。星と性格・出来事との対応を統計的に実証した結果ではありません。文章は検証中の解釈です。','muted'));
  if(trace.findingKind==='consensus')evidence.append(node('p','同じ分類の根拠をまとめ、重複を整理した後の2系統以上で候補にする固定ルールです。列挙した星がすべて必須という条件ではありません。','muted'));
  for(const [title,facts]of [['採用条件の主な根拠',trace.primary],['同じ条件を補助する根拠',trace.supporting],['補助スコアだけに使った根拠（この文章の直接トリガーではありません）',trace.scoreOnly]]){
   evidence.append(node('h4',title));if(!facts.length)evidence.append(node('p','該当なし','muted'));
   for(const f of facts)evidence.append(node('p',`${f.system}：${f.label}`),node('p',`${f.factor} ／ 出典 ${f.canonicalSourceId} ／ Fact ${f.id}`,'muted'));
  }
  evidence.append(node('p','同じ柱や天体に由来する項目を、独立した事例の件数としては数えません。','muted'));
  const advanced=node('details');advanced.append(node('summary','採用順位の実行記録'),node('p',`補助スコア：${trace.scoreKey}。採用値 ${trace.selection.runtimeSalience} ／ 基準 ${trace.selection.floor}。これらは実装上の数値で、的中率ではありません。`),node('p',`候補内の表示順 ${trace.selection.rotationRank+1}。出生情報を使う固定の並べ替えも含みます。先頭の文章が統計的に最も強いという意味ではありません。`));evidence.append(advanced);
 }else if(t.components?.length){for(const c of t.components){evidence.append(node('h4',c.heading));if(c.claimId)evidence.append(node('p',c.claimId,'muted'));for(const e of c.evidence)evidence.append(node('p',`${e.system}：${e.detail}`,'muted'))}}
 else {if(!t.cardID.startsWith('turning-year-'))evidence.append(node('p','この旧版には、採用条件の詳しい実行記録がありません。以下は当時保存した出典で、直接トリガーと章全体の出典が混在する場合があります。','muted'));for(const e of t.evidence)evidence.append(node('p',`${e.system}：${e.detail}`,'muted'))}section.append(evidence);
 const save=()=>{if(!feedback.items.includes(item))feedback.items.push(item);changed()};
 const box=node('div',undefined,'fb'),buttons=node('div',undefined,'feedback-options');
 for(const [key,title]of Object.entries(verdicts)){const b=node('button',title);b.type='button';b.setAttribute('aria-pressed',String(item.verdict===key));b.addEventListener('click',()=>{item.verdict=key;for(const button of buttons.children)button.setAttribute('aria-pressed',String(button===b));save()});buttons.append(b)}
 box.append(node('label','実際と比べると？'),buttons);
 const detail=node('details');detail.open=!!item.actual||!!item.period||item.issue!=='content';detail.append(node('summary','どこが違う？ 実際の出来事・時期を記入'));
 const grid=node('div',undefined,'grid');grid.append(label('FBの種類',select(issues,item.issue,v=>{item.issue=v;save()})),label('実際の時期（不明は空欄）',input(item.period,v=>{item.period=v;save()},'2014 / 2014-04 / 2014-04-01')),label('情報源',select(observers,item.observer,v=>{item.observer=v;save()})),label('確かさ',select(certainty,item.certainty,v=>{item.certainty=v;save()})));
 detail.append(grid,label('実際はどうだった？',textarea(item.actual,v=>{item.actual=v;save()},'例：交際が始まったのは2014年4月。2016年11月は別れ話、2018年3月に本格的な失恋。')));box.append(detail);section.append(box);return section;
}
function renderCards(){
 const timing=$('category').value==='timing';$('year-label').hidden=!timing;$('chapter-label').hidden=timing;$('cards').replaceChildren();
 const cards=run.cards.filter(c=>timing?c.kind==='timing'&&c.id.endsWith($('year').value):c.kind==='essence'&&c.id===$('chapter').value);
 for(const c of cards){const article=node('article');article.append(node('p',timing?`${c.id.slice(-4)}年 · ${c.period?.label||''}`:c.tags.join('・'),'badge'));for(const t of run.targets.filter(t=>t.cardID===c.id))article.append(targetView(t));$('cards').append(article)}
 if(!cards.length)$('cards').append(node('p','この範囲で生成された鑑定はありません。年別の表示範囲は現在のエンジンと同じ18〜60歳・現在年までです。','empty'));
}
function renderEvents(){
 $('events').replaceChildren();for(const e of feedback.events){const box=node('div',undefined,'target'),grid=node('div',undefined,'grid');
 grid.append(label('実際の時期',input(e.period,v=>{e.period=v;changed()},'2014-04')),label('分野',select(domains,e.domain,v=>{e.domain=v;changed()})),label('情報源',select(observers,e.observer,v=>{e.observer=v;changed()})),label('確かさ',select(certainty,e.certainty,v=>{e.certainty=v;changed()})));
 const remove=node('button','この出来事を取り消す');remove.addEventListener('click',()=>{feedback.events=feedback.events.filter(x=>x.id!==e.id);changed();renderEvents()});
 box.append(grid,label('実際にあったこと',textarea(e.actual,v=>{e.actual=v;changed()},'鑑定に出ていない出来事を記入')),remove);$('events').append(box)}
}
function fillBirth(b){for(const key of ['nickname','birthDate','birthTime','birthplace','gender'])$(key).value=b[key]??''}
const lastSavedAt=r=>r.lastSavedAt??r.history?.at(-1)?.savedAt??r.createdAt;
const savedLabel=r=>`最終保存 ${new Date(lastSavedAt(r)).toLocaleString('ja-JP')} · 評価済みFB ${r.reviewed}件`;
function compareOptions(){const selected=$('compare-run').value,choices=allRuns.filter(r=>r.caseID===run.caseID&&r.id!==run.id);$('compare-run').replaceChildren();for(const r of choices)$('compare-run').add(new Option(`${r.birth.nickname} · ${savedLabel(r)}`,r.id));if(choices.some(r=>r.id===selected))$('compare-run').value=selected;$('compare').disabled=!choices.length}
function renderList(){allRuns.sort((a,b)=>lastSavedAt(b).localeCompare(lastSavedAt(a))||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));$('runs').replaceChildren(new Option('新しい人を入力',''));for(const r of allRuns)$('runs').add(new Option(`${r.birth.nickname} · ${r.birth.birthDate} · ${savedLabel(r)}`,r.id));if(run){$('runs').value=run.id;compareOptions()}}
function renderMeta(){$('meta').textContent=`${run.birth.nickname} · 鑑定作成 ${new Date(run.createdAt).toLocaleString('ja-JP')} · 最終保存 ${new Date(lastSavedAt(run)).toLocaleString('ja-JP')} · コード版 ${run.sourceHash.slice(0,10)} · 保存revision ${run.revision}`}
function updateSavedList(saved){const entry=allRuns.find(r=>r.id===saved.id);if(entry){entry.lastSavedAt=lastSavedAt(saved);entry.revision=saved.revision;entry.reviewed=saved.feedback.items.filter(i=>i.verdict!=='unreviewed').length;entry.events=saved.feedback.events.filter(e=>e.actual.trim()).length}renderList();renderMeta()}
async function refreshList(){
 const listed=await api('/api/runs');
 // Already-open local servers may still return the older list schema. Read the
 // saved history without restarting the server or invalidating active FB tabs.
 allRuns=await Promise.all(listed.map(async r=>r.lastSavedAt?r:{...r,lastSavedAt:lastSavedAt(await api('/api/runs/'+r.id))}));
 renderList();
}
async function load(id){const sequence=++loadSequence;$('review').inert=true;try{if(!await flush()){if(sequence===loadSequence)$('runs').value=run?.id??'';return}const loaded=await api('/api/runs/'+id);if(sequence!==loadSequence)return;run=loaded;feedback=structuredClone(run.feedback);dirty=false;conflict=false;
 try{const draft=JSON.parse(localStorage.getItem(draftKey())||'null');if(draft){feedback=draft.feedback;dirty=true;edit++;conflict=draft.revision!==run.revision}}catch{message('下書きを復元できませんでした。保存済みのFBを表示します。',true)}
 fillBirth(run.birth);$('review').hidden=false;$('welcome').hidden=true;$('birth-panel').open=false;$('runs').value=run.id;
 $('chapter').replaceChildren();for(const c of run.cards.filter(c=>c.kind==='essence'))$('chapter').add(new Option(c.tags[0]||c.title,c.id));
 $('year').replaceChildren();for(const c of run.cards.filter(c=>c.kind==='timing'))$('year').add(new Option(c.id.slice(-4)+'年',c.id.slice(-4)));
 $('overall').value=feedback.overall;renderMeta();
 $('comparison').replaceChildren();renderCards();renderEvents();compareOptions();count();
 message(conflict?'別画面の更新と下書きが競合しています。入力を書き出してから、再読み込みしてください。':dirty?'未保存の下書きを復元しました。':'保存済みの鑑定を表示しています。',conflict);
 if(dirty&&!conflict)await flush();
 }finally{if(sequence===loadSequence)$('review').inert=false}
}
async function newPerson(){const sequence=++loadSequence;if(!await flush()||sequence!==loadSequence)return;$('review').inert=false;run=null;feedback=null;dirty=false;conflict=false;fillBirth({gender:'female'});$('runs').value='';$('review').hidden=true;$('welcome').hidden=false;$('birth-panel').open=true;$('global-status').textContent='';$('nickname').focus()}
$('birth-form').addEventListener('submit',async event=>{event.preventDefault();if(!await flush())return;const b=Object.fromEntries(['nickname','birthDate','birthTime','birthplace','gender'].map(k=>[k,$(k).value]));for(const id of ['generate','new-person','runs','reload'])$(id).disabled=true;$('global-status').textContent='鑑定を生成しています。数秒〜数十秒かかります。';try{const result=await api('/api/generate',{birth:b,previousRunID:run?.id});await refreshList();await load(result.id);$('global-status').textContent='新しい鑑定を保存しました。以前の鑑定・FBも残っています。'}catch(error){$('global-status').textContent=error.message}finally{for(const id of ['generate','new-person','runs','reload'])$(id).disabled=false}});
$('runs').addEventListener('change',()=>($('runs').value?load($('runs').value):newPerson()).catch(e=>message(e.message,true)));
$('new-person').addEventListener('click',()=>newPerson());$('reload').addEventListener('click',()=>refreshList().catch(e=>message(e.message,true)));
$('category').addEventListener('change',renderCards);$('year').addEventListener('change',renderCards);$('chapter').addEventListener('change',renderCards);$('save').addEventListener('click',()=>flush());
$('overall').addEventListener('input',()=>{feedback.overall=$('overall').value;changed()});
$('add-event').addEventListener('click',()=>{feedback.events.push({id:crypto.randomUUID(),period:'',domain:'love',actual:'',observer:'unknown',certainty:'unknown'});changed();renderEvents()});
$('export').addEventListener('click',async()=>{await flush();const bundle={purpose:'developer-reading-review',productionApproval:false,trainingEligible:false,exportedAt:new Date().toISOString(),run,unsavedDraft:dirty?feedback:null};const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download=`FATELAB_FB_${run.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('compare').addEventListener('click',async()=>{try{const old=await api('/api/runs/'+$('compare-run').value);const ids=[...new Set([...old.cards,...run.cards].map(c=>c.id))];$('comparison').replaceChildren();let changes=0;
 for(const id of ids){const before=old.cards.find(c=>c.id===id),after=run.cards.find(c=>c.id===id),body=c=>c?[c.title,c.summary,...(c.sections??[]).flatMap(s=>[s.heading,s.body])].join('\n\n'):'この版にはありません';if(body(before)===body(after))continue;changes++;
 const box=node('details');box.append(node('summary',(after??before).title));const grid=node('div',undefined,'comparison');for(const [title,c]of [['以前',before],['今回',after]]){const column=node('div');column.append(node('h3',title),node('pre',body(c)));grid.append(column)}box.append(grid);const oldFB=old.feedback.items.filter(i=>old.targets.some(t=>t.id===i.targetID&&t.cardID===id));for(const fb of oldFB)box.append(node('p',`以前のFB：${verdicts[fb.verdict]} ${fb.actual}`,'muted'));$('comparison').append(box)}
 $('comparison').prepend(node('p',changes?`${changes}枚の本文が変わっています。以前の評価は新しい本文に引き継いでいません。`:'本文に差分はありません。生成日や出生情報を変更しても、本文が同じ場合があります。'));}catch(error){message(error.message,true)}});
window.addEventListener('beforeunload',event=>{if(dirty){keepDraft();event.preventDefault();event.returnValue=''}});
for(const place of ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'])$('places').append(new Option(place,place));
refreshList().then(()=>{if(allRuns.length)return load(allRuns[0].id)}).catch(error=>message(error.message,true));
