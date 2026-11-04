// Disposable PostgreSQL for the Playwright suite.
// Starts a real Postgres (embedded-postgres), pushes the Prisma schema, seeds it,
// then opens a tiny HTTP "ready" endpoint so Playwright knows it can start the app.
// Everything lives in .e2e-db/ and is wiped on each run.
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = Number(process.env.E2E_DB_PORT || 54329);
const READY_PORT = Number(process.env.E2E_DB_READY_PORT || 54330);
const dir = path.resolve(".e2e-db");
const url = `postgresql://postgres:postgres@localhost:${PORT}/utu_e2e`;

// A previous run that was killed hard (common on Windows) can leave postgres running on the
// data dir. Stop it first, then wipe the dir so every run starts from a clean seed.
const pgCtl = path.resolve(
  "node_modules/@embedded-postgres",
  `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`,
  "native/bin",
  process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl",
);
if (fs.existsSync(path.join(dir, "postmaster.pid"))) {
  try {
    execSync(`"${pgCtl}" -D "${dir}" stop -m immediate`, { stdio: "ignore" });
  } catch {
    /* not running */
  }
}
for (let i = 0; i < 5; i++) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: PORT, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"] });

const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("utu_e2e");
  execSync("npx prisma db push --skip-generate --accept-data-loss", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
  http.createServer((_, res) => res.end("ok")).listen(READY_PORT, () => console.log(`[e2e-db] ready on ${url}`));
}

const stop = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

main().catch(async (e) => {
  console.error("[e2e-db] failed", e);
  await pg.stop().catch(() => {});
  process.exit(1);
});
