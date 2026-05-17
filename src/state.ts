import { existsSync } from "node:fs";
import { removeFile, statePath, readText, writeText } from "./fs-utils.js";
import type { ManagedState } from "./types.js";

export function readState(): ManagedState | null {
  const path = statePath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readText(path)) as ManagedState;
    if (parsed.schemaVersion === 1) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function writeState(state: ManagedState): void {
  writeText(statePath(), `${JSON.stringify(state, null, 2)}\n`);
}

export function deleteState(): void {
  removeFile(statePath());
}
