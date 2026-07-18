import { vi } from "vitest";

// A minimal, flexible stand-in for a Supabase PostgREST/RPC query chain.
// Every chainable method (select/eq/order/insert/update/delete) returns
// the same builder object, so tests don't need to match the exact chain
// shape used in application code (e.g. .eq().eq().maybeSingle() vs.
// .eq().order()) — one mock works for all of them. Awaiting the builder
// directly, or calling .single()/.maybeSingle(), both resolve to the
// configured result.
export function createQueryResult(result) {
  const builder = {};
  const chainable = [
    "select",
    "eq",
    "neq",
    "order",
    "insert",
    "update",
    "delete"
  ];
  for (const method of chainable) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

// Builds a mock Supabase client for a single request/test.
//
// `fromResults` maps table name -> either a single { data, error } result
// (returned for every .from(table) call) or an array of results
// (consumed in order across multiple calls to the same table within one
// test, holding on the last entry once exhausted — handy for a route
// that queries the same table twice with different expectations).
//
// `rpcResults` maps function name -> { data, error }.
export function createMockSupabaseClient({
  getUser,
  fromResults = {},
  rpcResults = {}
} = {}) {
  const callCounts = {};

  const from = vi.fn((table) => {
    const config = fromResults[table];
    let result;
    if (Array.isArray(config)) {
      const index = callCounts[table] ?? 0;
      result = config[Math.min(index, config.length - 1)];
      callCounts[table] = index + 1;
    } else {
      result = config ?? { data: null, error: null };
    }
    return createQueryResult(result);
  });

  const rpc = vi.fn((fnName) => {
    const result = rpcResults[fnName] ?? { data: null, error: null };
    return createQueryResult(result);
  });

  return {
    auth: { getUser: getUser ?? vi.fn() },
    from,
    rpc
  };
}
