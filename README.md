# native-shortcuts-herd

make ghostty navigation feel like a real macos app.

ghostty is fast, powerful, and beautifully native. but if your hands come from chrome, safari, arc, iterm, warp, or cmux-style workflows, the default terminal navigation can still feel a little off. tabs, spaces, split contexts, and terminal multiplexers all speak different shortcut languages.

`native-shortcuts-herd` fixes that by wiring ghostty and herdr together with familiar macos/chrome-style shortcuts, without rewriting your existing config.

<video src="./docs/assets/native-shortcuts-herd-demo.mp4" controls width="100%"></video>

> demo file: `docs/assets/native-shortcuts-herd-demo.mp4`

## install

```sh
npx native-shortcuts-herd install
```

the installer is reusable. run it again any time to switch profiles, change what `cmd+1..9` targets, update mappings, repair config drift, or revert cleanly.

if herdr is missing or too old, the wizard offers to install/update it into `~/.local/bin/herdr` before writing the keymap. non-interactive runs can use `--yes` for the same behavior.

fully scripted install and uninstall are supported too:

```sh
npx native-shortcuts-herd install --yes --install-herdr --glass-theme
npx native-shortcuts-herd uninstall --yes
```

## why this exists

terminal power users already know how to build custom keymaps. the problem is that every terminal, multiplexer, and tui app has its own idea of what "tab", "space", and "pane" means.

macos users expect this:

| habit | expected feel |
|---|---|
| `cmd+t` | create a new tab-like context |
| `cmd+n` | create a new top-level working context |
| `cmd+w` | close the current tab-like context |
| `cmd+1..9` | jump directly by visible position |
| `ctrl+tab` | cycle through the main contexts |
| `ctrl+option+tab` | cycle through the secondary contexts |

ghostty already has excellent keybinding support. herdr already has workspaces, tabs, panes, direct keybindings, and indexed jumps. this package connects the two in a safe, repeatable way.

## what it does

| system | change |
|---|---|
| ghostty | adds one managed `config-file` include to your existing config |
| ghostty sidecar | writes only owned keybind routes into `~/.config/native-shortcuts-herd/ghostty.conf` |
| optional glass preset | adds a purple catppuccin + macos liquid-glass visual layer when you opt in |
| herdr | updates `[keys]`, `[keys.indexed]`, and `ui.prompt_new_tab_name` |
| herdr installer | prompts to install/update herdr when it is missing or below `0.5.10` |
| state | stores install state in `~/.config/native-shortcuts-herd/state.json` |
| backups | creates timestamped backups before writing |
| uninstall | removes the ghostty sidecar/include, restores tracked herdr values, and clears managed state |

## keybindings

the installer lets you choose what the ambiguous families target. nothing is hardcoded forever.

| shortcut | default profile behavior | configurable |
|---|---|---|
| `cmd+t` | new herdr tab | yes |
| `cmd+n` | new herdr workspace / space | yes |
| `cmd+w` | close active herdr tab | yes |
| `cmd+k` | rename active herdr workspace | yes |
| `cmd+l` | rename active herdr tab | yes |
| `cmd+1..9` | wizard-selected: spaces, tabs, or off | yes |
| `ctrl+tab` | wizard-selected: spaces, tabs, or off | yes |
| `ctrl+shift+tab` | previous item for `ctrl+tab` target | yes |
| `ctrl+option+tab` | wizard-selected: tabs, spaces, or off | yes |
| `ctrl+option+shift+tab` | previous item for `ctrl+option+tab` target | yes |

## ghostty behavior mappings

ghostty receives macos keys first. this tool routes them into terminal sequences that herdr can understand.

| ghostty trigger | managed action | herdr receives |
|---|---|---|
| `cmd+key_t` | `text:\x02t` | prefix + `t` |
| `cmd+key_n` | `text:\x02n` | prefix + `n` |
| `cmd+key_w` | `text:\x02W` | prefix + `shift+w` |
| `cmd+key_k` | `text:\x02N` | prefix + `shift+n` |
| `cmd+key_l` | `text:\x02T` | prefix + `shift+t` |
| `ctrl+tab` | `text:\x1b[9;5u` | enhanced `ctrl+tab` |
| `ctrl+shift+tab` | `text:\x1b[9;6u` | enhanced `ctrl+shift+tab` |
| `ctrl+option+tab` | `text:\x1b[9;7u` | enhanced `ctrl+alt+tab` |
| `cmd+1..9` | generated per profile | indexed herdr jump |

for macos menu conflicts like `cmd+w`, ghostty gets both a physical-key route and a normal `cmd+w=unbind`, so the terminal app does not close the window before herdr sees the intended action.

## purple glass preset

the wizard can optionally add a visual preset inspired by a polished macos ghostty setup: catppuccin mocha colors, display-p3/native blending, transparent titlebar, `macos-glass-regular`, subtle split dimming, and retina-friendly jetbrains mono thickening.

