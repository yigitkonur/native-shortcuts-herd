export type ShortcutTarget = "workspaces" | "tabs" | "off";

export type ProfileId = "chrome-spaces" | "chrome-tabs" | "minimal";

export interface ShortcutProfile {
  id: ProfileId;
  name: string;
  description: string;
  cmdNumbers: ShortcutTarget;
  ctrlTab: ShortcutTarget;
  ctrlOptTab: ShortcutTarget;
  includePrefixActions: boolean;
  promptNewTabName: boolean;
  applyGlassTheme: boolean;
}

export interface ShortcutChoices {
  profile: ProfileId;
  cmdNumbers: ShortcutTarget;
  ctrlTab: ShortcutTarget;
  ctrlOptTab: ShortcutTarget;
  promptNewTabName: boolean;
  applyGlassTheme: boolean;
  extraGhosttyBindings: KeyValue[];
  extraHerdrKeys: KeyValue[];
}

export interface KeyValue {
  key: string;
  value: string;
}

export interface GeneratedConfig {
  choices: ShortcutChoices;
  ghosttyLines: string[];
  herdrValues: Record<string, string | boolean>;
}

export interface Change {
  path: string;
  kind: "create" | "update" | "delete" | "noop" | "warn";
  message: string;
  before?: string;
  after?: string;
}

export interface ManagedState {
  schemaVersion: 1;
  packageVersion: string;
  installedAt: string;
  choices: ShortcutChoices;
  ghostty: {
    sidecarPath: string;
    configPaths: string[];
  };
  herdr: {
    configPath: string;
    previousValues: Record<string, string | null>;
  };
}

export interface ApplyRequest {
  choices: ShortcutChoices;
  dryRun: boolean;
  yes: boolean;
  installHerdr?: boolean;
  ghosttyConfigPaths?: string[];
  skipGhostty?: boolean;
  skipHerdr?: boolean;
  skipHerdrInstall?: boolean;
  noReload?: boolean;
}

export interface CommandResult {
  changes: Change[];
  warnings: string[];
  state?: ManagedState;
}
