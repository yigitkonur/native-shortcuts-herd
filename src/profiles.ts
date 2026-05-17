import type {
  GeneratedConfig,
  KeyValue,
  ProfileId,
  ShortcutChoices,
  ShortcutProfile,
  ShortcutTarget
} from "./types.js";

export const profiles: ShortcutProfile[] = [
  {
    id: "chrome-spaces",
    name: "chrome spaces",
    description: "cmd+1..9 jumps herdr spaces; ctrl+tab cycles spaces; ctrl+option+tab cycles tabs.",
    cmdNumbers: "workspaces",
    ctrlTab: "workspaces",
    ctrlOptTab: "tabs",
    includePrefixActions: true,
    promptNewTabName: false,
    applyGlassTheme: false
  },
  {
    id: "chrome-tabs",
    name: "chrome tabs",
    description: "cmd+1..9 jumps tabs like chrome; ctrl+tab cycles tabs; ctrl+option+tab cycles spaces.",
    cmdNumbers: "tabs",
    ctrlTab: "tabs",
    ctrlOptTab: "workspaces",
    includePrefixActions: true,
    promptNewTabName: false,
    applyGlassTheme: false
  },
  {
    id: "minimal",
    name: "minimal",
    description: "only patch the core macos actions and leave indexed jumps off.",
    cmdNumbers: "off",
    ctrlTab: "workspaces",
    ctrlOptTab: "tabs",
    includePrefixActions: true,
    promptNewTabName: false,
    applyGlassTheme: false
  }
];

export function getProfile(id: string | undefined): ShortcutProfile {
  const profile = profiles.find((candidate) => candidate.id === id);
  if (profile) return profile;
  return profiles[0];
}

export function targetFrom(value: unknown, fallback: ShortcutTarget): ShortcutTarget {
  if (value === "workspaces" || value === "spaces") return "workspaces";
  if (value === "tabs") return "tabs";
  if (value === "off" || value === "none" || value === "disabled") return "off";
  return fallback;
}

export function choicesFromOptions(options: {
  profile?: string;
  cmdNumbers?: string;
  ctrlTab?: string;
  ctrlOptTab?: string;
  promptNewTabName?: boolean;
  glassTheme?: boolean;
  ghosttyKey?: string[];
  herdrKey?: string[];
}): ShortcutChoices {
  const profile = getProfile(options.profile);
  return {
    profile: profile.id,
    cmdNumbers: targetFrom(options.cmdNumbers, profile.cmdNumbers),
    ctrlTab: targetFrom(options.ctrlTab, profile.ctrlTab),
    ctrlOptTab: targetFrom(options.ctrlOptTab, profile.ctrlOptTab),
    promptNewTabName: options.promptNewTabName ?? profile.promptNewTabName,
    applyGlassTheme: options.glassTheme ?? profile.applyGlassTheme,
    extraGhosttyBindings: parseKeyValues(options.ghosttyKey ?? []),
    extraHerdrKeys: parseKeyValues(options.herdrKey ?? [])
  };
}

export function parseKeyValues(values: string[]): KeyValue[] {
  return values.map((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) {
      throw new Error(`expected key=value, got ${entry}`);
    }
    return {
      key: entry.slice(0, separator).trim(),
      value: entry.slice(separator + 1).trim()
    };
  });
}

export function generateConfig(choices: ShortcutChoices): GeneratedConfig {
  const ghosttyLines = [
    "# native-shortcuts-herd: managed ghostty key routing",
    "# edit with: native-shortcuts-herd install",
    ""
  ];

  addPrefixActionBindings(ghosttyLines);
  if (choices.applyGlassTheme) addPurpleGlassTheme(ghosttyLines);
  const herdrValues: Record<string, string | boolean> = {
    "keys.prefix": "ctrl+b",
    "keys.new_workspace": "n",
    "keys.rename_workspace": "shift+n",
    "keys.close_workspace": "shift+d",
    "keys.new_tab": "t",
    "keys.rename_tab": "shift+t",
    "keys.close_tab": "shift+w",
    "ui.prompt_new_tab_name": choices.promptNewTabName
  };

  addCycleBindings("ctrl", choices.ctrlTab, ghosttyLines, herdrValues);
  addCycleBindings("ctrl+alt", choices.ctrlOptTab, ghosttyLines, herdrValues);
  addIndexedBindings(choices.cmdNumbers, ghosttyLines, herdrValues);

  for (const binding of choices.extraGhosttyBindings) {
    ghosttyLines.push(`keybind = ${binding.key}=${binding.value}`);
  }
  for (const binding of choices.extraHerdrKeys) {
    herdrValues[`keys.${binding.key}`] = binding.value;
  }

  ghosttyLines.push("");
  return { choices, ghosttyLines, herdrValues };
}

