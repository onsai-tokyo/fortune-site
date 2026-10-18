import { createServer, type IncomingMessage } from 'node:http'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ReadingReviewStore, ReviewConflict } from '../../research/readingReview.js'

async function body(req:IncomingMessage){
  const chunks:Buffer[]=[];let length=0
  for await(const part of req){const chunk=Buffer.from(part);length+=chunk.length;if(length>2_000_000)throw new Error('入力が大きすぎます');chunks.push(chunk)}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
// A fresh process loads current engine files after every logic edit. A long-lived
// server's imported module cache must not be labeled with a newer on-disk hash.
function generateFresh(root:string,input:unknown):Promise<unknown>{
  return new Promise((resolve,reject)=>{
    const worker=fileURLToPath(new URL('./readingReviewWorker.ts',import.meta.url))
    const loader=fileURLToPath(new URL('../../../node_modules/tsx/dist/loader.mjs',import.meta.url))
    const child=spawn(process.execPath,['--import',loader,worker],{stdio:['pipe','pipe','pipe']})
    const output:Buffer[]=[];let size=0
    const timer=setTimeout(()=>{child.kill();reject(new Error('生成に時間がかかっています。保存一覧を確認して再試行してください'))},60_000)
    child.stdout.on('data',(data:Buffer)=>{size+=data.length;if(size>12_000_000){child.kill();reject(new Error('鑑定データが上限を超えました'))}else output.push(data)})
    child.stderr.resume() // Never send private chart/input diagnostics to the browser.
    child.on('error',()=>{clearTimeout(timer);reject(new Error('鑑定の生成処理を起動できませんでした'))})
    child.on('close',code=>{clearTimeout(timer);if(code!==0){reject(new Error('鑑定を生成できませんでした。出生情報を確認してください'));return}try{resolve(JSON.parse(Buffer.concat(output).toString('utf8')))}catch{reject(new Error('鑑定の生成結果を読み取れませんでした'))}})
    child.stdin.on('error',()=>{})
    child.stdin.end(JSON.stringify({root,input}))
  })
}
/** Standalone loopback tool. Never mounted by backend/src/index.ts. */
export function createReadingReviewServer(root:string){
  const store=new ReadingReviewStore(root),token=randomBytes(32).toString('hex')
  const ui=new URL('../../research/readingReviewUI/',import.meta.url)
  const server=createServer(async(req,res)=>{
    const address=server.address(),port=address&&typeof address==='object'?address.port:0,host=`127.0.0.1:${port}`,origin=`http://${host}`
    const json=(status:number,value:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value))}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer')
    res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
    if(req.headers.host!==host||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'){json(403,{error:'このMacの確認画面から開いてください'});return}
    try{
      const path=new URL(req.url??'/',origin).pathname
      if(req.method==='GET'&&(path==='/'||path==='/app.js')){
        res.setHeader('Content-Type',path==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8')
        const data=readFileSync(new URL(path==='/'?'index.html':'app.js',ui),'utf8')
        res.end(path==='/'?data.replace('__REVIEW_TOKEN__',token):data);return
      }
      if(req.headers['x-review-token']!==token){json(403,{error:'確認画面を開き直してください'});return}
      if(req.method==='GET'&&path==='/api/runs'){json(200,store.list());return}
      const match=path.match(/^\/api\/runs\/([0-9a-f-]+)(\/feedback)?$/)
      if(req.method==='GET'&&match&&!match[2]){json(200,store.get(match[1]));return}
      if(req.method==='POST'&&req.headers['content-type']!=='application/json'){json(415,{error:'JSON形式で送信してください'});return}
      if(req.method==='POST'&&path==='/api/generate'){
        const v=await body(req);json(201,await generateFresh(root,v));return
      }
      if(req.method==='POST'&&match?.[2]){
        const v=await body(req);json(200,store.save(match[1],v.revision,v.contentHash,v.feedback));return
      }
      json(404,{error:'この操作はありません'})
    }catch(error){json(error instanceof ReviewConflict?409:400,{error:error instanceof Error?error.message:'処理を完了できませんでした'})}
  })
  return {server,store}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=process.argv[2],port=Number(process.argv[3]??8181)
  if(!root||!Number.isInteger(port)||port<1024||port>65535)throw new Error('保存先の絶対パスとポート番号を指定してください')
  const {server}=createReadingReviewServer(root)
  server.listen(port,'127.0.0.1',()=>console.log(`Developer review ready: http://127.0.0.1:${port}`))
}
