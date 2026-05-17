import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import {
  backupFile,
  configRoot,
  diffChange,
  ensureDir,
  homePath,
  readText,
  removeFile,
  runOptional,
  sortedUnique,
  writeText
} from "./fs-utils.js";
import type { Change } from "./types.js";

const sidecarName = "ghostty.conf";

export function ghosttySidecarPath(): string {
  return join(configRoot(), sidecarName);
}

export function discoverGhosttyConfigs(explicit: string[] | undefined): string[] {
  if (explicit?.length) return sortedUnique(explicit.map(expandHome));

  const candidates = [
    homePath(".config", "ghostty", "config"),
    homePath(".config", "ghostty", "config.ghostty"),
    homePath("Library", "Application Support", "com.mitchellh.ghostty", "config"),
    homePath("Library", "Application Support", "com.mitchellh.ghostty", "config.ghostty"),
    homePath("Library", "Application Support", "com.cmuxterm.app", "config.ghostty")
  ];
  const existing = candidates.filter((path) => existsSync(path));
  return sortedUnique(existing.length ? existing : [homePath(".config", "ghostty", "config")]);
}

export function planGhosttyPatch(configPaths: string[], lines: string[]): Change[] {
  const sidecarPath = ghosttySidecarPath();
  const sidecarContent = `${lines.join("\n").trimEnd()}\n`;
  const changes = [diffChange(sidecarPath, existsSync(sidecarPath) ? readText(sidecarPath) : "", sidecarContent, "write ghostty sidecar")];

  for (const configPath of configPaths) {
    const before = existsSync(configPath) ? readText(configPath) : "";
    const after = ensureInclude(before, sidecarPath);
    changes.push(diffChange(configPath, before, after, "link ghostty sidecar"));
  }

  return changes;
}

export function applyGhosttyPatch(configPaths: string[], lines: string[], dryRun: boolean): Change[] {
  const changes = planGhosttyPatch(configPaths, lines);
  if (dryRun) return changes;

  ensureDir(configRoot());
  for (const change of changes) {
    if (change.kind === "noop" || change.kind === "warn") continue;
    backupFile(change.path, `ghostty-${basename(change.path)}`);
    writeText(change.path, change.after ?? "");
  }
  return changes;
}

export function planGhosttyRevert(configPaths: string[]): Change[] {
  const sidecarPath = ghosttySidecarPath();
  const changes: Change[] = [];

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    const before = readText(configPath);
    const after = removeInclude(before, sidecarPath);
    changes.push(diffChange(configPath, before, after, "unlink ghostty sidecar"));
  }

  if (existsSync(sidecarPath)) {
    changes.push({ path: sidecarPath, kind: "delete", message: "remove ghostty sidecar", before: readText(sidecarPath), after: "" });
  }

  return changes;
}

export function applyGhosttyRevert(configPaths: string[], dryRun: boolean): Change[] {
  const changes = planGhosttyRevert(configPaths);
  if (dryRun) return changes;

  for (const change of changes) {
    if (change.kind === "noop" || change.kind === "warn") continue;
    backupFile(change.path, `ghostty-revert-${basename(change.path)}`);
    if (change.kind === "delete") {
      removeFile(change.path);
    } else {
      writeText(change.path, change.after ?? "");
    }
  }
  return changes;
}

export function validateGhosttyConfigs(configPaths: string[]): string[] {
  const binary = findGhosttyBinary();
  if (!binary) return ["ghostty binary not found; skipped ghostty validation"];

  const warnings: string[] = [];
  for (const configPath of configPaths) {
    const result = runOptional(binary, ["+validate-config", `--config-file=${configPath}`]);
    if (!result.ok) {
      warnings.push(`ghostty validation failed for ${configPath}: ${result.stderr || result.stdout || "unknown error"}`);
    }
  }
  return warnings;
}

export function reloadGhosttyIfRunning(): void {
  if (process.platform !== "darwin") return;
  const script = [
    'tell application "System Events"',
    '  set appNames to {"Ghostty", "cmux"}',
    "  repeat with appName in appNames",
    "    if exists process appName then",
    "      tell application appName to activate",
    "      delay 0.1",
    '      keystroke "," using {command down, shift down}',
    "    end if",
    "  end repeat",
    "end tell"
  ].join("\n");
  runOptional("osascript", ["-e", script]);
}

function findGhosttyBinary(): string | null {
  const candidates = [
    "/Applications/Ghostty.app/Contents/MacOS/ghostty",
    "/Applications/cmux.app/Contents/Resources/bin/ghostty",
    "ghostty"
  ];
  for (const candidate of candidates) {
    if (candidate.includes("/") && !existsSync(candidate)) continue;
    const result = runOptional(candidate, ["--version"]);
    if (result.ok) return candidate;
  }
  return null;
}

function ensureInclude(content: string, sidecarPath: string): string {
  const includeLine = `config-file = ${sidecarPath}`;
  const lines = content.split(/\r?\n/);
  if (lines.some((line) => line.trim() === includeLine || line.includes(sidecarPath))) {
    return normalizeFinalNewline(content);
  }
  const next = content.trimEnd() ? `${content.trimEnd()}\n\n${includeLine}\n` : `${includeLine}\n`;
  return next;
}

function removeInclude(content: string, sidecarPath: string): string {
  const lines = content.split(/\r?\n/).filter((line) => !line.includes(sidecarPath));
  return normalizeFinalNewline(lines.join("\n").replace(/\n{3,}/g, "\n\n"));
}

function normalizeFinalNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function expandHome(path: string): string {
  if (path === "~") return homePath();
  if (path.startsWith("~/")) return homePath(path.slice(2));
  return path;
}
