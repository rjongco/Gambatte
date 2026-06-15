// Create the target database if it does not already exist, then exit.
// drizzle-kit migrate connects straight to the target DB and cannot CREATE it,
// so this runs first (see the `db:setup` script / the migrate compose service).
//
// Reads:
//   DATABASE_URL        target connection (its db name is the one we ensure)
//   ADMIN_DATABASE_URL  optional: a connection to a maintenance db the role can
//                       already reach. If unset, we reuse DATABASE_URL's
//                       host/credentials but connect to the "postgres" db.
//
// Postgres has no CREATE DATABASE IF NOT EXISTS, so we check pg_database first.
import pg from "pg";

const target = process.env.DATABASE_URL;
if (!target) {
  console.error("ensure-db: DATABASE_URL is not set");
  process.exit(1);
}

const url = new URL(target);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!dbName) {
  console.error("ensure-db: DATABASE_URL has no database name in its path");
  process.exit(1);
}
// Identifier guard: only allow what we'd ever name a database, since the name
// must be string-interpolated into CREATE DATABASE (not parameterizable).
if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(dbName)) {
  console.error(`ensure-db: refusing to create unsafe database name "${dbName}"`);
  process.exit(1);
}

const adminUrl = process.env.ADMIN_DATABASE_URL ?? (() => {
  const u = new URL(target);
  u.pathname = "/postgres"; // default maintenance db
  return u.toString();
})();

const client = new pg.Client({ connectionString: adminUrl });
try {
  await client.connect();
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );
  if (rowCount > 0) {
    console.log(`ensure-db: database "${dbName}" already exists`);
  } else {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`ensure-db: created database "${dbName}"`);
  }
} catch (err) {
  // AggregateError (e.g. dual-stack ECONNREFUSED) has an empty .message; surface
  // the code and any nested errors so the failure is actually readable.
  const detail = err.message || err.code || String(err);
  const nested = err.errors?.map((e) => e.message || e.code).join("; ");
  console.error("ensure-db: failed:", nested ? `${detail} (${nested})` : detail);
  process.exit(1);
} finally {
  await client.end();
}
