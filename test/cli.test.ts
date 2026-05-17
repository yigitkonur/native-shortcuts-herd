import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

describe("cli install flags", () => {
  it("applies and uninstalls without interactive prompts", () => {
    const dir = join(tmpdir(), `nsh-cli-${Date.now()}`);
    const managed = join(dir, "managed");
    const herdrConfig = join(dir, "herdr", "config.toml");
    const ghosttyConfig = join(dir, "ghostty", "config");
    const env = {
      ...process.env,
      NATIVE_SHORTCUTS_HERD_CONFIG_ROOT: managed,
      HERDR_CONFIG_PATH: herdrConfig
    };

    try {
      mkdirSync(join(dir, "ghostty"), { recursive: true });
      writeFileSync(ghosttyConfig, "font-size = 14\n", "utf8");

      const installed = runCli(
        [
          "apply",
          "--profile",
          "chrome-spaces",
          "--glass-theme",
          "--ghostty-config",
          ghosttyConfig,
          "--yes",
          "--skip-herdr",
          "--no-reload",
          "--json"
        ],
        env
      );

      expect(installed.ok).toBe(true);
      expect(existsSync(join(managed, "ghostty.conf"))).toBe(true);
      expect(existsSync(join(managed, "state.json"))).toBe(true);
      expect(readFileSync(ghosttyConfig, "utf8")).toContain("config-file = ");

      const installUninstall = runCli(["install", "--uninstall", "--yes", "--json"], env);
      expect(installUninstall.ok).toBe(true);
      expect(existsSync(join(managed, "ghostty.conf"))).toBe(false);
      expect(existsSync(join(managed, "state.json"))).toBe(false);
      expect(readFileSync(ghosttyConfig, "utf8")).not.toContain("config-file = ");

      runCli(
        [
          "apply",
          "--profile",
          "chrome-spaces",
          "--ghostty-config",
          ghosttyConfig,
          "--yes",
          "--skip-herdr",
          "--no-reload",
          "--json"
        ],
        env
      );

      const uninstalled = runCli(["uninstall", "--yes", "--json"], env);
      expect(uninstalled.ok).toBe(true);
      expect(existsSync(join(managed, "ghostty.conf"))).toBe(false);
      expect(existsSync(join(managed, "state.json"))).toBe(false);
      expect(readFileSync(ghosttyConfig, "utf8")).not.toContain("config-file = ");

      const dryRunHome = join(dir, "home");
      const dryRun = runCli(["install", "--yes", "--skip-ghostty", "--no-reload", "--dry-run", "--json"], {
        ...env,
        HOME: dryRunHome,
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin`
      });
      const dryRunJson = JSON.stringify(dryRun.result);
      expect(dryRun.ok).toBe(true);
      expect(dryRunJson).toContain("would install/update herdr");
      expect(dryRunJson).not.toContain("or use --yes");

      const skipped = runCli(
        ["install", "--yes", "--no-install-herdr", "--skip-ghostty", "--no-reload", "--dry-run", "--json"],
        {
          ...env,
          HOME: dryRunHome,
          PATH: `${dirname(process.execPath)}:/usr/bin:/bin`
        }
      );
      const skippedJson = JSON.stringify(skipped.result);
      expect(skipped.ok).toBe(true);
      expect(skippedJson).toContain("skipped herdr install by request");
      expect(skippedJson).not.toContain("or use --yes");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function runCli(args: string[], env: NodeJS.ProcessEnv): { ok: boolean; result: unknown; error: unknown } {
  const tsx = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const stdout = execFileSync(tsx, [join(process.cwd(), "src", "cli.ts"), ...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(stdout) as { ok: boolean; result: unknown; error: unknown };
}