| setting family | managed values |
|---|---|
| color | `theme = Catppuccin Mocha`, purple mocha background, matching cursor and selection |
| glass | `background-opacity = 0.85`, `background-blur = macos-glass-regular`, transparent titlebar |
| rendering | `window-colorspace = display-p3`, `alpha-blending = native`, `window-vsync = true` |
| typography | `JetBrains Mono`, 16pt, ligatures, light macos thickening |
| layout | 16x12 padding, balanced padding, dimmed unfocused splits |

it is opt-in. use the wizard prompt, `--glass-theme`, or `--no-glass-theme`.

## herdr integration

herdr v0.5.10 added the pieces that make this clean: indexed keybind families and instant generated tab names.

| herdr config | purpose |
|---|---|
| `[keys].new_workspace` | target for `cmd+n` |
| `[keys].new_tab` | target for `cmd+t` |
| `[keys].close_tab` | target for `cmd+w` |
| `[keys].previous_workspace` / `next_workspace` | direct cycle shortcuts |
| `[keys].previous_tab` / `next_tab` | direct tab cycle shortcuts |
| `[keys.indexed].workspaces` | direct workspace jumps 1-9 |
| `[keys.indexed].tabs` | direct tab jumps 1-9 |
| `[ui].prompt_new_tab_name` | set to `false` for instant tab creation |

## install options

| command | use it when |
|---|---|
| `npx native-shortcuts-herd install` | guided setup, best first run |
| `npx native-shortcuts-herd install --yes --install-herdr --glass-theme` | full non-interactive install |
| `npx native-shortcuts-herd install --uninstall --yes` | uninstall through the same install entrypoint |
| `npx native-shortcuts-herd apply --profile chrome-spaces --yes` | repeatable non-interactive setup |
| `npx native-shortcuts-herd apply --no-install-herdr --yes` | apply config without downloading herdr |
| `npx native-shortcuts-herd apply --glass-theme --yes` | apply shortcuts plus the purple glass preset |
| `npx native-shortcuts-herd diff` | inspect changes before writing |
| `npx native-shortcuts-herd doctor` | see detected ghostty/herdr state |
| `npx native-shortcuts-herd uninstall --yes` | remove managed changes without prompts |
| `npx native-shortcuts-herd revert` | alias-style legacy removal command |
| `npx native-shortcuts-herd profiles` | list built-in profiles |
| `npx native-shortcuts-herd generate-installer` | print a tiny shell installer |

## supported workflows

| workflow | status | notes |
|---|---|---|
| ghostty on macos | supported | primary target |
| cmux ghostty config | supported | detected when the config file exists |
| herdr 0.5.10+ | supported | required for indexed jumps |
| re-running installer | supported | updates managed files idempotently |
| uninstall/revert | supported | uses saved state, best-effort cleanup, and clears managed state |
| scripted automation | supported | use `--yes`, `--install-herdr`, `--no-install-herdr`, `--uninstall`, and `--json` |
| custom keymaps | supported | use profile choices and `--ghostty-key` / `--herdr-key` |
| linux ghostty | best effort | key routing may vary by desktop environment |
| windows | not supported | ghostty/herdr target here is macos-first |

## examples

chrome-ish spaces:

```sh
npx native-shortcuts-herd apply --profile chrome-spaces --yes
```

scripted install, including herdr and glass:

```sh
npx native-shortcuts-herd install --yes --install-herdr --glass-theme
```

literal chrome tabs:

```sh
npx native-shortcuts-herd apply --profile chrome-tabs --yes
```

turn off indexed `cmd+1..9` but keep cycling:

```sh
npx native-shortcuts-herd apply --cmd-numbers off --ctrl-tab workspaces --ctrl-opt-tab tabs --yes
```

add a custom herdr action:

```sh
npx native-shortcuts-herd apply --herdr-key reload_config=shift+r --yes
```

patch a specific ghostty config:

```sh
npx native-shortcuts-herd apply --ghostty-config ~/.config/ghostty/config --yes
```

apply the purple glass look:

```sh
npx native-shortcuts-herd apply --glass-theme --yes
```

preview everything:

```sh
npx native-shortcuts-herd diff --profile chrome-spaces
```

revert:

```sh
npx native-shortcuts-herd uninstall --yes
```

uninstall through the installer entrypoint:

```sh
npx native-shortcuts-herd install --uninstall --yes
```

## safety model

this package is intentionally boring about file writes.

| safety feature | behavior |
|---|---|
| sidecar include | ghostty gets one include; owned keybinds live elsewhere |
| backups | files are copied before writes |
| state file | previous herdr values are tracked for uninstall, then removed |
| dry run | `diff` and `--dry-run` show planned changes first |
| validation | ghostty config validation runs when the binary is available |
| reload | herdr reload is attempted when a server is running |
| no secret handling | npm/github tokens are never written into config |

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
