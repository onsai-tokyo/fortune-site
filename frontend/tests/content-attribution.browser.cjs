/* Uses the built app and real Supabase SDK against in-memory Auth/GA fixtures.
 * Every browser request is intercepted: no production account or Google event. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.FATELAB_PLAYWRIGHT_MODULE || '@playwright/test')
const root = path.resolve(__dirname, '..')
const origin = 'https://fate-lab.com'
const tags = '?utm_source=threads&utm_medium=social&utm_campaign=c20261125&utm_content=p20261125_01&email=private-canary%40example.test#private-hash-canary'
const key = 'fatelab:content-attribution:v1'
const userId = '00000000-0000-4000-8000-000000000025'
const token = () => ['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})).toString('base64url'),'signature'].join('.')

async function fixture({existing=false,slowTag=false}={}) {
  const signup = (await import('../api/analytics-signup.js')).default
  const collect = (await import('../api/threads-event.js')).default
  const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}: {})})
  const context = await browser.newContext({serviceWorkers:'block'})
  context.setDefaultTimeout(8000)
  let confirmed=false,claimed=existing,claims=0
  const ga=[],clientHits=[],signupBodies=[],external=[]
  const user=()=>({id:userId,aud:'authenticated',role:'authenticated',is_anonymous:false,email:'private-canary@example.test',
    email_confirmed_at:confirmed?'2026-11-25T00:00:00Z':null,app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'private-name-canary'}})
  const realFetch=globalThis.fetch
  globalThis.fetch=async(url,init)=>{
    const u=String(url)
    if(u==='https://auth.fatelab.test/auth/v1/user')return {status:200,ok:true,json:async()=>user()}
    if(u==='https://auth.fatelab.test/rest/v1/rpc/claim_signup_analytics'){claims++;const won=!claimed;claimed=true;return {ok:true,json:async()=>won}}
    if(u.startsWith('https://www.google-analytics.com/mp/collect')){ga.push(JSON.parse(init.body));return {ok:true}}
    throw Error('Unexpected server network: '+u)
  }
  process.env.VITE_SUPABASE_URL='https://auth.fatelab.test';process.env.VITE_SUPABASE_ANON_KEY='test-anon';process.env.GA4_API_SECRET='fixture-secret'
  const json=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)})
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url())
    if(url.origin==='https://auth.fatelab.test') {
      if(req.method()==='OPTIONS')return json(route,{})
      if(url.pathname.endsWith('/user'))return json(route,user())
      if(url.pathname.endsWith('/otp'))return json(route,{})
      if(url.pathname.endsWith('/verify')) {confirmed=true;return json(route,{access_token:token(),refresh_token:'private-refresh-canary',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:user()})}
      return json(route,{})
    }
    if(url.origin!==origin){
      external.push(url.origin+url.pathname)
      if(url.hostname==='www.googletagmanager.com') {if(slowTag)await new Promise(r=>setTimeout(r,150));return route.fulfill({contentType:'application/javascript',body:'/* fixture: intentionally no Google transport */'})}
      return route.abort()
    }
    if(url.pathname==='/api/analytics-signup'||url.pathname==='/api/threads-event'){
      const body=req.postDataJSON();if(url.pathname.endsWith('analytics-signup'))signupBodies.push(body);else clientHits.push(body)
      let status=200;const headers={}
      const res={setHeader(k,v){headers[k]=v},status(n){status=n;return this},end(){}}
      await (url.pathname.endsWith('analytics-signup')?signup:collect)({method:req.method(),headers:{...req.headers(),host:'fate-lab.com'},body},res)
      return route.fulfill({status,headers,body:''})
    }
    if(url.pathname==='/api/calc/shichu')return json(route,{shichuDay:'甲子-private-result-canary'})
    if(url.pathname.startsWith('/api/'))return json(route,{conversations:[],partners:[],books:[],saves:[],snapshots:[],remaining:0})
    let file=path.join(root,'dist',url.pathname)
    if(!file.startsWith(path.join(root,'dist')+path.sep))file=path.join(root,'dist/index.html')
    try {const stat=await fs.stat(file);if(stat.isDirectory())file=path.join(file,'index.html');await fs.access(file)}catch{file=path.join(root,'dist/index.html')}
    const ext=path.extname(file),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'}
    return route.fulfill({contentType:types[ext]||'application/octet-stream',body:await fs.readFile(file)})
  })
  return {browser,context,ga,clientHits,signupBodies,external,confirm(){confirmed=true},claims:()=>claims,
    async close(){await context.close();await browser.close();globalThis.fetch=realFetch}}
}
async function until(predicate){for(let i=0;i<100;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,40))}throw Error('Timed out waiting for fixture assertion')}
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)
async function nativeTag(page){
  let commands=[]
  await until(async()=>{commands=await page.evaluate(()=>[...document.querySelectorAll('iframe')].flatMap(frame=>Array.from(frame.contentWindow?.dataLayer??[],item=>Array.from(item))));return commands.some(c=>c[0]==='event'&&c[1]==='page_view')})
  assert.doesNotMatch(JSON.stringify(commands),/private-|1995-02-20|utm_|access_token|refresh_token/)
  return commands
}

