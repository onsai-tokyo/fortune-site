// Only the installed package metadata is imported; do not enable arbitrary JSON modules.
declare module 'lunar-javascript/package.json' {
  const metadata: unknown
  export default metadata
}
