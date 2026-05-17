import pc from "picocolors";
import type { Change } from "./types.js";

export function printHuman(title: string, changes: Change[], warnings: string[]): void {
  console.error(pc.bold(title));
  for (const warning of warnings) {
    console.error(`${pc.yellow("warn")} ${warning}`);
  }
  for (const change of changes) {
    const marker = change.kind === "noop" ? pc.dim("-") : change.kind === "warn" ? pc.yellow("!") : pc.green("+");
    console.error(`${marker} ${change.message} ${pc.dim(change.path)}`);
  }
}

export function jsonOk(result: unknown): void {
  process.stdout.write(`${JSON.stringify({ ok: true, result, error: null, schema_version: "v1" }, null, 2)}\n`);
}

export function jsonError(code: string, message: string, retryable = false): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: false,
        result: null,
        error: { class: "error", code, message, retryable },
        schema_version: "v1"
      },
      null,
      2
    )}\n`
  );
}

export function formatDiff(changes: Change[]): string {
  return changes
    .map((change) => {
      if (!change.before && !change.after) return `# ${change.kind}: ${change.message}\n# ${change.path}\n`;
      return [
        `# ${change.kind}: ${change.message}`,
        `# ${change.path}`,
        "--- before",
        change.before ?? "",
        "+++ after",
        change.after ?? ""
      ].join("\n");
    })
    .join("\n\n");
}
