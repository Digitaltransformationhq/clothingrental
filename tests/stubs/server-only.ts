/**
 * Test stub for the `server-only` package.
 *
 * `server-only` throws on import outside a React Server Component, which is the
 * point of it — but it means server modules cannot be imported by a test runner
 * either. Vitest resolves this stub in its place, so the guard still protects
 * the application build while the tests can exercise the code it guards.
 */
export {};
