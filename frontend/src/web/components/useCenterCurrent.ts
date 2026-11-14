import { useLayoutEffect, useRef } from 'react'

/**
 * 横にスクロールする年の並びで、選んでいる年（data-current="true"）が見える位置に来るようにする。
 * ページ全体は動かさず、並びの中だけを動かす。
 */
export function useCenterCurrent<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const box = ref.current
    const item = box?.querySelector<HTMLElement>('[data-current="true"]')
    if (!box || !item) return
    box.scrollLeft = Math.max(0, item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2)
  }, [key])
  return ref
}
