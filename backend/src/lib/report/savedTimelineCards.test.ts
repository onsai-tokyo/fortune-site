import test from 'node:test'
import assert from 'node:assert/strict'
import { annual3600Cards } from './annual3600/cards.js'
import { refreshSavedTimelineCards } from './savedTimelineCards.js'
import type { ReportCard } from '../reportCards.js'
const birth = {birthDate:'1995-02-20',birthTime:'05:40',gender:'female',birthplace:'名古屋',birthTimeZone:'Asia/Tokyo'}
const current = annual3600Cards(birth,2013,2035)
const legacy = current.map(c=>({...c,tags:['時期'],timelineTags:undefined,title:'保存された旧タイトル'}))
const essence = {...legacy[0],id:'essence',kind:'essence',tab:'essence',title:'性格本文'} as ReportCard

test('saved annual cards receive current tags and matching text without mutating stored cards',()=>{
 process.env.ANNUAL_READING_ENGINE='catalog3600'
 const before=JSON.stringify(legacy)
 const result=refreshSavedTimelineCards([essence,...legacy],birth,'self')
 assert.equal(result[0],essence)
 assert.deepEqual(result.slice(1),current)
 assert.ok(result.some(c=>c.tags.some(t=>t.includes('婚期'))))
 assert.equal(JSON.stringify(legacy),before)
})
test('legacy aliases and explicit conventions use the same snapshot policy',()=>{
 process.env.ANNUAL_READING_ENGINE='catalog3600'
 const b={birthplace:birth.birthplace,birthTimeZone:birth.birthTimeZone,birth_date:birth.birthDate,birth_time:birth.birthTime,gender:'female',spouseConvention:'male_wealth',annualYunConvention:'male'}
 const result=refreshSavedTimelineCards(legacy,b,'self')
 assert.deepEqual(result,annual3600Cards({...birth,spouseConvention:'male_wealth',annualYunConvention:'male'},2013,2035))
})
test('couple, missing snapshot and disabled engine do not replace saved cards',()=>{
 process.env.ANNUAL_READING_ENGINE='catalog3600'
 assert.equal(refreshSavedTimelineCards(legacy,{self:birth,partner:birth},'couple'),legacy)
 assert.equal(refreshSavedTimelineCards(legacy,null,'self'),legacy)
 assert.equal(refreshSavedTimelineCards(legacy,{},'self'),legacy)
 process.env.ANNUAL_READING_ENGINE='legacy'
 assert.equal(refreshSavedTimelineCards(legacy,birth,'self'),legacy)
})
test('unsupported birth input does not replace usable saved cards with an unavailable card',()=>{
 process.env.ANNUAL_READING_ENGINE='catalog3600'
 assert.deepEqual(refreshSavedTimelineCards(legacy,{birthDate:'1900-01-01'},'self'),legacy)
})
