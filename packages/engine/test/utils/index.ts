/**
 * Shared helpers for engine and scenario tests: scenario definition builders,
 * standard fake investigators and shortcuts for starting a scenario. Import
 * from `../test/utils` inside the engine and from `@arkham/engine/test/utils`
 * in other packages. Cards come from the engine's blank cards and tables
 * from `newGame()`. Builders have boring defaults; anything an assertion
 * depends on is passed explicitly in the test.
 */
export * from './board';
export * from './investigators';
export * from './scenario';
export * from './campaign';