function addPurpleGlassTheme(lines: string[]): void {
  lines.push(
    "# purple liquid glass ghostty theme",
    "font-family = JetBrains Mono",
    "font-size = 16",
    "font-thicken = true",
    "font-thicken-strength = 64",
    "font-feature = calt",
    "font-feature = liga",
    "theme = Catppuccin Mocha",
    "background = 1e1e2e",
    "foreground = cdd6f4",
    "cursor-color = f5e0dc",
    "cursor-text = 1e1e2e",
    "cursor-style = block",
    "cursor-style-blink = true",
    "cursor-opacity = 0.9",
    "selection-background = 585b70",
    "selection-foreground = cdd6f4",
    "background-opacity = 0.85",
    "background-opacity-cells = true",
    "background-blur = macos-glass-regular",
    "window-colorspace = display-p3",
    "alpha-blending = native",
    "window-vsync = true",
    "macos-titlebar-style = transparent",
    "macos-titlebar-proxy-icon = hidden",
    "macos-icon = glass",
    "window-padding-x = 16",
    "window-padding-y = 12",
    "window-padding-balance = true",
    "window-padding-color = background",
    "unfocused-split-opacity = 0.65",
    "unfocused-split-fill = 181825",
    "split-divider-color = 45475a",
    ""
  );
}

function addPrefixActionBindings(lines: string[]): void {
  lines.push(
    "# macos/chrome-style herdr actions",
    "keybind = cmd+KeyT=text:\\x02t",
    "keybind = cmd+t=unbind",
    "keybind = cmd+KeyN=text:\\x02n",
    "keybind = cmd+n=unbind",
    "keybind = cmd+KeyW=text:\\x02W",
    "keybind = cmd+w=unbind",
    "keybind = cmd+KeyK=text:\\x02N",
    "keybind = cmd+k=unbind",
    "keybind = cmd+KeyL=text:\\x02T",
    "keybind = cmd+l=unbind",
    "keybind = alt+t=text:\\x02t",
    ""
  );
}

function addCycleBindings(
  chord: "ctrl" | "ctrl+alt",
  target: ShortcutTarget,
  lines: string[],
  herdrValues: Record<string, string | boolean>
): void {
  if (target === "off") return;

  const next = chord === "ctrl" ? "\\x1b[9;5u" : "\\x1b[9;7u";
  const previous = chord === "ctrl" ? "\\x1b[9;6u" : "\\x1b[9;8u";
  const keyNext = chord === "ctrl" ? "ctrl+tab" : "ctrl+alt+tab";
  const keyPrevious = chord === "ctrl" ? "ctrl+shift+tab" : "ctrl+alt+shift+tab";
  const herdrPrefix = target === "tabs" ? "tab" : "workspace";

  lines.push(
    `# ${keyNext} / ${keyPrevious} -> herdr ${target}`,
    `keybind = ${keyNext}=text:${next}`,
    `keybind = ${keyPrevious}=text:${previous}`,
    ""
  );

  herdrValues[`keys.next_${herdrPrefix}`] = keyNext;
  herdrValues[`keys.previous_${herdrPrefix}`] = keyPrevious;
}

function addIndexedBindings(
  target: ShortcutTarget,
  lines: string[],
  herdrValues: Record<string, string | boolean>
): void {
  if (target === "off") {
    herdrValues["keys.indexed.workspaces"] = "";
    herdrValues["keys.indexed.tabs"] = "";
    return;
  }

  const modifier = target === "tabs" ? "alt" : "ctrl+shift";
  const csiModifier = target === "tabs" ? 3 : 6;
  const indexedKey = target === "tabs" ? "keys.indexed.tabs" : "keys.indexed.workspaces";

  lines.push(`# cmd+1..9 -> herdr ${target}`);
  for (let index = 1; index <= 9; index += 1) {
    const codepoint = 48 + index;
    lines.push(`keybind = cmd+digit_${index}=text:\\x1b[${codepoint};${csiModifier}u`);
    lines.push(`keybind = cmd+${index}=text:\\x1b[${codepoint};${csiModifier}u`);
  }
  lines.push("");

  herdrValues[indexedKey] = modifier;
  if (target === "tabs") {
    herdrValues["keys.indexed.workspaces"] = "ctrl+shift";
  } else {
    herdrValues["keys.indexed.tabs"] = "alt";
  }
}
