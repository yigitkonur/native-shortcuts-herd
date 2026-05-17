import { describe, expect, it } from "vitest";
import { choicesFromOptions, generateConfig } from "../src/profiles.js";

describe("profile generation", () => {
  it("routes chrome-spaces cmd digits to herdr workspaces", () => {
    const generated = generateConfig(choicesFromOptions({ profile: "chrome-spaces" }));
    expect(generated.ghosttyLines).toContain("keybind = cmd+1=text:\\x1b[49;6u");
    expect(generated.herdrValues["keys.indexed.workspaces"]).toBe("ctrl+shift");
    expect(generated.herdrValues["keys.next_workspace"]).toBe("ctrl+tab");
    expect(generated.herdrValues["keys.next_tab"]).toBe("ctrl+alt+tab");
  });

  it("routes chrome-tabs cmd digits to herdr tabs", () => {
    const generated = generateConfig(choicesFromOptions({ profile: "chrome-tabs" }));
    expect(generated.ghosttyLines).toContain("keybind = cmd+1=text:\\x1b[49;3u");
    expect(generated.herdrValues["keys.indexed.tabs"]).toBe("alt");
    expect(generated.herdrValues["keys.next_tab"]).toBe("ctrl+tab");
    expect(generated.herdrValues["keys.next_workspace"]).toBe("ctrl+alt+tab");
  });

  it("accepts advanced extra bindings", () => {
    const generated = generateConfig(
      choicesFromOptions({
        profile: "minimal",
        ghosttyKey: ["cmd+slash=text:\\x02?"],
        herdrKey: ["reload_config=shift+r"]
      })
    );
    expect(generated.ghosttyLines).toContain("keybind = cmd+slash=text:\\x02?");
    expect(generated.herdrValues["keys.reload_config"]).toBe("shift+r");
  });

  it("adds the purple glass preset only when requested", () => {
    const plain = generateConfig(choicesFromOptions({ profile: "chrome-spaces" }));
    const themed = generateConfig(choicesFromOptions({ profile: "chrome-spaces", glassTheme: true }));

    expect(plain.ghosttyLines).not.toContain("background-blur = macos-glass-regular");
    expect(themed.ghosttyLines).toContain("background-blur = macos-glass-regular");
    expect(themed.ghosttyLines).toContain("theme = Catppuccin Mocha");
    expect(themed.ghosttyLines).toContain("window-colorspace = display-p3");
  });
});
