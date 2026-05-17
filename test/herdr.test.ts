import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { applyHerdrPatch, applyHerdrRevert } from "../src/herdr.js";

describe("herdr patching", () => {
  it("updates sections while preserving unrelated values", () => {
    const dir = join(tmpdir(), `nsh-herdr-${Date.now()}`);
    process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT = join(dir, "managed");
    mkdirSync(dir, { recursive: true });
    const config = join(dir, "config.toml");
    writeFileSync(config, '[theme]\nname = "gruvbox"\n\n[keys]\nnew_tab = "c"\n', "utf8");

    const patch = applyHerdrPatch(
      {
        "keys.new_tab": "t",
        "keys.next_tab": "ctrl+tab",
        "keys.indexed.tabs": "alt",
        "ui.prompt_new_tab_name": false
      },
      false,
      config
    );
    const content = readFileSync(config, "utf8");
    expect(content).toContain('name = "gruvbox"');
    expect(content).toContain('new_tab = "t"');
    expect(content).toContain("[keys.indexed]");
    expect(content).toContain("prompt_new_tab_name = false");

    applyHerdrRevert(patch.previousValues, false, config);
    const reverted = readFileSync(config, "utf8");
    expect(reverted).toContain('new_tab = "c"');
    expect(reverted).not.toContain("next_tab");
    delete process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT;
    rmSync(dir, { recursive: true, force: true });
  });
});
