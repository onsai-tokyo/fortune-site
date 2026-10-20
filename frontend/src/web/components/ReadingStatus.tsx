import { Page, PlainHeader, Button, LinkButton } from './ui'
import { useApp } from '../state/AppState'
export function ReadingStatus({ loading = false, empty = false }: { loading?: boolean; empty?: boolean }) {
  const { reloadReadings } = useApp()
  return <Page><PlainHeader /><section className="space-y-4 px-6 py-8"><h1 className="text-xl">読みもの</h1><p role={loading ? 'status' : 'alert'}>{loading ? '読み込み中です…' : empty ? '鑑定の作成が完了していないか、表示できる年がありません。保存状況を確認し、見つからない場合は出生情報を確認してください。' : '読み込めませんでした。再読み込みしてください。'}</p>{!loading && <><Button onClick={reloadReadings}>保存状況を再確認</Button><LinkButton to="/welcome?returnTo=%2Fyou">出生情報を確認して作成する</LinkButton></>}</section></Page>
}