for(const slowTag of [false,true])test('article → email verification in another tab → exactly one safe sign_up; slowTag='+slowTag,async()=>{
  const f=await fixture({slowTag})
  try{
    const page=await f.context.newPage()
    await page.goto(origin+'/guides/sanmeigaku-stars'+tags)
    await page.getByRole('heading',{level:1}).waitFor()
    await until(async()=>(await read(page))?.last_content_id==='/guides/sanmeigaku-stars')
    const native=await nativeTag(page)
    const config=native.find(c=>c[0]==='config')[2]
    assert.equal(config.acq_content,'p20261125_01');assert.equal(config.campaign_content,'p20261125_01')
    await page.goto(origin+'/tools/day-master')
    await until(async()=>(await read(page))?.last_content_id==='/tools/day-master')
    await nativeTag(page)
    await page.getByLabel('生まれた年',{exact:true}).selectOption('1995')
    await page.getByLabel('生まれた月',{exact:true}).selectOption('02')
    await page.getByLabel('生まれた日',{exact:true}).selectOption('20')
    await page.getByRole('button',{name:'日干・日柱を計算する',exact:true}).click()
    await page.getByText(/甲子-private-result-canary/).waitFor()
    await until(()=>f.ga.some(x=>x.events.some(e=>e.name==='seo_tool_complete')))
    const before=await read(page)
    await page.goto(origin+'/restore')
    await page.locator('#restore-email').fill('private-canary@example.test')
    await page.getByRole('button',{name:'コードを送る',exact:true}).click()
    await page.getByLabel(/確認コード/).waitFor()
    assert.equal(f.ga.filter(x=>x.events[0].name==='sign_up').length,0)
    f.confirm()
    const second=await f.context.newPage()
    await second.goto(origin+'/restore#access_token='+token()+'&refresh_token=private-refresh-canary&expires_in=3600&token_type=bearer&type=signup')
    await until(()=>f.ga.filter(x=>x.events[0].name==='sign_up').length===1)
    await Promise.all([second.reload(),page.reload()])
    const third=await f.context.newPage();await third.goto(origin+'/restore')
    await until(()=>f.claims()>=2)
    assert.equal(f.ga.filter(x=>x.events[0].name==='sign_up').length,1)
    const hit=f.ga.find(x=>x.events[0].name==='sign_up').events[0]
    assert.equal(hit.params.acq_source,'threads');assert.equal(hit.params.acq_content,'p20261125_01')
    assert.equal(hit.params.acq_entry_page,'/guides/sanmeigaku-stars');assert.equal(hit.params.last_content_id,'/tools/day-master')
    assert.equal((await read(second)).at,before.at)
    assert.doesNotMatch(JSON.stringify(f.ga),/private-canary|private-hash|private-refresh|private-name|private-result|1995-02-20|signature|access_token|refresh_token|utm_|user_id|email/)
    assert.doesNotMatch(JSON.stringify(f.signupBodies),/private-canary|private-refresh|private-name|signature|access_token|refresh_token|email/)
    assert.ok(f.ga.every(x=>x.events.every(e=>Object.keys(e.params).length<=25)))
    assert.ok(!f.external.some(x=>/google-analytics\.com/.test(x)))
  }finally{await f.close()}
})
test('existing confirmed account login is not a registration',async()=>{
  const f=await fixture({existing:true});try{
    const page=await f.context.newPage();await page.goto(origin+tags)
    await page.goto(origin+'/restore');await page.locator('#restore-email').fill('private-canary@example.test')
    await page.getByRole('button',{name:'コードを送る',exact:true}).click();await page.getByLabel(/確認コード/).fill('12345678')
    await page.getByRole('button',{name:'ログイン',exact:true}).click();await until(()=>f.claims()>0)
    assert.equal(f.ga.filter(x=>x.events[0].name==='sign_up').length,0)
  }finally{await f.close()}
})
test('new tagged arrival resets content, direct/reload preserve it; private routes never become identifiers',async()=>{
  const f=await fixture();try{
    const page=await f.context.newPage();await page.goto(origin+'/guides/day-master'+tags)
    await until(async()=>(await read(page))?.last_content_id==='/guides/day-master')
    const original=await read(page);await page.reload();assert.equal((await read(page)).at,original.at)
    await page.goto(origin+'/');assert.equal((await read(page)).acq_source,'threads')
    await page.goto(origin+'/?utm_source=instagram&utm_medium=paid_social&utm_campaign=c20261125_02&utm_content=p20261125_02')
    await until(async()=>(await read(page))?.acq_source==='instagram')
    const fresh=await read(page);assert.equal(fresh.acq_entry_page,'/');assert.equal(fresh.last_content_id,undefined)
    await page.goto(origin+'/restore?code=private-code-canary&utm_source=x#private-token-canary')
    assert.equal((await read(page)).acq_source,'instagram')
    assert.doesNotMatch(JSON.stringify(f.ga),/private-|utm_|access_token|refresh_token/)
  }finally{await f.close()}
})
