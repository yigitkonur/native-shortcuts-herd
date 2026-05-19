# native-shortcuts-herd

make ghostty navigation feel like a real macos app.

ghostty is fast, native, and powerful. herdr gives you workspaces, tabs, panes, and direct indexed jumps. the missing piece is the hand feel: `cmd+t`, `cmd+w`, `cmd+1..9`, `ctrl+tab`, and chrome-style tab cycling should work without thinking about terminal escape sequences.

`native-shortcuts-herd` wires ghostty and herdr together with a safe, reusable installer so terminal navigation feels familiar for macos users coming from chrome, safari, arc, iterm, warp, or cmux-style workflows.


https://github.com/user-attachments/assets/190184bd-f8e5-4486-894a-297ce07533af

## quick start

guided setup:

```sh
npx native-shortcuts-herd@latest install
```

fully scripted setup:

```sh
npx native-shortcuts-herd@latest install --yes --install-herdr --glass-theme
```

missing-herdr bootstrap:

```sh
npx native-shortcuts-herd@latest install --yes
```

if `herdr` is missing or older than `0.5.10`, the installer downloads the latest matching release into `~/.local/bin/herdr` before writing the keymap.

fully scripted uninstall:

```sh
npx native-shortcuts-herd@latest uninstall --yes
```

same uninstall through the installer entrypoint:

```sh
npx native-shortcuts-herd@latest install --uninstall --yes
```

the installer is intentionally reusable. run it again to change profiles, retarget `cmd+1..9`, repair config drift, update the glass preset, or remove every managed change.

## why this exists

terminal power users can always hand-roll keymaps. the problem is that terminals, multiplexers, and tui apps disagree on what a tab, space, workspace, split, pane, or session should mean.

macos users expect this kind of muscle memory:

| habit | expected feel |
|---|---|
| `cmd+t` | create a new tab-like context |
| `cmd+n` | create a new top-level working context |
| `cmd+w` | close the current tab-like context |
| `cmd+1..9` | jump directly by visible position |
| `ctrl+tab` | cycle through the main contexts |
| `ctrl+option+tab` | cycle through the secondary contexts |

ghostty already has excellent keybinding support. herdr already has the right model. this package connects them without taking over your whole config.

## what gets changed

| system | change |
|---|---|
| ghostty | adds one managed `config-file` include to each detected ghostty/cmux config |
| ghostty sidecar | writes owned key routes to `~/.config/native-shortcuts-herd/ghostty.conf` |
| optional glass preset | adds a purple catppuccin + macos liquid-glass visual layer when you opt in |
| herdr | updates `[keys]`, `[keys.indexed]`, and `ui.prompt_new_tab_name` |
| herdr installer | can install or update herdr into `~/.local/bin/herdr` when missing or below `0.5.10` |
| state | stores previous herdr values in `~/.config/native-shortcuts-herd/state.json` |
| backups | creates timestamped backups before writing |
| uninstall | removes the ghostty include/sidecar, restores tracked herdr values, and clears managed state |

## keybindings

the default profile is `chrome-spaces`: command keys target herdr workspaces/spaces, while `ctrl+option+tab` cycles herdr tabs. every ambiguous family can be changed.

| shortcut | default behavior | configurable |
|---|---|---|
| `cmd+t` | new herdr tab | yes |
| `cmd+n` | new herdr workspace / space | yes |
| `cmd+w` | close active herdr tab | yes |
| `cmd+k` | rename active herdr workspace | yes |
| `cmd+l` | rename active herdr tab | yes |
| `cmd+1..9` | jump to herdr workspace 1-9 | yes: spaces, tabs, off |
| `ctrl+tab` | next herdr workspace | yes: spaces, tabs, off |
| `ctrl+shift+tab` | previous herdr workspace | yes: spaces, tabs, off |
| `ctrl+option+tab` | next herdr tab | yes: tabs, spaces, off |
| `ctrl+option+shift+tab` | previous herdr tab | yes: tabs, spaces, off |

## ghostty behavior mappings

ghostty receives macos shortcuts first. this package routes those keys into sequences herdr understands.

