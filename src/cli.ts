#!/usr/bin/env node
import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { choicesFromOptions, getProfile, profiles, targetFrom } from "./profiles.js";
import { applyConfig, diffConfig, diffRevert, doctor, revertConfig } from "./installer.js";
import { formatDiff, jsonError, jsonOk, printHuman } from "./format.js";
import { detectHerdr, minimumHerdrVersion } from "./herdr.js";
import type { Change, ShortcutChoices } from "./types.js";

const program = new Command();

program
  .name("native-shortcuts-herd")
  .description("make ghostty + herdr navigation feel native to macos")
  .version("0.1.4");

addSharedOptions(program.command("install").option("--uninstall", "remove managed changes instead of installing"))
  .description("run the guided installer")
  .action(async (options) => {
    await run(async () => {
      if (options.uninstall) {
        const result = options.dryRun ? diffRevert() : revertConfig(Boolean(options.dryRun));
        outputResult("uninstalled native shortcuts", result, options);
        return;
      }
      const wizard = await promptForInstall(options);
      const choices = await promptForChoices(options);
      if (wizard.installHerdr !== undefined) options.installHerdr = wizard.installHerdr;
      const result = await applyConfig(toApplyRequest(choices, options));
      outputResult("installed native shortcuts", result, options);
    }, options);
  });

program
  .command("uninstall")
  .alias("remove")
  .description("remove managed ghostty/herdr changes")
  .option("--dry-run", "preview the uninstall without writing")
  .option("--yes", "run without prompts")
  .option("--json", "print machine-readable json")
  .action(async (options) => {
    await run(async () => {
      const result = options.dryRun ? diffRevert() : revertConfig(Boolean(options.dryRun));
      outputResult("uninstalled native shortcuts", result, options);
    }, options);
  });

addSharedOptions(program.command("apply"))
  .description("apply a profile non-interactively")
  .action(async (options) => {
    await run(async () => {
      const choices = choicesFromOptions(options);
      const result = await applyConfig(toApplyRequest(choices, options));
      outputResult("applied native shortcuts", result, options);
    }, options);
  });

addSharedOptions(program.command("diff"))
  .description("show the config changes without writing")
  .action(async (options) => {
    await run(async () => {
      const choices = choicesFromOptions(options);
      const result = diffConfig(choices, options.ghosttyConfig);
      if (options.json) jsonOk(result);
      else process.stdout.write(formatDiff(result.changes));
    }, options);
  });

program
  .command("revert")
  .description("remove managed ghostty/herdr changes")
  .option("--dry-run", "preview the revert without writing")
  .option("--json", "print machine-readable json")
  .action(async (options) => {
    await run(async () => {
      const result = options.dryRun ? diffRevert() : revertConfig(Boolean(options.dryRun));
      outputResult("reverted native shortcuts", result, options);
    }, options);
  });

program
  .command("doctor")
  .description("inspect ghostty, herdr, and managed state")
  .option("--json", "print machine-readable json")
  .action(async (options) => {
    await run(async () => {
      const report = doctor();
      if (options.json) jsonOk(report);
      else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }, options);
  });

program
  .command("profiles")
  .description("list built-in shortcut profiles")
  .option("--json", "print machine-readable json")
  .action(async (options) => {
    await run(async () => {
      if (options.json) jsonOk({ profiles });
      else {
        for (const profile of profiles) {
          console.log(`${pc.bold(profile.id)} ${pc.dim(profile.description)}`);
        }
      }
    }, options);
  });

program
  .command("generate-installer")
  .description("print a standalone installer script")
  .option("--json", "print machine-readable json")
  .action(async (options) => {
    await run(async () => {
      const script = [
        "#!/usr/bin/env sh",
        "set -eu",
        "command -v npm >/dev/null 2>&1 || { echo 'npm is required' >&2; exit 127; }",
        "npx --yes native-shortcuts-herd install --yes \"$@\""
      ].join("\n");
      if (options.json) jsonOk({ script });
      else process.stdout.write(`${script}\n`);
    }, options);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(message));
  process.exitCode = 1;
});

