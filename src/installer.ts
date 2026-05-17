import { existsSync } from "node:fs";
import { generateConfig } from "./profiles.js";
import {
  applyGhosttyPatch,
  applyGhosttyRevert,
  discoverGhosttyConfigs,
  ghosttySidecarPath,
  planGhosttyPatch,
  planGhosttyRevert,
  reloadGhosttyIfRunning,
  validateGhosttyConfigs
} from "./ghostty.js";
import {
  applyHerdrPatch,
  applyHerdrRevert,
  detectHerdr,
  discoverHerdrConfig,
  installOrUpdateHerdr,
  minimumHerdrVersion,
  planHerdrPatch,
  planHerdrRevert,
  reloadHerdr
} from "./herdr.js";
import { deleteState, readState, writeState } from "./state.js";
import type { ApplyRequest, Change, CommandResult, ManagedState, ShortcutChoices } from "./types.js";

const packageVersion = "0.1.4";

export async function applyConfig(request: ApplyRequest): Promise<CommandResult> {
  const generated = generateConfig(request.choices);
  const warnings: string[] = [];
  const changes: Change[] = [];
  const ghosttyConfigPaths = discoverGhosttyConfigs(request.ghosttyConfigPaths);
  let previousValues: Record<string, string | null> = {};

  if (!request.skipHerdr) {
    const herdr = detectHerdr();
    if (!herdr.ok) {
      const message = herdr.path
        ? `herdr ${herdr.version ?? "unknown"} found, ${minimumHerdrVersion}+ recommended`
        : "herdr not found";
      if (!request.skipHerdrInstall && (request.yes || request.installHerdr)) {
        if (request.dryRun) {
          warnings.push(`${message}; would install/update herdr without --dry-run`);
        } else {
          const installed = await installOrUpdateHerdr();
          warnings.push(`${message}; installed ${installed}`);
        }
      } else if (request.skipHerdrInstall) {
        warnings.push(`${message}; skipped herdr install by request`);
      } else {
        warnings.push(`${message}; rerun install and accept the herdr install prompt, or use --yes`);
      }
    }

    const herdrPlan = request.dryRun
      ? planHerdrPatch(generated.herdrValues)
      : applyHerdrPatch(generated.herdrValues, false);
    changes.push(...herdrPlan.changes);
    previousValues = herdrPlan.previousValues;
    if (!request.noReload && !request.dryRun) {
      const reloadWarning = reloadHerdr();
      if (reloadWarning) warnings.push(reloadWarning);
    }
  }

  if (!request.skipGhostty) {
    const ghosttyChanges = request.dryRun
      ? planGhosttyPatch(ghosttyConfigPaths, generated.ghosttyLines)
      : applyGhosttyPatch(ghosttyConfigPaths, generated.ghosttyLines, false);
    changes.push(...ghosttyChanges);
    if (!request.dryRun) {
      warnings.push(...validateGhosttyConfigs(ghosttyConfigPaths));
      if (!request.noReload) reloadGhosttyIfRunning();
    }
  }

  const state: ManagedState = {
    schemaVersion: 1,
    packageVersion,
    installedAt: new Date().toISOString(),
    choices: request.choices,
    ghostty: {
      sidecarPath: ghosttySidecarPath(),
      configPaths: ghosttyConfigPaths
    },
    herdr: {
      configPath: discoverHerdrConfig(),
      previousValues
    }
  };

  if (!request.dryRun) writeState(state);
  return { changes, warnings, state };
}

export function diffConfig(choices: ShortcutChoices, ghosttyConfigPaths?: string[]): CommandResult {
  const generated = generateConfig(choices);
  const configPaths = discoverGhosttyConfigs(ghosttyConfigPaths);
  const herdr = planHerdrPatch(generated.herdrValues);
  const ghostty = planGhosttyPatch(configPaths, generated.ghosttyLines);
  return { changes: [...herdr.changes, ...ghostty], warnings: [] };
}

export function revertConfig(dryRun: boolean): CommandResult {
  const state = readState();
  const configPaths = state?.ghostty.configPaths ?? discoverGhosttyConfigs(undefined);
  const previousValues = state?.herdr.previousValues ?? {};
  const changes = [
    ...applyGhosttyRevert(configPaths, dryRun),
    ...applyHerdrRevert(previousValues, dryRun)
  ];
  if (!dryRun) deleteState();
  return {
    changes,
    warnings: state ? [] : ["no state file found; removed only discoverable managed ghostty include and sidecar"]
  };
}

export function diffRevert(): CommandResult {
  const state = readState();
  const configPaths = state?.ghostty.configPaths ?? discoverGhosttyConfigs(undefined);
  const previousValues = state?.herdr.previousValues ?? {};
  const changes = [
    ...planGhosttyRevert(configPaths),
    ...planHerdrRevert(previousValues)
  ];
  return {
    changes,
    warnings: state ? [] : ["no state file found; revert preview is best effort"]
  };
}

export function doctor(): Record<string, unknown> {
  const ghosttyConfigs = discoverGhosttyConfigs(undefined);
  const herdr = detectHerdr();
  const state = readState();
  return {
    platform: `${process.platform}/${process.arch}`,
    ghostty: {
      configs: ghosttyConfigs,
      sidecar: ghosttySidecarPath(),
      sidecar_exists: existsSync(ghosttySidecarPath()),
      validation_warnings: validateGhosttyConfigs(ghosttyConfigs)
    },
    herdr: {
      path: herdr.path,
      version: herdr.version,
      meets_minimum: herdr.ok,
      config: discoverHerdrConfig()
    },
    state
  };
}
