import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Make sure the throwaway Postgres is stopped even if the webServer process was killed
// without running its own shutdown handler (Windows does this).
export default async function globalTeardown() {
  const dir = path.resolve(".e2e-db");
  if (!fs.existsSync(path.join(dir, "postmaster.pid"))) return;
  const bin = path.resolve(
    "node_modules/@embedded-postgres",
    `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`,
    "native/bin",
    process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl",
  );
  try {
    execSync(`"${bin}" -D "${dir}" stop -m fast`, { stdio: "ignore", timeout: 20_000 });
  } catch {
    /* already stopped */
  }
}
