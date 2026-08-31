import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { buildProductionTimingScoreTimeline, resolveTimingEngineMode } from './timingCompositionRoot.js'
import { assertTimingManifestHash } from './timingExactManifest.js'

const productionEntrypoints = [
  new URL('../../index.ts', import.meta.url),
  new URL('../../routes/preview.ts', import.meta.url), new URL('../../routes/calc.ts', import.meta.url),
  new URL('../deterministicReport.ts', import.meta.url), new URL('./buildSelfReport.ts', import.meta.url),
  new URL('./editorial.ts', import.meta.url), new URL('./timingCards.ts', import.meta.url),
]
const experimentalModules = [
  'timingCompositionRoot', 'timingEvidencePipeline', 'timingScoreEngine', 'timingClaimSelector', 'timingRuleReadiness',
  'timingExactManifest', 'timingLineageContract', 'timingScoreDesignContract', 'timingStemBranchEvidence',
  'timingWesternEvidence', 'timingVedicEvidence', 'timingZiweiEvidence',
]
const astronomyAdapter = realpathSync(fileURLToPath(new URL('../astronomyEngineAdapter.ts', import.meta.url)))
const APPROVED_ASTRONOMY_ADAPTER_SHA256 = '761bf2da0e434467538619e91dee6a2a0b0c9d5244102288dde3c5ef53b1f258'
function referencedModules(source: string): string[] {
  return ts.preProcessFile(source, true, true).importedFiles.map(item => item.fileName)
}

