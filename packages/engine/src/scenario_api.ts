/**
 * The scenario functions callers reach as `scenario.compileSetup` and so on
 * (`index.ts` exports this module as the `scenario` namespace), so their names
 * don't repeat "scenario". The scenario types stay flat exports.
 */
export { pickReferenceSide } from './scenario';
export { compileSetup } from './setup';
