import { createReadStream, writeFileSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import assert from 'node:assert/strict'
import { baziPart,sukuyoPart,PILLARS,MANSIONS } from '../lib/report/coupleAllYears/composer.js'

const [banks,output]=process.argv.slice(2)
if(!banks||!output) throw new Error('Usage: checkCoupleAllYears.ts BANK_DIRECTORY OUTPUT_JSON')
const result:Record<string,unknown>={}
for(const [name,expected] of [['bazi_216000',216000],['sukuyo_19683',19683]] as const) {
  let count=0,min=Infinity,max=0
  const ids=new Set<string>()
  const lines=createInterface({input:createReadStream(`${banks}/${name}.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity})
  for await(const line of lines) {
    const row=JSON.parse(line), indexes=row.id.split('-').slice(2).map((x:string)=>Number(x)-1)
    let actual:unknown
    if(name==='bazi_216000') {
      const part=baziPart(PILLARS[indexes[0]],PILLARS[indexes[1]],PILLARS[indexes[2]])
      actual=part
    } else actual=sukuyoPart(MANSIONS[indexes[0]],MANSIONS[indexes[1]],MANSIONS[indexes[2]])
    assert.deepEqual(actual,row,`Mismatch: ${row.id}`)
    assert.ok(!ids.has(row.id));ids.add(row.id)
    const length=0 // v4 banks contain material references, not finished prose
    min=Math.min(min,length);max=Math.max(max,length);count++
  }
  assert.equal(count,expected)
  result[name]={count,exactMatches:count,min,max}
  console.log(`${name}: ${count} exact matches`)
}
writeFileSync(output,JSON.stringify(result,null,2)+'\n')