function unsafeRuntimeModuleLoading(source: string, allowApprovedAstronomyAdapter = false): string[] {
  const parsed = ts.createSourceFile('isolation.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const errors: string[] = []
  const forbiddenCapabilityNames = new Set(['createRequire', 'getBuiltinModule'])
  const moduleCapabilityImports = referencedModules(source).filter(specifier => ['node:module', 'module'].includes(specifier))
  if (moduleCapabilityImports.length && !allowApprovedAstronomyAdapter) errors.push('module-loading-capability')
  if (allowApprovedAstronomyAdapter) {
    const digest = createHash('sha256').update(source).digest('hex')
    if (digest !== APPROVED_ASTRONOMY_ADAPTER_SHA256) errors.push('astronomy-adapter-drift')
  }
  const createRequireBindings = new Set<string>()
  const moduleNamespaces = new Set<string>()
  const loaders = new Set<string>()
  const allowedExternalPackages = new Set(['astronomy-engine'])
  for (const statement of parsed.statements) if (ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier) && ['node:module', 'module'].includes(statement.moduleSpecifier.text)) {
    const clause = statement.importClause
    if (clause?.name) moduleNamespaces.add(clause.name.text)
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const element of clause.namedBindings.elements) {
      if ((element.propertyName ?? element.name).text === 'createRequire') createRequireBindings.add(element.name.text)
      if ((element.propertyName ?? element.name).text === 'Module') moduleNamespaces.add(element.name.text)
    }
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) moduleNamespaces.add(clause.namedBindings.name.text)
  }
  const isCreateRequireReference = (node: ts.Expression) =>
    (ts.isIdentifier(node) && createRequireBindings.has(node.text))
    || (ts.isPropertyAccessExpression(node) && node.name.text === 'createRequire'
      && ((ts.isIdentifier(node.expression) && moduleNamespaces.has(node.expression.text))
        || ts.isCallExpression(node.expression)))
  const collectLoaders = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isCallExpression(node.initializer) && isCreateRequireReference(node.initializer.expression)) loaders.add(node.name.text)
    ts.forEachChild(node, collectLoaders)
  }
  collectLoaders(parsed)
  const validateLoadedSpecifier = (argument: ts.Expression | undefined) => {
    if (!argument || !ts.isStringLiteral(argument)) return errors.push('createRequire-computed')
    if (!allowedExternalPackages.has(argument.text)) errors.push('createRequire-disallowed')
  }
  const visit = (node: ts.Node) => {
    // CI guard against accidental or ordinary source-level runtime-loading paths.
    // This deliberately is not a sandbox for adversarial repository code: computed
    // strings or reflection can evade any finite AST token rule. The trust boundary is
    // documented in TIMING_PRODUCTION_ISOLATION_THREAT_MODEL.md. The one intentional
    // adapter is separately restricted by canonical path and exact SHA-256 hash.
    if (!allowApprovedAstronomyAdapter
      && ((ts.isIdentifier(node) && forbiddenCapabilityNames.has(node.text))
        || ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
          && forbiddenCapabilityNames.has(node.text)))) errors.push('module-loading-capability-token')
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') errors.push('new-Function')
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && !ts.isStringLiteral(node.arguments[0])) errors.push('computed-import')
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require' && !ts.isStringLiteral(node.arguments[0])) errors.push('computed-require')
      if (ts.isIdentifier(node.expression) && node.expression.text === 'eval') errors.push('eval')
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'process' && node.expression.name.text === 'getBuiltinModule') errors.push('getBuiltinModule')
      if (ts.isIdentifier(node.expression) && loaders.has(node.expression.text)) validateLoadedSpecifier(node.arguments[0])
      if (ts.isCallExpression(node.expression) && isCreateRequireReference(node.expression.expression)) validateLoadedSpecifier(node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return [...new Set(errors)]
}

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier.replace(/\.js$/, ''))
  for (const candidate of [`${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts')]) if (existsSync(candidate)) return realpathSync(candidate)
  return null
}

function dependencyGraph(entrypoint: URL): Set<string> {
  const visited = new Set<string>()
  const visit = (file: string) => {
    const canonical = realpathSync(file)
    if (visited.has(canonical)) return
    visited.add(canonical)
    const source = readFileSync(canonical, 'utf8')
    assert.deepEqual(
      unsafeRuntimeModuleLoading(source, canonical === astronomyAdapter),
      [],
      `Production graph contains unsafe runtime module loading: ${canonical}`,
    )
    for (const specifier of referencedModules(source)) {
      const dependency = resolveLocalImport(canonical, specifier)
      if (dependency) visit(dependency)
    }
  }
  visit(fileURLToPath(entrypoint))
  return visited
}

test('時期18スコアが未完成の間は本番鑑定の依存グラフへ接続しない', () => {
  for (const entrypoint of productionEntrypoints) for (const dependency of dependencyGraph(entrypoint)) for (const moduleName of experimentalModules) {
    assert.notEqual(dependency.endsWith(`/${moduleName}.ts`), true, `${entrypoint.pathname} から間接的に ${moduleName} へ到達できます: ${dependency}`)
  }
})

test('依存グラフ抽出はimport・再export・dynamic import・requireをすべて検出する', () => {
  assert.deepEqual(referencedModules(`
    import './plain.js'
    export { value } from './barrel.js'
    const dynamic = import('./dynamic.js')
    const commonJs = require('./common.cjs')
  `), ['./plain.js', './barrel.js', './dynamic.js', './common.cjs'])
})

test('computed import・computed require・createRequireを安全検査で拒否する', () => {
  assert.deepEqual(unsafeRuntimeModuleLoading(`const target = './timingScoreEngine.js'; void import(target)`), ['computed-import'])
  assert.deepEqual(unsafeRuntimeModuleLoading(`const target = './timingScoreEngine.js'; require(target)`), ['computed-require'])
  assert.ok(unsafeRuntimeModuleLoading(`import { createRequire } from 'node:module'; const loader = createRequire(import.meta.url); loader(target)`).includes('createRequire-computed'))
  for (const fixture of [
    `import { createRequire } from 'node:module'; createRequire(import.meta.url)('./timingEvidencePipeline.js')`,
    `import { createRequire as cr } from 'node:module'; const r = cr(import.meta.url); r('./timingEvidencePipeline.js')`,
    `import * as moduleApi from 'node:module'; const r = moduleApi.createRequire(import.meta.url); r('./timingEvidencePipeline.js')`,
    `import moduleApi from 'node:module'; const r = moduleApi.createRequire(import.meta.url); r('./timingEvidencePipeline.js')`,
    `import { Module } from 'node:module'; Module.createRequire(import.meta.url)('./timingEvidencePipeline.js')`,
    `import { createRequire } from 'module'; createRequire(import.meta.url)('./timingEvidencePipeline.js')`,
    `import moduleApi from 'node:module'; const cr = moduleApi.createRequire; cr(import.meta.url)('./timingEvidencePipeline.js')`,
    `import moduleApi from 'node:module'; const { createRequire } = moduleApi; createRequire(import.meta.url)('./timingEvidencePipeline.js')`,
    `import moduleApi from 'node:module'; moduleApi['createRequire'](import.meta.url)('./timingEvidencePipeline.js')`,
    `const moduleApi = await import('node:module'); moduleApi.createRequire(import.meta.url)('./timingEvidencePipeline.js')`,
  ]) assert.ok(unsafeRuntimeModuleLoading(fixture).includes('module-loading-capability'))
  assert.ok(unsafeRuntimeModuleLoading(`process.getBuiltinModule('module').createRequire(import.meta.url)('./timingEvidencePipeline.js')`).includes('getBuiltinModule'))
  for (const fixture of [
    `const moduleApi = process['getBuiltinModule']('module'); const cr = moduleApi.createRequire; cr(import.meta.url)('./timingEvidencePipeline.js')`,
    `const moduleApi = process['getBuiltinModule']('module'); const { createRequire } = moduleApi; createRequire(import.meta.url)('./timingEvidencePipeline.js')`,
    `const moduleApi = Reflect.get(process, 'getBuiltinModule')('module'); moduleApi.createRequire(import.meta.url)('./timingEvidencePipeline.js')`,
    `const moduleApi = globalThis.process['getBuiltinModule']('module'); moduleApi['createRequire'](import.meta.url)('./timingEvidencePipeline.js')`,
  ]) assert.ok(unsafeRuntimeModuleLoading(fixture).includes('module-loading-capability-token'))
  assert.deepEqual(unsafeRuntimeModuleLoading(`eval('require(\\'./timingEvidencePipeline.js\\')')`), ['eval'])
  assert.deepEqual(unsafeRuntimeModuleLoading(`new Function('return import(\\'./timingEvidencePipeline.js\\')')`), ['new-Function'])
})

test('通常のNode module-loading参照は固定hashのastronomy adapter以外で拒否する', () => {
  const source = readFileSync(astronomyAdapter, 'utf8')
  assert.deepEqual(unsafeRuntimeModuleLoading(source, true), [])
  assert.ok(unsafeRuntimeModuleLoading(`${source}\n// drift`, true).includes('astronomy-adapter-drift'))
  assert.ok(unsafeRuntimeModuleLoading(source).includes('module-loading-capability'))
  assert.ok(unsafeRuntimeModuleLoading(`export { createRequire as loader } from 'node:module'`).includes('module-loading-capability'))
})

