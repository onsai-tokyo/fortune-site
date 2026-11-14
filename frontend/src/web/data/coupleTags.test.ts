import test from 'node:test'
import assert from 'node:assert/strict'
import { coupleTags } from './coupleTags'
import { coupleReadings } from './readingData'
const year = { year: 2026, label: '', title: '二人の関わり方が大きく変わる年', you: '', partner: '', body: [] }
test('tags are grounded in a year title and ordinary years do not receive a turning point label', () => {
  assert.deepEqual(coupleTags(year), ['転機', '関係が動く年'])
  assert.deepEqual(coupleTags({ ...year, title: '相手の状況が関係を動かす年' }), ['関係が動く年'])
  assert.deepEqual(coupleTags({ ...year, title: '穏やかに過ごす年' }), [])
})
test('real API tags are preserved and deduplicated instead of replaced by guessed labels', () => {
  const [mapped] = coupleReadings({ entries: [{ year: 2026, contentStatus: 'ready', card: { title: year.title, tags: ['#出会い', '出会い', '相互理解'] } }] })
  assert.deepEqual(coupleTags(mapped), ['出会い', '相互理解'])
})
