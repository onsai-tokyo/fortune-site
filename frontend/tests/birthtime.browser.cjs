const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
// Run against Vite in demo mode; install Playwright separately or set PLAYWRIGHT_MODULE.
const origin = process.env.BIRTHTIME_TEST_ORIGIN || 'https://127.0.0.1:4198'
const fixture = `<!doctype html><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
const {createRoot}=ReactDOM;
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const {BirthTimeFields}=await import('/src/web/components/BirthTimeFields.tsx');
function App(){const [value,setValue]=React.useState('');return React.createElement('form',{onSubmit:e=>{e.preventDefault();document.querySelector('#saved').textContent=value||'null'}},React.createElement(BirthTimeFields,{id:'test',value,onChange:setValue}),React.createElement('output',{id:'value'},value),React.createElement('button',{type:'button',onClick:()=>setValue('23:59')},'Load'),React.createElement('button',{type:'submit'},'Save'),React.createElement('output',{id:'saved'}))};
createRoot(document.getElementById('root')).render(React.createElement(App));</script>`
;(async()=>{
 for(const [name,engine,options] of [['chromium',chromium,{channel:'chrome'}],['webkit',webkit,{}]]){
 let browser
 try{browser=await engine.launch({headless:true,...options})}catch(e){if(name==='webkit'){console.log('WebKit unavailable:',e.message.split('\n')[0]);continue}throw e}
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}))
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>console.log('PAGE ERROR',e.message))
 await page.route('**/__birthtime-test',r=>r.fulfill({contentType:'text/html',body:fixture}))
 await page.goto(origin+'/__birthtime-test')
 const hour=page.getByLabel('生まれた時',{exact:true}),minute=page.getByLabel('生まれた分',{exact:true})
 await hour.waitFor();console.log(name+': fixture ready')
 async function valid(expected){assert.equal(await page.locator('form').evaluate(f=>f.checkValidity()),expected)}
 async function saved(expected){await page.getByText('Save',{exact:true}).click();assert.equal(await page.locator('#saved').textContent(),expected)}
 await valid(true);await saved('null')
 await hour.fill('9');await valid(false);await minute.fill('5');await valid(true);await saved('09:05')
 await hour.fill('0');await minute.fill('0');await saved('00:00')
 await hour.fill('24');await valid(false);assert.equal(await page.locator('#value').textContent(),'')
 await hour.fill('23');await minute.fill('60');await valid(false)
 await minute.fill('59');await saved('23:59')
 await hour.fill('１２');await minute.fill('３４');await saved('12:34')
 await minute.fill('');await valid(false)
 await page.getByRole('button',{name:'出生時刻（任意）をリセット'}).click();assert.equal(await hour.inputValue(),'');assert.equal(await minute.inputValue(),'');await valid(true);await saved('null')
 await page.getByText('Load',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#test-0').value==='23');assert.equal(await hour.inputValue(),'23');assert.equal(await minute.inputValue(),'59')
 console.log(name+': fixture passed');for(const route of ['/','/welcome','/couple','/couple/new']){
 console.log('Checking '+route);await page.goto(origin+route);await page.getByLabel('生まれた時',{exact:true}).first().waitFor()
 assert.equal(await page.locator('input[type=time]').count(),0)
 const h=page.getByLabel('生まれた時',{exact:true}),m=page.getByLabel('生まれた分',{exact:true})
 for(let i=0;i<await h.count();i++){await h.nth(i).fill(String(10+i));await m.nth(i).fill('30')}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)

 }
 await page.goto(origin+'/welcome');await page.getByLabel('生まれた時',{exact:true}).fill('0');await page.getByLabel('生まれた分',{exact:true}).fill('5');await page.getByRole('button',{name:'保存する',exact:true}).click();await page.waitForURL('**/settings');await page.locator('a[href*=welcome]').first().click();await page.getByLabel('生まれた時',{exact:true}).waitFor();assert.equal(await page.getByLabel('生まれた時',{exact:true}).inputValue(),'00');assert.equal(await page.getByLabel('生まれた分',{exact:true}).inputValue(),'05');
 await browser.close();console.log(name+': boundary, partial, blank, reset, full-width, external update, and live pages passed')
 }
})().catch(e=>{console.error(e);process.exit(1)})
