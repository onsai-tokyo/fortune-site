import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { buildFromBirths } from '../../lib/report/coupleAllYears/timeline.js'

/** Review only. Not mounted in the production API, and no production database access. */
export function createCouplePreviewServer() {
  const server=createServer(async(req,res)=>{
    const address=server.address(),port=address&&typeof address==='object'?address.port:0
    const host=`127.0.0.1:${port}`,origin=`http://${host}`
    res.setHeader('Cache-Control','no-store')
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('Referrer-Policy','no-referrer')
    res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    const json=(status:number,value:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value))}
    if(req.headers.host!==host||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site') {json(403,{error:'このMacのプレビューから開いてください。'});return}
    try {
      if(req.method==='GET'&&(req.url==='/'||req.url==='/app.js')) {
        const html=req.url==='/'
        res.setHeader('Content-Type',html?'text/html; charset=utf-8':'text/javascript; charset=utf-8')
        res.end(readFileSync(new URL(html?'./index.html':'./app.js',import.meta.url)));return
      }
      if(req.method==='POST'&&req.url==='/api/timeline') {
        if(req.headers['content-type']!=='application/json') {json(415,{error:'JSONが必要です。'});return}
        const parts:Buffer[]=[];let size=0
        for await(const chunk of req) {size+=chunk.length;if(size>16000)throw new Error('入力が大きすぎます。');parts.push(Buffer.from(chunk))}
        const input=JSON.parse(Buffer.concat(parts).toString('utf8'))
        // Reference/end year controls are intentionally not supplied by this preview client.
        const result=buildFromBirths(input.a,input.b,input.meetingYear)
        json(200,result);return
      }
      json(404,{error:'見つかりません。'})
    } catch(error) {json(400,{error:error instanceof Error?error.message:'生成できませんでした。'})}
  })
  return server
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const port=Number(process.argv[2]??8186)
  if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('Invalid port')
  createCouplePreviewServer().listen(port,'127.0.0.1',()=>console.log(`Couple timeline preview: http://127.0.0.1:${port}`))
}