function addSharedOptions(command: Command): Command {
  return command
    .option("--profile <id>", "profile: chrome-spaces, chrome-tabs, minimal", "chrome-spaces")
    .option("--cmd-numbers <target>", "cmd+1..9 target: workspaces, tabs, off")
    .option("--ctrl-tab <target>", "ctrl+tab target: workspaces, tabs, off")
    .option("--ctrl-opt-tab <target>", "ctrl+option+tab target: workspaces, tabs, off")
    .option("--prompt-new-tab-name", "keep herdr's new-tab rename prompt")
    .option("--glass-theme", "apply the purple liquid glass ghostty preset")
    .option("--no-glass-theme", "do not apply the purple liquid glass ghostty preset")
    .option("--ghostty-config <path...>", "specific ghostty config path(s)")
    .option("--ghostty-key <trigger=action...>", "extra managed ghostty keybind", collect, [])
    .option("--herdr-key <action=key...>", "extra managed herdr [keys] binding", collect, [])
    .option("--skip-ghostty", "do not patch ghostty")
    .option("--skip-herdr", "do not patch herdr")
    .option("--install-herdr", "install/update herdr if missing or outdated without prompting")
    .option("--no-install-herdr", "never install/update herdr")
    .option("--skip-herdr-install", "do not offer automatic herdr install/update")
    .option("--no-reload", "write config but skip live reload attempts")
    .option("--dry-run", "preview without writing")
    .option("--yes", "accept safe defaults and allow herdr install/update")
    .option("--json", "print machine-readable json");
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

async function promptForChoices(options: Record<string, unknown>): Promise<ShortcutChoices> {
  if (options.yes || !process.stdin.isTTY) return choicesFromOptions(options);
  const base = getProfile(String(options.profile ?? "chrome-spaces"));
  const answers = await prompts(
    [
      {
        type: "select",
        name: "profile",
        message: "choose a base shortcut feel",
        initial: profiles.findIndex((profile) => profile.id === base.id),
        choices: profiles.map((profile) => ({
          title: profile.name,
          value: profile.id,
          description: profile.description
        }))
      },
      {
        type: "select",
        name: "cmdNumbers",
        message: "what should cmd+1..9 jump to?",
        initial: 0,
        choices: targetChoices()
      },
      {
        type: "select",
        name: "ctrlTab",
        message: "what should ctrl+tab cycle?",
        initial: 0,
        choices: targetChoices()
      },
      {
        type: "select",
        name: "ctrlOptTab",
        message: "what should ctrl+option+tab cycle?",
        initial: 1,
        choices: targetChoices()
      },
      {
        type: "confirm",
        name: "promptNewTabName",
        message: "keep herdr's rename prompt when creating new tabs?",
        initial: false
      },
      {
        type: "confirm",
        name: "glassTheme",
        message: "apply a purple liquid glass ghostty theme?",
        initial: false
      }
    ],
    { onCancel: () => process.exit(130) }
  );

  const selected = getProfile(answers.profile);
  return {
    ...choicesFromOptions(options),
    profile: selected.id,
    cmdNumbers: targetFrom(answers.cmdNumbers, selected.cmdNumbers),
    ctrlTab: targetFrom(answers.ctrlTab, selected.ctrlTab),
    ctrlOptTab: targetFrom(answers.ctrlOptTab, selected.ctrlOptTab),
    promptNewTabName: Boolean(answers.promptNewTabName),
    applyGlassTheme: Boolean(answers.glassTheme)
  };
}

async function promptForInstall(options: Record<string, unknown>): Promise<{ installHerdr?: boolean }> {
  if (options.installHerdr === true) return { installHerdr: true };
  if (options.installHerdr === false || options.skipHerdrInstall) {
    return { installHerdr: false };
  }
  if (options.yes || options.dryRun || options.skipHerdr || !process.stdin.isTTY) return {};

  const herdr = detectHerdr();
  if (herdr.ok) return { installHerdr: false };

  const message = herdr.path
    ? `herdr ${herdr.version ?? "unknown"} is installed; update to ${minimumHerdrVersion}+ now?`
    : "herdr is not installed; install it now?";
  const detail = herdr.path
    ? "downloads the latest herdr release into ~/.local/bin/herdr"
    : "downloads herdr into ~/.local/bin/herdr so the shortcuts have a target";

  const answer = await prompts(
    {
      type: "confirm",
      name: "installHerdr",
      message,
      initial: true,
      hint: detail
    },
    { onCancel: () => process.exit(130) }
  );

  return { installHerdr: Boolean(answer.installHerdr) };
}

function targetChoices(): Array<{ title: string; value: string; description: string }> {
  return [
    { title: "spaces", value: "workspaces", description: "herdr workspaces / spaces" },
    { title: "tabs", value: "tabs", description: "herdr tabs inside the current space" },
    { title: "off", value: "off", description: "leave this shortcut family unmanaged" }
  ];
}

function toApplyRequest(choices: ShortcutChoices, options: Record<string, unknown>) {
  return {
    choices,
    dryRun: Boolean(options.dryRun),
    yes: Boolean(options.yes),
    installHerdr: Boolean(options.installHerdr),
    ghosttyConfigPaths: options.ghosttyConfig as string[] | undefined,
    skipGhostty: Boolean(options.skipGhostty),
    skipHerdr: Boolean(options.skipHerdr),
    skipHerdrInstall: Boolean(options.skipHerdrInstall || options.installHerdr === false),
    noReload: options.reload === false
  };
}

async function run(task: () => Promise<void>, options: { json?: boolean }): Promise<void> {
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) jsonError("COMMAND_FAILED", message, false);
    else console.error(pc.red(message));
    process.exitCode = 1;
  }
}

function outputResult(title: string, result: { changes: Change[]; warnings: string[] }, options: { json?: boolean }): void {
  if (options.json) jsonOk(result);
  else printHuman(title, result.changes, result.warnings);
}
