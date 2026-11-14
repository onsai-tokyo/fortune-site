import test from 'node:test'
import assert from 'node:assert/strict'
import { personalReadings, coupleReadings, sourceCatalog, savedCatalog, readingSections } from './readingData'
import type { Partner } from './types'
const partner: Partner = { id: 'p-actual', name: '実際の相手', relation: '友人', birthDate: '1988-06-01', birthTime: null, birthPlace: '', gender: 'female', metYear: 2030 }
test('personal mapping uses real pages/sections, headline, year and exact source IDs', () => {
  const p = personalReadings([{ id: 'turning-year-2037', title: '実際の年', pages: [{ label: '年の本文', text: '計算された流れ' }] }], [{ id: 'personality-actual-1', title: '本人固有の見出し', kind: 'essence', pages: [{ label: '本人', text: '本人の文章' }] }, { id: 'couple-only', scope: 'couple', title: '混ぜない' }], 'actual-source', 'image')
  assert.equal(p.personaTitle, '本人固有の見出し'); assert.equal(p.chapters.length, 1)
  assert.equal(p.years[0].year, 2037); assert.equal(p.years[0].sourceId, 'actual-source')
  assert.equal(p.years[0].sections[0].body, '計算された流れ')
  assert.equal(p.chapters[0].sourceCardId, 'personality-actual-1')
})
test('empty responses do not fall back and demo prose is rejected', () => {
  assert.deepEqual(personalReadings([], [], 'id', 'image').years, [])
  assert.equal(personalReadings([], [], 'id', 'image').personaTitle, '')
  assert.throws(() => readingSections({ pages: [{ text: '［サンプル］表示しない' }] }))
  assert.deepEqual(readingSections({ access: { locked: true }, pages: [{ text: 'secret' }] }), [])
})
test('couple sources and saves follow actual timeline years and partner, not fixed demo years', () => {
  const couples = { [partner.id]: coupleReadings({ entries: [{ year: 2037, label: '実年', contentStatus: 'ready', card: { id: 'couple-actual-2037', title: '本物のふたり', sections: [{ body: '実際の本文' }] } }] }) }
  const sources = sourceCatalog([partner], [], [], couples).flatMap(g => g.items)
  assert.equal(sources.length, 1); assert.equal(sources[0].href, '/couple/p-actual?year=2037'); assert.equal(sources[0].theme, '人間関係')
  assert.equal(sources[0].sourceId, undefined, 'not falsely attributed to self reading before persistence')
  assert.equal(sources[0].sourceCardId, 'couple-actual-2037')
  const saved = savedCatalog([partner], [], [], couples)
  assert.equal(saved[0].id, 'couple-p-actual-2037'); assert.deepEqual(savedCatalog([partner]), [])
  assert.equal(sourceCatalog([{ ...partner, relation: '夫婦' }], [], [], couples)[2].items[0].theme, '恋愛・関係')
})
