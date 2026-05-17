import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  backupFile,
  diffChange,
  ensureDir,
  homePath,
  readText,
  runOptional,
  sha256,
  writeText
} from "./fs-utils.js";
import type { Change } from "./types.js";

export const minimumHerdrVersion = "0.5.10";

const herdrConfigPath = homePath(".config", "herdr", "config.toml");

export function discoverHerdrConfig(): string {
  return process.env.HERDR_CONFIG_PATH || herdrConfigPath;
}

export function detectHerdr(): { path: string | null; version: string | null; ok: boolean } {
  const candidates = [homePath(".local", "bin", "herdr"), "herdr"];
  for (const candidate of candidates) {
    if (candidate.includes("/") && !existsSync(candidate)) continue;
    const result = runOptional(candidate, ["--version"]);
    if (!result.ok) continue;
    const version = result.stdout.trim().match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
    return { path: candidate, version, ok: version ? compareVersions(version, minimumHerdrVersion) >= 0 : false };
  }
  return { path: null, version: null, ok: false };
}

export function planHerdrPatch(values: Record<string, string | boolean>, configPath = discoverHerdrConfig()): {
  changes: Change[];
  previousValues: Record<string, string | null>;
} {
  const before = existsSync(configPath) ? readText(configPath) : "";
  const previousValues: Record<string, string | null> = {};
  let after = before;

  for (const [path, value] of Object.entries(values)) {
    previousValues[path] = readTomlValue(after, path);
    after = upsertTomlValue(after, path, value);
  }

  return {
    changes: [diffChange(configPath, before, after, "write herdr keymap")],
    previousValues
  };
}

export function applyHerdrPatch(values: Record<string, string | boolean>, dryRun: boolean, configPath = discoverHerdrConfig()): {
  changes: Change[];
  previousValues: Record<string, string | null>;
} {
  const plan = planHerdrPatch(values, configPath);
  if (!dryRun) {
    for (const change of plan.changes) {
      if (change.kind === "noop" || change.kind === "warn") continue;
      backupFile(change.path, `herdr-${basename(change.path)}`);
      ensureDir(dirname(change.path));
      writeText(change.path, change.after ?? "");
    }
  }
  return plan;
}

export function planHerdrRevert(previousValues: Record<string, string | null>, configPath = discoverHerdrConfig()): Change[] {
  if (!existsSync(configPath)) return [];
  const before = readText(configPath);
  let after = before;
  for (const [path, value] of Object.entries(previousValues)) {
    after = value === null ? removeTomlValue(after, path) : upsertTomlRawValue(after, path, value);
  }
  return [diffChange(configPath, before, after, "restore herdr keymap")];
}

export function applyHerdrRevert(previousValues: Record<string, string | null>, dryRun: boolean, configPath = discoverHerdrConfig()): Change[] {
  const changes = planHerdrRevert(previousValues, configPath);
  if (!dryRun) {
    for (const change of changes) {
      if (change.kind === "noop" || change.kind === "warn") continue;
      backupFile(change.path, `herdr-revert-${basename(change.path)}`);
      writeText(change.path, change.after ?? "");
    }
  }
  return changes;
}

export function reloadHerdr(): string | null {
  const herdr = detectHerdr();
  if (!herdr.path) return "herdr binary not found; skipped reload";
  const result = runOptional(herdr.path, ["server", "reload-config"]);
  if (!result.ok) {
    const detail = `${result.stderr}\n${result.stdout}`.trim();
    if (/connection refused/i.test(detail)) {
      return "herdr server not running; restart herdr to apply config";
    }
    return detail || "herdr server not running; restart herdr to apply config";
  }
  return null;
}

export async function installOrUpdateHerdr(): Promise<string> {
  const arch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x86_64" : null;
  const os = process.platform === "darwin" ? "macos" : process.platform === "linux" ? "linux" : null;
  if (!arch || !os) {
    throw new Error(`unsupported platform for automatic herdr install: ${process.platform}/${process.arch}`);
  }

  const release = (await fetchJson("https://api.github.com/repos/ogulcancelik/herdr/releases/latest")) as {
    tag_name: string;
    assets: Array<{ name: string; browser_download_url: string; digest?: string }>;
  };
  const assetName = `herdr-${os}-${arch}`;
  const asset = release.assets.find((candidate) => candidate.name === assetName);
  if (!asset) throw new Error(`could not find herdr release asset ${assetName}`);

  const response = await fetch(asset.browser_download_url);
  if (!response.ok) throw new Error(`failed to download ${asset.browser_download_url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (asset.digest?.startsWith("sha256:")) {
    const expected = asset.digest.slice("sha256:".length);
    const actual = sha256(buffer);
    if (actual !== expected) throw new Error(`herdr checksum mismatch: expected ${expected}, got ${actual}`);
  }

  const target = homePath(".local", "bin", "herdr");
  ensureDir(dirname(target));
  writeFileSync(target, buffer);
  chmodSync(target, 0o755);
  return `${target} (${release.tag_name})`;
}

function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readTomlValue(content: string, path: string): string | null {
  const { section, key } = splitTomlPath(path);
  const range = findSectionRange(content, section);
  if (!range) return null;
  for (let index = range.start + 1; index < range.end; index += 1) {
    const line = range.lines[index];
    const match = line.match(/^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/);
    if (match?.[2] === key) return match[4].trim();
  }
  return null;
}

function upsertTomlValue(content: string, path: string, value: string | boolean): string {
  return upsertTomlRawValue(content, path, tomlLiteral(value));
}

function upsertTomlRawValue(content: string, path: string, rawValue: string): string {
  const { section, key } = splitTomlPath(path);
  const base = content.trimEnd() ? `${content.trimEnd()}\n` : "";
  const range = findSectionRange(base, section);
  const assignment = `${key} = ${rawValue}`;

  if (!range) {
    return `${base}\n[${section}]\n${assignment}\n`.replace(/^\n/, "");
  }

  const lines = [...range.lines];
  for (let index = range.start + 1; index < range.end; index += 1) {
    const match = lines[index].match(/^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/);
    if (match?.[2] === key) {
      lines[index] = `${match[1]}${key}${match[3]}${rawValue}`;
      return `${lines.join("\n").trimEnd()}\n`;
    }
  }

  const insertAt = lines[range.end - 1] === "" ? range.end - 1 : range.end;
  lines.splice(insertAt, 0, assignment);
  return `${lines.join("\n").trimEnd()}\n`;
}

function removeTomlValue(content: string, path: string): string {
  const { section, key } = splitTomlPath(path);
  const range = findSectionRange(content, section);
  if (!range) return content.endsWith("\n") ? content : `${content}\n`;
  const lines = range.lines.filter((line, index) => {
    if (index <= range.start || index >= range.end) return true;
    const match = line.match(/^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/);
    return match?.[2] !== key;
  });
  return `${lines.join("\n").trimEnd()}\n`;
}

function findSectionRange(content: string, section: string): { lines: string[]; start: number; end: number } | null {
  const lines = content.split(/\r?\n/);
  const header = `[${section}]`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { lines, start, end };
}

function splitTomlPath(path: string): { section: string; key: string } {
  const parts = path.split(".");
  if (parts.length < 2) throw new Error(`invalid toml path ${path}`);
  return { section: parts.slice(0, -1).join("."), key: parts[parts.length - 1] };
}

function tomlLiteral(value: string | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { "user-agent": "native-shortcuts-herd" } });
  if (!response.ok) throw new Error(`failed to fetch ${url}: ${response.status}`);
  return response.json();
}
