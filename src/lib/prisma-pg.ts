import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Prisma local postgres / transaction poolers often break node-postgres
 * extended protocol (Parse/Bind), surfacing as 08P01:
 *   bind message supplies N parameters, but prepared statement "" requires 0
 *
 * Force simple-query protocol by inlining already-mapped parameter values.
 * Values reach pg only after PrismaPg's mapArg(), so escaping here is safe
 * for Prisma-generated SQL.
 *
 * Prisma local also recommends a small pool (server cap ~10) with a tiny idle
 * timeout; oversized pools + nested Promise.all storms close connections (P1017).
 */
let simpleQueryPatched = false;

function escapePgLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid numeric SQL parameter");
    }
    return String(value);
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (value instanceof Date) {
    return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `'\\x${value.toString("hex")}'`;
  }
  if (value instanceof Uint8Array) {
    return `'\\x${Buffer.from(value).toString("hex")}'`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `'{}'`;
    return `ARRAY[${value.map((item) => escapePgLiteral(item)).join(", ")}]`;
  }
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

function inlineSqlParameters(text: string, values: unknown[]): string {
  return text.replace(/\$(\d+)/g, (_match, raw: string) => {
    const index = Number(raw) - 1;
    if (index < 0 || index >= values.length) {
      throw new Error(`Missing SQL parameter $${raw}`);
    }
    return escapePgLiteral(values[index]);
  });
}

function enableSimpleQueryProtocol() {
  if (simpleQueryPatched) return;
  simpleQueryPatched = true;

  const clientProto = pg.Client.prototype as unknown as {
    query: (...args: unknown[]) => unknown;
  };
  const originalQuery = clientProto.query;

  clientProto.query = function patchedQuery(this: pg.Client, ...args: unknown[]) {
    const [config, values, callback] = args;

    // query(text, values[, callback]) → simple query with inlined literals
    if (typeof config === "string" && Array.isArray(values)) {
      const text = inlineSqlParameters(config, values as unknown[]);
      if (typeof callback === "function") {
        return originalQuery.call(this, text, callback);
      }
      return originalQuery.call(this, text);
    }

    // query({ text, values, ... }[, callback]) — drop `name` so pg never
    // uses the extended prepared-statement protocol.
    if (
      config &&
      typeof config === "object" &&
      Array.isArray((config as { values?: unknown[] }).values)
    ) {
      const queryConfig = config as {
        text?: string;
        values: unknown[];
        rowMode?: string;
        types?: unknown;
      };
      const next = {
        text: inlineSqlParameters(queryConfig.text ?? "", queryConfig.values),
        rowMode: queryConfig.rowMode,
        types: queryConfig.types,
      };
      if (typeof values === "function") {
        return originalQuery.call(this, next, values);
      }
      if (typeof callback === "function") {
        return originalQuery.call(this, next, callback);
      }
      return originalQuery.call(this, next);
    }

    return originalQuery.apply(this, args);
  };
}

// Apply as soon as this module loads so hot-reloaded/global Prisma clients
// also avoid the extended prepared-statement protocol.
enableSimpleQueryProtocol();

const DEFAULT_POOL_MAX = 5;

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }

  enableSimpleQueryProtocol();

  const pool = new pg.Pool({
    connectionString,
    max: DEFAULT_POOL_MAX,
    // Prisma local: idle timeout should be the smallest positive value.
    idleTimeoutMillis: 1,
    // 0 = no client-side connect timeout (matches prisma dev URL advice).
    connectionTimeoutMillis: 0,
    allowExitOnIdle: true,
  });

  pool.on("error", (err) => {
    console.error("[prisma-pg] idle client error:", err.message);
  });

  const adapter = new PrismaPg(pool, {
    disposeExternalPool: true,
    onPoolError: (err) => {
      console.error("[prisma-pg] pool error:", err.message);
    },
    onConnectionError: (err) => {
      console.error("[prisma-pg] connection error:", err.message);
    },
  });

  return new PrismaClient({ adapter });
}
