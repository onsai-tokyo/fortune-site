export function assertAuthConfiguration(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === 'production' && env.REQUIRE_READING_AUTH === 'false') {
    throw new Error('Production reading authentication cannot be disabled')
  }
}
