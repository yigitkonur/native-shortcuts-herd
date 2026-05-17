import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, platform } from "node:os";
import type { Change } from "./types.js";

export const appName = "native-shortcuts-herd";

export function homePath(...parts: string[]): string {
  return join(homedir(), ...parts);
}

export function configRoot(): string {
  if (process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT) {
    return process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT;
  }
  return homePath(".config", appName);
}

export function statePath(): string {
  return join(configRoot(), "state.json");
}

export function backupRoot(): string {
  return join(configRoot(), "backups");
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function writeText(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content, "utf8");
}

export function removeFile(path: string): void {
  if (existsSync(path)) rmSync(path);
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function backupFile(path: string, label: string): string | null {
  if (!existsSync(path)) return null;
  const target = join(backupRoot(), `${label}-${timestamp()}.bak`);
  ensureDir(dirname(target));
  copyFileSync(path, target);
  return target;
}

export function runOptional(command: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    const detail = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      ok: false,
      stdout: bufferToString(detail.stdout),
      stderr: bufferToString(detail.stderr)
    };
  }
}

export function bufferToString(value: Buffer | string | undefined): string {
  if (!value) return "";
  return Buffer.isBuffer(value) ? value.toString("utf8") : value;
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function isMac(): boolean {
  return platform() === "darwin";
}

export function diffChange(path: string, before: string, after: string, message: string): Change {
  if (before === after) {
    return { path, kind: "noop", message: `${message}: already current` };
  }
  return { path, kind: before ? "update" : "create", before, after, message };
}

export function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
