const el=id=>document.getElementById(id);
const storeKey='fatelab-couple-all-years-preview-v1';
const samples={
 'sample-1':{a:{birthDate:'1995-03-16',birthTime:'00:52'},b:{birthDate:'1992-07-20',birthTime:''},meetingYear:2006},
 'sample-2':{a:{birthDate:'1990-01-15',birthTime:''},b:{birthDate:'1993-10-08',birthTime:''},meetingYear:2023}
};
let saved={};try{saved=JSON.parse(localStorage.getItem(storeKey)||'{}')}catch{}
let model=null,requestNumber=0,lastButton=null,scrollY=0;
const fields=['date-a','time-a','date-b','time-b','meeting'];
function put(v){el('date-a').value=v.a.birthDate;el('time-a').value=v.a.birthTime||'';el('date-b').value=v.b.birthDate;el('time-b').value=v.b.birthTime||'';el('meeting').value=v.meetingYear??''}
function values(){const raw=el('meeting').value.trim();if(raw&&!/^\d{4}$/.test(raw))throw new Error('出会った年は西暦4桁で入力してください。');return {a:{birthDate:el('date-a').value,birthTime:el('time-a').value},b:{birthDate:el('date-b').value,birthTime:el('time-b').value},meetingYear:raw?Number(raw):null}}
function closeDetail(){el('detail').hidden=true;el('list').hidden=false}
function reset(){model=null;requestNumber++;closeDetail();el('years').replaceChildren();el('count').textContent='';el('controls').hidden=true;el('message').textContent='';el('generate').disabled=false}
function message(text){const p=document.createElement('p');p.className='status';p.textContent=text;el('years').append(p)}
function openYear(entry,button){lastButton=button;scrollY=window.scrollY;el('detail-year').textContent=entry.year+'年'+(entry.label?' · '+entry.label:'');el('detail-title').textContent=entry.reading.title;el('paragraphs').replaceChildren(...entry.reading.paragraphs.map(text=>{const p=document.createElement('p');p.textContent=text;return p}));el('list').hidden=true;el('detail').hidden=false;el('detail').focus();window.scrollTo({top:0})}
function card(entry){
 if(entry.contentStatus!=='ready'){const box=document.createElement('div');box.className='placeholder';box.textContent=entry.year+'年 — '+(entry.contentStatus==='unsupported_year'?'この年の鑑定は準備中です。':'この年の鑑定を生成できませんでした。入力を確認して再度表示してください。');return box}
 const b=document.createElement('button');b.type='button';b.className='year-card';b.dataset.year=entry.year;
 const text=document.createElement('span'),label=document.createElement('small');label.textContent=entry.year+'年';
 if(entry.label){const badge=document.createElement('span');badge.className='badge';badge.textContent=entry.label;label.append(badge)}
 if(entry.year===model.referenceYear){const badge=document.createElement('span');badge.className='badge';badge.textContent='今年';label.append(badge)}
 const title=document.createElement('strong');title.textContent=entry.reading.title;text.append(label,title);
 const arrow=document.createElement('span');arrow.textContent='›';arrow.className='arrow';arrow.ariaHidden='true';b.append(text,arrow);b.onclick=()=>openYear(entry,b);return b;
}
function render(value){model=value;closeDetail();el('years').replaceChildren();el('controls').hidden=true;
 const errors={needs_meeting_year:'出会った年を入力すると、ふたりの時系列が表示されます。',invalid_meeting_year:'出会った年は、ふたりが生まれた年以降から今年までで入力してください。',invalid_context:'生年月日を確認してください。',invalid_end_year:'表示する最終年を確認してください。'};
 if(errors[value.status]){el('count').textContent='';message(errors[value.status]);return}
 el('count').textContent=`${value.meetingYear}〜${value.endYear}年 · 全${value.entries.length}年`;
 const hidden=new Set(value.collapsedYears),byYear=new Map(value.entries.map(e=>[e.year,e]));let parent=null;
 for(const entry of value.entries){
  if(hidden.has(entry.year)){
   if(!parent){parent=document.createElement('details');parent.className='past';const summary=document.createElement('summary');summary.textContent=`過去の鑑定を見る（${hidden.size}年分）`;parent.append(summary);
    for(const group of value.groups){const details=document.createElement('details');details.className='group';const head=document.createElement('summary');head.textContent=`${group.from}〜${group.to}年`;details.append(head,...group.years.map(y=>card(byYear.get(y))));parent.append(details)}el('years').append(parent)
   }
  }else el('years').append(card(entry));
 }
 el('controls').hidden=!parent;
}
async function generate(persist=false){const sequence=++requestNumber,relationship=el('relationship').value;el('message').textContent='';el('generate').disabled=true;closeDetail();el('years').replaceChildren();el('count').textContent='鑑定を組み立てています…';el('controls').hidden=true;
 try{const input=values();const response=await fetch('/api/timeline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();if(sequence!==requestNumber)return;if(!response.ok)throw new Error(result.error||'表示できませんでした。');render(result);
 if(persist&&['ready','partial','needs_meeting_year'].includes(result.status)){saved[relationship]=input;try{localStorage.setItem(storeKey,JSON.stringify(saved))}catch{el('message').textContent='表示しましたが、ブラウザーに保存できませんでした。'}}
 }catch(error){if(sequence===requestNumber){el('count').textContent='';el('message').textContent=error.message}}
 finally{if(sequence===requestNumber)el('generate').disabled=false}
}
el('inputs').onsubmit=event=>{event.preventDefault();generate(true)};
el('relationship').onchange=()=>{reset();put(saved[el('relationship').value]||samples[el('relationship').value]);generate()};
el('swap').onclick=()=>{try{const v=values();put({...v,a:v.b,b:v.a});reset();generate(true)}catch(error){el('message').textContent=error.message}};
el('clear').onclick=()=>{reset();delete saved[el('relationship').value];try{localStorage.setItem(storeKey,JSON.stringify(saved))}catch{};put({a:{birthDate:''},b:{birthDate:''},meetingYear:null});message('ふたりの生年月日と、出会った年を入力してください。')};
el('back').onclick=()=>{closeDetail();lastButton?.focus({preventScroll:true});window.scrollTo({top:scrollY})};
el('expand').onclick=()=>document.querySelectorAll('#years details').forEach(e=>e.open=true);
el('collapse').onclick=()=>document.querySelectorAll('#years details').forEach(e=>e.open=false);
fields.forEach(id=>el(id).addEventListener('input',()=>{reset();message('入力を変更しました。「保存して表示」で更新してください。')}));
put(saved[el('relationship').value]||samples[el('relationship').value]);generate();
