import { createRequire } from 'node:module'
import type * as AstronomyTypes from 'astronomy-engine'

/** production graphでNodeのmodule-loading capabilityを使える唯一のadapter。 */
export const Astronomy = createRequire(import.meta.url)('astronomy-engine') as typeof AstronomyTypes
