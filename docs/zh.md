# sync-skill

[English](https://github.com/william-garden/sync-skill)

跨编程助手与 IDE 一键同步 **AI Agent Skills**（`SKILL.md`）的工具。

## 1. 概述

`sync-skill` 把你的 Agent Skills 从一个 AI 工具复制到另一个工具。Agent Skills 采用开放的 **`SKILL.md` 格式**——一个 skill 就是一个文件夹，内含 `SKILL.md`（YAML frontmatter + Markdown 指令）以及可选的脚本/资源。由于所有受支持的平台读取的是*同一种*格式，同步只需把 skill 文件夹从一个平台的 skills 目录复制到另一个平台的 skills 目录，**无需任何格式转换**。

每个平台把 skill 存放在不同目录，`sync-skill` 知道各工具的查找位置，并安全地把 skill 搬过去——覆盖前先备份，且绝不删除仅存在于目标端的 skill。

## 2. 技术规格

- **运行时：** Node.js >= 18（纯 ESM，无需构建）。
- **分发方式：** 通过 `npx sync-skill` 运行（无需全局安装）。
- **依赖：** [`@inquirer/prompts`](https://www.npmjs.com/package/@inquirer/prompts) 用于交互式向导，其余均使用 Node 内置模块。
- **测试：** `npm test`（Node 内置的 `node --test`）。
- **操作系统：** Linux、macOS、Windows。

## 3. 使用方法

### 直接模式（复制全部 skill）

```bash
npx -y sync-skill <source> <target> [--scope global|project]
```

示例：

```bash
# 把 Claude Code 的全部全局 skill 同步到 Cursor
npx -y sync-skill claude cursor

# 把 Claude Code 的项目级 skill 同步到 Codex（./.claude/skills -> ./.agents/skills）
npx -y sync-skill claude codex --scope project
```

### 交互模式（逐个勾选 skill）

```bash
npx -y sync-skill
```

向导会依次引导你完成：**作用域 → 源平台 → 目标平台 → 勾选要复制的 skill**。

- `--scope global`（默认）：用户主目录下的个人 skill。
- `--scope project`：当前目录下的工作区 skill。

## 4. 平台匹配关键词

`<source>` / `<target>` 可使用以下任意关键词：

| 平台 | 关键词 |
| :--- | :--- |
| Claude Code | `claude`、`claude-code`、`claude code`、`anthropic` |
| Codex | `codex`、`openai`、`codex cli` |
| Cursor | `cursor`、`cursor ide` |
| Gemini CLI | `gemini`、`gemini cli`、`google`、`gcloud` |
| GitHub Copilot CLI | `copilot`、`copilot cli`、`github`、`gh` |
| Visual Studio Code | `vscode`、`vs code`、`vs-code`、`code` |
| OpenCode | `opencode`、`open code`、`anomaly` |

## 5. 支持的平台与 skill 目录

| 平台 | 全局（Linux / macOS） | 全局（Windows） | 项目级 | 文档 |
| :--- | :--- | :--- | :--- | :--- |
| Claude Code | `~/.claude/skills/` | `%USERPROFILE%\.claude\skills\` | `.claude/skills/` | [Claude Code skills](https://code.claude.com/docs/en/skills) |
| Codex | `~/.codex/skills/` | `%USERPROFILE%\.codex\skills\` | `.agents/skills/` | [Codex skills](https://developers.openai.com/codex/skills) |
| Cursor | `~/.cursor/skills/` | `%USERPROFILE%\.cursor\skills\` | `.cursor/skills/` | [Cursor skills](https://cursor.com/docs/skills) |
| Gemini CLI | `~/.gemini/skills/` | `%USERPROFILE%\.gemini\skills\` | `.gemini/skills/` | [Gemini CLI skills](https://geminicli.com/docs/cli/skills/) |
| GitHub Copilot CLI | `~/.copilot/skills/` | `%USERPROFILE%\.copilot\skills\` | `.github/skills/` | [Copilot CLI skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills) |
| Visual Studio Code | `~/.copilot/skills/` | `%USERPROFILE%\.copilot\skills\` | `.github/skills/` | [VS Code agent skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| OpenCode | `~/.config/opencode/skills/` | `%LOCALAPPDATA%\opencode\skills\` | `.opencode/skills/` | [OpenCode skills](https://opencode.ai/docs/skills/) |

说明：

- **VS Code 与 GitHub Copilot CLI 共享 `~/.copilot/skills/`。** 在全局作用域下相互同步会被识别为空操作（no-op）。
- 许多工具还会读取跨工具的通用位置 `~/.agents/skills/`（个人）与 `.agents/skills/`（项目），以及 `~/.claude/skills/`。`sync-skill` 使用上表中每个平台的主要原生目录。

## 6. 核心特性

- **两种模式：** 直接 CLI（复制全部）与交互式（逐个勾选 skill）。
- **两种作用域：** `global`（个人）与 `project`（工作区）。
- **非破坏性合并：** 仅存在于目标端的 skill 不会被改动。
- **覆盖前备份：** 即将被覆盖的 skill 文件夹会先被备份。
- **模型字段提醒：** 报告 frontmatter 绑定了特定模型的 skill（见下）。

## 7. 模型相关字段与手动调整

skill 的 `SKILL.md` frontmatter 分为**通用字段**（`name`、`description`、`license`、`compatibility`、`metadata`、`allowed-tools`，跨平台可移植）和 **Claude Code 专属扩展字段**（其他工具会忽略）。

在扩展字段中，有两个与具体**模型**强绑定：

- **`model`** —— skill 运行所用的模型（`sonnet` / `opus` / `haiku`、完整模型 ID，或 `inherit`）。
- **`effort`** —— 推理强度。

这些取值属于 Anthropic 的模型体系。当 skill 被同步到 Gemini、Codex、Cursor 等平台时，符合规范的工具会忽略不认识的字段（因此不会报错），但这些值在那里没有意义。

**`sync-skill` 绝不改写这些值。** 它原样复制 skill，然后打印一份报告，列出哪些被同步的 skill 声明了 `model`/`effort`，并提醒你针对目标平台**手动修改**：

```
[sync-skill] Heads up — some synced skills declare model-specific fields:
[sync-skill]   - demo (model: opus, effort: high)
[sync-skill] Cursor uses a different model family. These values were copied as-is — please edit them manually.
```

## 8. 文件备份机制

在覆盖已存在的目标 skill 文件夹之前，`sync-skill` 会先把它复制到主目录下带时间戳的备份目录树中：

```
~/.sync-skill/backup/<时间戳>/<原始绝对路径>/
```

例如覆盖 `~/.cursor/skills/demo` 时，会先在 `~/.sync-skill/backup/1782788522031/.../.cursor/skills/demo/` 生成一份副本，再写入新的 skill。备份不会被自动清理。

## 9. 平台兼容性

- 在 Windows 上，基于主目录的工具解析到 `%USERPROFILE%` 下；OpenCode 解析到 `%LOCALAPPDATA%` 下。环境变量缺失时回退到标准的 `AppData` 位置。
- `--scope project` 相对当前工作目录解析路径，请在项目根目录下运行。
- 路径按操作系统规范化，同一条命令在 Linux、macOS、Windows 上均可使用。

## 许可证

MIT
