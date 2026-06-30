# sync-skill

[中文](https://github.com/william-garden/sync-skill/blob/master/docs/zh.md)

One-click synchronization tool for **AI Agent Skills** (`SKILL.md`) across coding agents and IDEs.

## 1. Overview

`sync-skill` copies your Agent Skills from one AI tool into another. Agent Skills use the open **`SKILL.md` format** — a skill is just a folder containing a `SKILL.md` file (YAML frontmatter plus Markdown instructions) and optional scripts/assets. Because every supported platform reads the *same* format, syncing is simply a matter of copying skill folders from one platform's skills directory into another's. No format conversion is needed.

Each platform stores skills in a different directory, so `sync-skill` knows where every tool looks and moves your skills there safely — backing up anything it overwrites and never deleting skills that only exist on the target.

## 2. Technical Specifications

- **Runtime:** Node.js >= 18 (pure ESM, no build step).
- **Distribution:** run via `npx sync-skill` (no global install required).
- **Dependency:** [`@inquirer/prompts`](https://www.npmjs.com/package/@inquirer/prompts) for the interactive wizard. Everything else uses Node built-ins.
- **Tests:** `npm test` (Node's built-in `node --test`).
- **OS support:** Linux, macOS, and Windows.

## 3. Usage

### Direct mode (copies all skills)

```bash
npx -y sync-skill <source> <target> [--scope global|project]
```

Examples:

```bash
# Sync all global skills from Claude Code into Cursor
npx -y sync-skill claude cursor

# Sync project-level skills from Claude Code into Codex (./.claude/skills -> ./.agents/skills)
npx -y sync-skill claude codex --scope project
```

### Interactive mode (pick individual skills)

```bash
npx -y sync-skill
```

The wizard walks you through: **scope → source platform → target platform → checkbox selection of skills** to copy.

- `--scope global` (default): personal skills under your home directory.
- `--scope project`: workspace skills under the current directory.

## 4. Platform Matching Keywords

You can pass any of these keywords as the `<source>` / `<target>`:

| Platform | Keywords |
| :--- | :--- |
| Claude Code | `claude`, `claude-code`, `claude code`, `anthropic` |
| Codex | `codex`, `openai`, `codex cli` |
| Cursor | `cursor`, `cursor ide` |
| Gemini CLI | `gemini`, `gemini cli`, `google`, `gcloud` |
| GitHub Copilot CLI | `copilot`, `copilot cli`, `github`, `gh` |
| Visual Studio Code | `vscode`, `vs code`, `vs-code`, `code` |
| OpenCode | `opencode`, `open code`, `anomaly` |

## 5. Supported Platforms and Skill Directories

| Platform | Global (Linux / macOS) | Global (Windows) | Project | Documentation |
| :--- | :--- | :--- | :--- | :--- |
| Claude Code | `~/.claude/skills/` | `%USERPROFILE%\.claude\skills\` | `.claude/skills/` | [Claude Code skills](https://code.claude.com/docs/en/skills) |
| Codex | `~/.codex/skills/` | `%USERPROFILE%\.codex\skills\` | `.agents/skills/` | [Codex skills](https://developers.openai.com/codex/skills) |
| Cursor | `~/.cursor/skills/` | `%USERPROFILE%\.cursor\skills\` | `.cursor/skills/` | [Cursor skills](https://cursor.com/docs/skills) |
| Gemini CLI | `~/.gemini/skills/` | `%USERPROFILE%\.gemini\skills\` | `.gemini/skills/` | [Gemini CLI skills](https://geminicli.com/docs/cli/skills/) |
| GitHub Copilot CLI | `~/.copilot/skills/` | `%USERPROFILE%\.copilot\skills\` | `.github/skills/` | [Copilot CLI skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills) |
| Visual Studio Code | `~/.copilot/skills/` | `%USERPROFILE%\.copilot\skills\` | `.github/skills/` | [VS Code agent skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| OpenCode | `~/.config/opencode/skills/` | `%LOCALAPPDATA%\opencode\skills\` | `.opencode/skills/` | [OpenCode skills](https://opencode.ai/docs/skills/) |

Notes:

- **VS Code and GitHub Copilot CLI share `~/.copilot/skills/`.** Syncing between them under the global scope is reported as a no-op.
- Many tools additionally read the cross-tool locations `~/.agents/skills/` (personal) and `.agents/skills/` (project), as well as `~/.claude/skills/`. `sync-skill` targets each platform's primary native directory shown above.

## 6. Core Features

- **Two modes:** direct CLI (copy all) and interactive (select individual skills).
- **Two scopes:** `global` (personal) and `project` (workspace).
- **Non-destructive merge:** skills that exist only on the target are left untouched.
- **Backup before overwrite:** any skill folder about to be overwritten is backed up first.
- **Model-field awareness:** reports skills whose frontmatter is bound to a specific model (see below).

## 7. Model-Related Fields and Manual Adjustment

A skill's `SKILL.md` frontmatter has **universal fields** (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) that are portable across every platform, and **Claude Code-specific extensions** that other tools ignore.

Among the extensions, two are bound to a specific **model**:

- **`model`** — the model the skill runs on (`sonnet` / `opus` / `haiku`, a full model id, or `inherit`).
- **`effort`** — the reasoning effort level.

These values belong to Anthropic's model family. When a skill is synced to Gemini, Codex, Cursor, etc., spec-compliant tools simply ignore unknown fields (so nothing breaks), but the values are meaningless there.

**`sync-skill` never rewrites these values.** It copies the skill as-is, then prints a report listing which synced skills declare `model`/`effort` and reminds you to **edit them manually** for the target platform:

```
[sync-skill] Heads up — some synced skills declare model-specific fields:
[sync-skill]   - demo (model: opus, effort: high)
[sync-skill] Cursor uses a different model family. These values were copied as-is — please edit them manually.
```

## 8. Backup Mechanism

Before overwriting an existing target skill folder, `sync-skill` copies it into a timestamped backup tree under your home directory:

```
~/.sync-skill/backup/<timestamp>/<original-absolute-path>/
```

For example, overwriting `~/.cursor/skills/demo` creates a copy at `~/.sync-skill/backup/1782788522031/.../.cursor/skills/demo/` before the new skill is written. Backups are never pruned automatically.

## 9. Platform Compatibility

- On Windows, home-based tools resolve under `%USERPROFILE%`; OpenCode resolves under `%LOCALAPPDATA%`. Missing environment variables fall back to the standard `AppData` locations.
- `--scope project` resolves directories relative to the current working directory, so run it from your project root.
- Paths are normalized per-OS, so the same command works on Linux, macOS, and Windows.

## License

MIT
