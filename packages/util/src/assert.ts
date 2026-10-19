/**
 * Ends the `default` branch of a `switch` over a closed union. Its parameter is
 * `never`, so adding a variant to the union stops compiling until every such
 * switch handles it; if an unexpected value arrives anyway (data from outside
 * the type system), it throws instead of silently falling through.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
