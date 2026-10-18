export type Signal = {actor:'A'|'B';source:'bazi_effect'|'bazi_main'|'bazi_secondary'|'sukuyo_role';value:string;paragraph_index:number;evidence_text:string;reference:string;age_band:string;title_fragment:Phrase}
type Phrase = {link:string;end:string}
export type TitleRules = Record<Signal['source'],Record<string,Phrase>> & {version:string;effect_priority:Record<string,number>;shared_overrides:Record<string,string>;max_characters:number}
type SortKey = string|number|SortKey[]
// Python tuple ordering, not locale-sensitive collation: titles must be identical across hosts.
function compare(a:SortKey,b:SortKey):number {
  if(Array.isArray(a)&&Array.isArray(b)){for(let i=0;i<Math.min(a.length,b.length);i++){const c=compare(a[i],b[i]);if(c)return c}return a.length-b.length}
  return a===b?0:a<b?-1:1
}
export function makeTitle(signals:Signal[],identities:Record<'A'|'B',string[]>,t:TitleRules) {
  const rank=(s:Signal):SortKey=>s.source==='bazi_effect'?[0,t.effect_priority[s.value]]:[s.source==='bazi_main'?1:2,0]
  const semantic=(s:Signal)=>[s.source,s.value]
  const actors=['A','B'] as const
  const bz={A:signals.filter(s=>s.actor==='A'&&s.source.startsWith('bazi_')),B:signals.filter(s=>s.actor==='B'&&s.source.startsWith('bazi_'))}
  const roles={A:signals.filter(s=>s.actor==='A'&&s.source==='sukuyo_role'),B:signals.filter(s=>s.actor==='B'&&s.source==='sukuyo_role')}
  if(actors.some(a=>roles[a].length!==1||!bz[a].length))throw new Error('TITLE_MATERIAL_MISSING')
  const sy={A:roles.A[0],B:roles.B[0]}
  const signature=(ss:Signal[])=>JSON.stringify([...new Set(ss.map(s=>JSON.stringify(semantic(s))))].sort())
  const shared=signature(bz.A)===signature(bz.B)&&sy.A.value===sy.B.value&&sy.A.age_band===sy.B.age_band
  let text:string,selected:Signal[],mode:string
  if(shared){
    const x=[...bz.A].sort((a,b)=>compare([rank(a),semantic(a)],[rank(b),semantic(b)]))[0]
    const counterpart=bz.B.find(s=>s.source===x.source&&s.value===x.value)!
    text='二人とも'+x.title_fragment.link+'、'+sy.A.title_fragment.end+'年'
    if(x.age_band==='adult') text=t.shared_overrides[[x.source,x.value,sy.A.value].join('|')]??text
    selected=[x,counterpart,sy.A,sy.B];mode='shared'
  }else{
    const options=actors.flatMap(actor=>{const other=actor==='A'?'B':'A';return bz[actor].map(x=>({key:[rank(x),semantic(x),sy[other].value,identities[actor],identities[other]] as SortKey,x,y:sy[other]}))})
    const {x,y}=options.sort((a,b)=>compare(a.key,b.key))[0]
    const a=x.actor==='A'?x:y,b=x.actor==='B'?x:y
    text='あなたは'+a.title_fragment.link+'、相手は'+b.title_fragment.end+'年'
    selected=[a,b];mode='actor_contrast'
  }
  if([...text].length>t.max_characters)throw new Error('TITLE_TOO_LONG')
  return {text,version:'grounded-title-age-1.0',mode,character_count:[...text].length,selected,considered:signals,selection_note:'本文に採用された年作用、主要テーマ、補足テーマの順で選び、別の人物の宿曜年役割と組み合わせる。吉凶や確率の順位ではない。'}
}