| ghostty trigger | managed ghostty action | herdr receives |
|---|---|---|
| `cmd+KeyT` | `text:\x02t` | prefix + `t` |
| `cmd+KeyN` | `text:\x02n` | prefix + `n` |
| `cmd+KeyW` | `text:\x02W` | prefix + `shift+w` |
| `cmd+KeyK` | `text:\x02N` | prefix + `shift+n` |
| `cmd+KeyL` | `text:\x02T` | prefix + `shift+t` |
| `ctrl+tab` | `text:\x1b[9;5u` | enhanced `ctrl+tab` |
| `ctrl+shift+tab` | `text:\x1b[9;6u` | enhanced `ctrl+shift+tab` |
| `ctrl+option+tab` | `text:\x1b[9;7u` | enhanced `ctrl+alt+tab` |
| `ctrl+option+shift+tab` | `text:\x1b[9;8u` | enhanced `ctrl+alt+shift+tab` |
| `cmd+1..9` | generated per profile | indexed herdr jump |

for macos menu conflicts such as `cmd+w`, ghostty gets a physical-key route plus a normal `cmd+w=unbind`. that lets herdr receive the intended action instead of ghostty closing the whole window.

## herdr integration

herdr `0.5.10+` added the clean pieces this project uses: indexed keybind families and instant generated tab names.

| herdr config | purpose |
|---|---|
| `[keys].prefix` | keeps the herdr prefix at `ctrl+b` |
| `[keys].new_workspace` | target for `cmd+n` |
| `[keys].rename_workspace` | target for `cmd+k` |
| `[keys].new_tab` | target for `cmd+t` |
| `[keys].rename_tab` | target for `cmd+l` |
| `[keys].close_tab` | target for `cmd+w` |
| `[keys].previous_workspace` / `next_workspace` | direct workspace cycling |
| `[keys].previous_tab` / `next_tab` | direct tab cycling |
| `[keys.indexed].workspaces` | direct workspace jumps 1-9 |
| `[keys.indexed].tabs` | direct tab jumps 1-9 |
| `[ui].prompt_new_tab_name` | defaults to `false` for instant tab creation |

## install behavior

| command | use it when |
|---|---|
| `npx native-shortcuts-herd@latest install` | guided first run |
| `npx native-shortcuts-herd@latest install --yes` | non-interactive install with safe defaults |
| `npx native-shortcuts-herd@latest install --yes --install-herdr` | non-interactive install and install/update herdr if needed |
| `npx native-shortcuts-herd@latest install --yes --no-install-herdr` | non-interactive install without downloading herdr |
| `npx native-shortcuts-herd@latest install --yes --glass-theme` | install shortcuts plus the glass preset |
| `npx native-shortcuts-herd@latest install --uninstall --yes` | uninstall through the install command |
| `npx native-shortcuts-herd@latest uninstall --yes` | remove managed changes without prompts |
| `npx native-shortcuts-herd@latest uninstall --dry-run --json` | machine-readable uninstall preview |
| `npx native-shortcuts-herd@latest apply --profile chrome-tabs --yes` | repeatable profile application |
| `npx native-shortcuts-herd@latest diff --profile chrome-spaces` | inspect planned writes |
| `npx native-shortcuts-herd@latest doctor --json` | inspect ghostty, herdr, and state |
| `npx native-shortcuts-herd@latest generate-installer` | print a tiny shell installer |

## herdr install options

| flag | behavior |
|---|---|
| no flag in guided mode | prompt to install/update herdr when needed |
| `--yes` | allow herdr install/update without prompts |
| `--install-herdr` | explicitly install/update herdr when needed |
| `--no-install-herdr` | never download herdr |
| `--skip-herdr-install` | legacy spelling for not offering automatic install/update |
| `--skip-herdr` | do not write herdr config at all |

automatic herdr install downloads the latest matching release asset from `ogulcancelik/herdr` into `~/.local/bin/herdr`. if the release asset exposes a sha256 digest, the binary is verified before it is written.

## herdr bootstrap check

use this when you want to test or debug the setup flow before touching ghostty:

```sh
npx native-shortcuts-herd@latest doctor --json
npx native-shortcuts-herd@latest install --yes --skip-ghostty --no-reload --dry-run --json
npx native-shortcuts-herd@latest install --yes --skip-ghostty --no-reload --json
herdr --version
```

what to expect:

| state | expected result |
|---|---|
| herdr is missing | `doctor` reports `herdr.path: null` |
| dry run with missing herdr | warning says it would install/update herdr |
| real install with missing herdr | warning says it installed `~/.local/bin/herdr` |
| install complete | `herdr --version` prints `herdr 0.5.10` or newer |

package uninstall removes only package-managed ghostty/herdr config and state. it does not delete `~/.local/bin/herdr`, because herdr may be used independently.

remove the herdr binary itself only if you intentionally want to test a missing-herdr machine:

```sh
rm -f ~/.local/bin/herdr
```

## profiles

