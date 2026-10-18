// One counter covers owner changes, logout/login to the same owner, and disposal.
export class AccountBoundary {
  private revision = 0
  private owner: string | null = null
  capture() { return this.revision }
  current(revision: number) { return revision === this.revision }
  select(owner: string | null, force = false) {
    if (force || owner !== this.owner) { this.owner = owner; this.revision++ }
    return this.revision
  }
  invalidate() { this.revision++ }
}

export async function restoreSession<T>(
  boundary: AccountBoundary, read: () => Promise<T>, apply: (value: T) => void,
  fail: () => void, finish: () => void,
) {
  const revision = boundary.capture()
  try { const value = await read(); if (boundary.current(revision)) apply(value) }
  catch { if (boundary.current(revision)) fail() }
  finally { if (boundary.current(revision)) finish() }
}
