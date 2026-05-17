import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { applyConfig, revertConfig } from "../src/installer.js";
import { choicesFromOptions } from "../src/profiles.js";
import { ghosttySidecarPath } from "../src/ghostty.js";
import { statePath } from "../src/fs-utils.js";

describe("installer lifecycle", () => {
  it("supports non-interactive install and uninstall", async () => {
    const dir = join(tmpdir(), `nsh-installer-${Date.now()}`);
    try {
      process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT = join(dir, "managed");
      mkdirSync(dir, { recursive: true });
      const config = join(dir, "ghostty", "config");
      mkdirSync(join(dir, "ghostty"), { recursive: true });
      writeFileSync(config, "font-size = 14\n", "utf8");

      await applyConfig({
        choices: choicesFromOptions({ profile: "chrome-spaces", glassTheme: true }),
        dryRun: false,
        yes: true,
        ghosttyConfigPaths: [config],
        skipHerdr: true,
        noReload: true
      });

      expect(existsSync(ghosttySidecarPath())).toBe(true);
      expect(existsSync(statePath())).toBe(true);
      expect(readFileSync(config, "utf8")).toContain("config-file = ");

      revertConfig(false);

      expect(existsSync(ghosttySidecarPath())).toBe(false);
      expect(existsSync(statePath())).toBe(false);
      expect(readFileSync(config, "utf8")).not.toContain("config-file = ");
    } finally {
      delete process.env.NATIVE_SHORTCUTS_HERD_CONFIG_ROOT;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