test('composition rootを直接呼んでもreadiness未達なら本番結果を返さない', () => {
  const previousMode = process.env.TIMING_ENGINE_MODE
  const previousHash = process.env.TIMING_V2_MANIFEST_HASH
  try {
    process.env.TIMING_ENGINE_MODE = 'v2'
    process.env.TIMING_V2_MANIFEST_HASH = 'a'.repeat(64)
    assert.throws(() => buildProductionTimingScoreTimeline({
      birthYear: 1995, birthMonth: 2, birthDay: 20, birthHour: 3, birthMinute: 2, birthplace: '愛知県', gender: 'female',
    }), /Timing exact manifest is not ready/)
  } finally {
    if (previousMode === undefined) delete process.env.TIMING_ENGINE_MODE
    else process.env.TIMING_ENGINE_MODE = previousMode
    if (previousHash === undefined) delete process.env.TIMING_V2_MANIFEST_HASH
    else process.env.TIMING_V2_MANIFEST_HASH = previousHash
  }
})

test('engine modeは未指定時legacyで、v2は明示指定だけを受け付ける', () => {
  assert.equal(resolveTimingEngineMode(undefined), 'legacy')
  assert.equal(resolveTimingEngineMode(''), 'legacy')
  assert.equal(resolveTimingEngineMode('shadow'), 'shadow')
  assert.equal(resolveTimingEngineMode('v2'), 'v2')
  assert.throws(() => resolveTimingEngineMode('true'), /Unknown TIMING_ENGINE_MODE/)
})

test('production rootはenv以外からmode/hashを注入できない', () => {
  const input = { birthYear: 1995, birthMonth: 2, birthDay: 20, birthplace: '愛知県', gender: 'female' as const }
  const previousMode = process.env.TIMING_ENGINE_MODE
  try {
    delete process.env.TIMING_ENGINE_MODE
    assert.throws(() => buildProductionTimingScoreTimeline(input), /current=legacy/)
    process.env.TIMING_ENGINE_MODE = 'shadow'
    assert.throws(() => buildProductionTimingScoreTimeline(input), /current=shadow/)
  } finally {
    if (previousMode === undefined) delete process.env.TIMING_ENGINE_MODE
    else process.env.TIMING_ENGINE_MODE = previousMode
  }
})

test('manifest hashは64桁SHA-256の完全一致だけを受け付ける', () => {
  const hash = 'a'.repeat(64)
  assert.doesNotThrow(() => assertTimingManifestHash(hash, hash))
  assert.throws(() => assertTimingManifestHash(null, hash), /not available/)
  assert.throws(() => assertTimingManifestHash(hash, undefined), /missing or invalid/)
  assert.throws(() => assertTimingManifestHash(hash, 'b'.repeat(64)), /hash mismatch/)
})
