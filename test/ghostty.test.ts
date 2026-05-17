import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { applyGhosttyPatch, planGhosttyPatch } from "../src/ghostty.js";

describe("ghostty patching", () => {
  it("adds one include idempotently", () => {
    const dir = join(tmpdir(), `nsh-ghostty-${Date.now()}`);
    process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT = join(dir, "managed");
    mkdirSync(dir, { recursive: true });
    const config = join(dir, "config");
    writeFileSync(config, "font-size = 14\n", "utf8");

    const first = planGhosttyPatch([config], ["keybind = cmd+t=text:\\x02t"]);
    expect(first.some((change) => change.after?.includes("config-file = "))).toBe(true);

    applyGhosttyPatch([config], ["keybind = cmd+t=text:\\x02t"], false);
    applyGhosttyPatch([config], ["keybind = cmd+t=text:\\x02t"], false);
    const content = readFileSync(config, "utf8");
    expect(content.match(/config-file = .*ghostty\.conf/g)?.length).toBe(1);
    delete process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT;
    rmSync(dir, { recursive: true, force: true });
  });
});
