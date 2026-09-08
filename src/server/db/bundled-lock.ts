import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Exclusive ownership of the bundled database's data directory.
 *
 * PGlite is a single-writer engine: two processes opening the same directory
 * will corrupt it. That is easy to do by accident here — running `npm run
 * db:seed` while `npm run dev` is up is the obvious way — and the failure is
 * silent at the time and catastrophic later.
 *
 * PostgreSQL's own `postmaster.pid` cannot be used to detect this, because
 * PGlite runs inside a WebAssembly sandbox and writes a synthetic process id
 * (`-42`) that corresponds to nothing on the host. So this module keeps a lock
 * of its own containing the real operating-system pid.
 *
 * The behaviour that matters:
 *
 *   · Another live process holds the directory  → refuse, and say which pid.
 *   · The lock belongs to a process that is gone → it is a relic of a crash or
 *     a force-quit; clear it and carry on. This is the common case, and the
 *     alternative is a developer having to delete a directory by hand every
 *     time they close a terminal on a running server.
 */

const LOCK_FILE = ".almirah-owner";

export class DatabaseBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseBusyError";
  }
}

/**
 * Raised when a `next build` worker finds the directory already claimed by a
 * sibling worker. Not an error condition — the caller responds by working from
 * a private copy.
 */
export class BuildWorkerContention extends Error {
  constructor() {
    super("The bundled database is in use by another build worker.");
    this.name = "BuildWorkerContention";
  }
}

/**
 * Produces a private, throwaway copy of the data directory for one build
 * worker, and returns its path.
 *
 * Only ever used during `next build`. The copy is read by that worker and
 * discarded with the temporary directory; the real data directory is never
 * opened by more than one process, which is the invariant that matters.
 */
export async function cloneForBuildWorker(dataDir: string): Promise<string> {
  const { cp, mkdtemp } = await import("node:fs/promises");
  const os = await import("node:os");

  const target = await mkdtemp(path.join(os.tmpdir(), "almirah-build-"));
  await cp(dataDir, target, { recursive: true });

  // The copy carries the original's lock files, which would make it look busy.
  await rm(path.join(target, LOCK_FILE), { force: true }).catch(() => {});
  await rm(path.join(target, "postmaster.pid"), { force: true }).catch(() => {});

  return target;
}

function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 performs the permission and existence check without delivering
    // anything. Works on Windows as well as POSIX.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user — still alive.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Claims the data directory for this process.
 *
 * Throws `DatabaseBusyError` if another live process already holds it.
 */
export async function acquireBundledLock(dataDir: string): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const lockPath = path.join(dataDir, LOCK_FILE);

  try {
    const existing = await readFile(lockPath, "utf8");
    const pid = Number.parseInt(existing.trim(), 10);

    if (Number.isFinite(pid) && pid !== process.pid && isProcessAlive(pid)) {
      // `next build` fans page-data collection out across several worker
      // processes, all of which may want to read the catalogue at once. They
      // only read, and the build is throwaway, so each takes its own private
      // copy rather than queueing — or failing, which is what would otherwise
      // happen and would make the project unbuildable without a real server.
      if (process.env.NEXT_PHASE === "phase-production-build") {
        throw new BuildWorkerContention();
      }

      throw new DatabaseBusyError(
        `The bundled database at "${dataDir}" is already in use by process ${pid}.\n\n` +
          `Only one process may use it at a time. Stop the dev server before running ` +
          `\`npm run db:seed\`, \`npm run db:reset\` or the database-backed tests — or set ` +
          `DATABASE_URL to a real PostgreSQL server, which has no such restriction.`,
      );
    }
  } catch (error) {
    if (error instanceof DatabaseBusyError || error instanceof BuildWorkerContention) throw error;
    // No lock file, or an unreadable one. Either way it is ours to take.
  }

  // PGlite refuses to start if PostgreSQL's own lock file is present. Having
  // established that no live process owns the directory, this one is stale.
  await rm(path.join(dataDir, "postmaster.pid"), { force: true }).catch(() => {});

  await writeFile(lockPath, String(process.pid), "utf8");

  // Best effort: a clean exit leaves no lock behind, so the next start has
  // nothing to reason about.
  const release = () => {
    try {
      // Synchronous, because async work in an exit handler does not run.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- exit handlers cannot await
      require("node:fs").rmSync(lockPath, { force: true });
    } catch {
      /* the next start will treat it as stale */
    }
  };

  process.once("exit", release);
  process.once("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    release();
    process.exit(143);
  });
}
