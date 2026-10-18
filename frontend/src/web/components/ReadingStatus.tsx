import { Page, PlainHeader, Button } from './ui'
import { useApp } from '../state/AppState'
export function ReadingStatus({ loading = false, empty = false }: { loading?: boolean; empty?: boolean }) {
  const { reloadReadings } = useApp()
  return <Page><PlainHeader /><section className="space-y-4 px-6 py-8"><h1 className="text-xl">読みもの</h1><p role={loading ? 'status' : 'alert'}>{loading ? '読み込み中です…' : empty ? 'この読みものはまだありません。' : '読み込めませんでした。再読み込みしてください。'}</p>{!loading && <Button onClick={reloadReadings}>再読み込み</Button>}</section></Page>
}