| profile | `cmd+1..9` | `ctrl+tab` | `ctrl+option+tab` | best for |
|---|---|---|---|---|
| `chrome-spaces` | workspaces | workspaces | tabs | cmux-like spaces with browser-ish secondary tab cycling |
| `chrome-tabs` | tabs | tabs | workspaces | literal chrome tab muscle memory |
| `minimal` | off | workspaces | tabs | keep core shortcuts, skip indexed jumps |

## customization

change the target families:

```sh
npx native-shortcuts-herd@latest apply \
  --cmd-numbers tabs \
  --ctrl-tab tabs \
  --ctrl-opt-tab workspaces \
  --yes
```

turn off indexed jumps:

```sh
npx native-shortcuts-herd@latest apply \
  --cmd-numbers off \
  --ctrl-tab workspaces \
  --ctrl-opt-tab tabs \
  --yes
```

add a ghostty route:

```sh
npx native-shortcuts-herd@latest apply \
  --ghostty-key 'cmd+slash=text:\x02?' \
  --yes
```

add a herdr action:

```sh
npx native-shortcuts-herd@latest apply \
  --herdr-key reload_config=shift+r \
  --yes
```

patch one config explicitly:

```sh
npx native-shortcuts-herd@latest apply \
  --ghostty-config ~/.config/ghostty/config \
  --yes
```

## purple glass preset

the glass preset is opt-in. it gives ghostty a richer macos look without making it the default behavior.

| setting family | managed values |
|---|---|
| color | `theme = Catppuccin Mocha`, purple mocha background, matching cursor and selection |
| glass | `background-opacity = 0.85`, `background-blur = macos-glass-regular`, transparent titlebar |
| rendering | `window-colorspace = display-p3`, `alpha-blending = native`, `window-vsync = true` |
| typography | `JetBrains Mono`, 16pt, ligatures, light macos thickening |
| layout | 16x12 padding, balanced padding, dimmed unfocused splits |

apply it:

```sh
npx native-shortcuts-herd@latest apply --glass-theme --yes
```

remove only the package-managed include and state:

```sh
npx native-shortcuts-herd@latest uninstall --yes
```

## supported workflows

| workflow | status | notes |
|---|---|---|
| ghostty on macos | supported | primary target |
| cmux ghostty config | supported | detected when the config file exists |
| herdr `0.5.10+` | supported | required for indexed jumps |
| re-running installer | supported | updates managed files idempotently |
| uninstall/reinstall | supported | uses saved state, best-effort cleanup, and clears managed state |
| scripted automation | supported | use `--yes`, `--install-herdr`, `--no-install-herdr`, `--uninstall`, and `--json` |
| custom keymaps | supported | use profile choices and `--ghostty-key` / `--herdr-key` |
| linux ghostty | best effort | key routing and global shortcuts vary by desktop environment |
| windows | not supported | this project is macos-first |

## safety model

this package is intentionally boring about file writes.

| safety feature | behavior |
|---|---|
| sidecar include | ghostty gets one include; owned lines live in a separate file |
| backups | files are copied before writes |
| state file | previous herdr values are tracked for uninstall |
| dry run | `diff` and `--dry-run` preview planned changes |
| json output | `--json` writes machine-readable output to stdout |
| validation | ghostty config validation runs when the binary is available |
| reload | herdr reload is attempted when a server is running |
| no secret handling | npm/github tokens are never written into config |

uninstall only removes package-owned config. it does not delete manually written ghostty keybinds, custom shaders, or theme settings that already live in your main config files.

## troubleshooting

| symptom | check |
|---|---|
| ghostty still uses the old keymap | run `cmd+shift+,` in ghostty or restart ghostty |
| herdr shortcuts do not react | run `herdr --version` and make sure it is `0.5.10+` |
| `doctor` reports `herdr.path: null` | run `npx native-shortcuts-herd@latest install --yes` to bootstrap herdr |
| `cmd+w` closes the window | run `native-shortcuts-herd doctor --json` and confirm the ghostty sidecar exists |
| install should not download herdr | use `--no-install-herdr` |
| automation needs stable output | add `--json` |
| you want to inspect first | run `diff` or add `--dry-run` |

## development

```sh
npm install
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

local dry run:

```sh
npm run dev -- diff --profile chrome-spaces
```

## release

the repo ships with github actions for ci and npm publishing.

first publish uses `NPM_TOKEN` as a github actions secret with provenance:

```sh
gh secret set NPM_TOKEN --repo yigitkonur/native-shortcuts-herd
```

after the first public package exists, move to npm trusted publishing so ci can publish with oidc and no long-lived token.

## license

mit
