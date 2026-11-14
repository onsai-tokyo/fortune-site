import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveBookSource, type BookSourceContext } from './bookSource'
import type { Book, Partner } from './types'

const book: Book = { id: 'book', title: '本', theme: '時期の判断', question: '相談', createdAt: '', state: 'delivered', sourceTitle: 'あなたについて', sourceSub: '', sourceHref: '/you', sourceId: 'self', sourceCardId: 'year-2025', cover: '', sections: [], questionsLeft: 2 }
const context: BookSourceContext = { selfSourceId: 'self', years: [{ sourceId: 'self', sourceCardId: 'year-2025', year: 2025, label: '', title: '本当の2025年', tags: [], summary: '', sections: [] }], chapters: [{ id: 'character', sourceId: 'self', sourceCardId: 'character', title: '本当の性格', sub: '', image: '' }], partners: [], coupleYears: {} }

test('book source uses the exact personal year and chapter IDs', () => {
  const year = resolveBookSource(book, context)
  assert.equal(year.sourceHref, '/you/years/2025')
  assert.equal(year.sourceTitle, 'あなたの2025年')
  assert.equal(year.sourceSub, '本当の2025年')
  const chapter = resolveBookSource({ ...book, sourceCardId: 'character' }, context)
  assert.equal(chapter.sourceHref, '/you/chapters/character')
  assert.equal(chapter.sourceTitle, '本当の性格')
})
test('couple year is bound to its conversation and partner, not a shared year/card ID', () => {
  const partners: Partner[] = ['a', 'b'].map(id => ({ id, name: id, relation: '友人', birthDate: '', birthTime: null, birthPlace: '', gender: 'female', metYear: null }))
  const c = { ...context, partners, bookSourcePartners: { ca: 'a', cb: 'b' }, coupleYears: Object.fromEntries(partners.map(p => [p.id, [{ year: 2025, label: '', title: p.id + 'の実年表', you: '', partner: '', body: [], sourceCardId: 'same-card' }]])) }
  for (const id of ['a', 'b']) {
    const result = resolveBookSource({ ...book, sourceId: 'c' + id, sourceCardId: 'same-card' }, c)
    assert.equal(result.sourceHref, `/couple/${id}?year=2025`)
    assert.equal(result.sourceTitle, `${id}との2025年`)
    assert.equal(result.sourceSub, `${id}の実年表`)
  }
  assert.equal(resolveBookSource({ ...book, sourceId: 'ca', sourceCardId: 'same-card' }, { ...c, partners: [partners[1]] }).sourceHref, '')
})
test('missing, stale and foreign source IDs never fall back to another reading', () => {
  for (const input of [{ ...book, sourceId: 'old-self' }, { ...book, sourceCardId: 'unknown' }, { ...book, sourceCardId: undefined }, { ...book, sourceId: undefined }]) {
    assert.equal(resolveBookSource(input, context).sourceHref, '')
  }
  assert.equal(resolveBookSource(book, { ...context, years: [], chapters: [] }).sourceHref, '')
})
