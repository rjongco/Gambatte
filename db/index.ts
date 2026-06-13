import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://gambatte:gambatte@localhost:5432/gambatte";

// Reuse the pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { _pool?: Pool };
const pool = globalForDb._pool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb._pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
