export function expectedCommitFrom(args, env = {}) {
  let fromArgument
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--expected-commit' || fromArgument !== undefined || !args[i + 1]) {
      throw new Error('Usage: stagingSmoke.mjs --expected-commit <full 40-character SHA> (or STAGING_EXPECTED_COMMIT)')
    }
    fromArgument = args[++i]
  }
  const sha = fromArgument ?? env.STAGING_EXPECTED_COMMIT
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/i.test(sha)) {
    throw new Error('A full 40-character expected commit SHA is required; staging smoke was not started')
  }
  return sha.toLowerCase()
}
