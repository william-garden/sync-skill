import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { checkbox, confirm, select } from '@inquirer/prompts';

import {
  PLATFORMS,
  collectModelFields,
  listSkillFolders,
  resolveSkillsDir,
  syncSkillFolders,
} from './skills.js';

const SCOPES = ['global', 'project'];

async function main() {
  try {
    const { positionals, scope, help } = parseArgs(process.argv.slice(2));

    if (help) {
      printUsage();
      return;
    }

    if (positionals.length === 0) {
      await runInteractiveSync();
    } else if (positionals.length === 2) {
      await runDirectSync(positionals[0], positionals[1], { scope });
    } else {
      printUsage();
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[sync-skill] ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const positionals = [];
  let scope = 'global';
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--scope') {
      scope = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--scope=')) {
      scope = arg.slice('--scope='.length);
    } else {
      positionals.push(arg);
    }
  }

  if (!SCOPES.includes(scope)) {
    throw new Error(`Invalid scope "${scope}". Use one of: ${SCOPES.join(', ')}.`);
  }

  return { positionals, scope, help };
}

function printUsage() {
  console.log('Usage: npx sync-skill <source> <target> [--scope global|project]');
  console.log('Run without arguments to start the interactive sync wizard.');
  console.log('');
  console.log('Examples:');
  console.log('  npx sync-skill claude cursor');
  console.log('  npx sync-skill claude codex --scope project');
}

async function runDirectSync(sourceKeyword, targetKeyword, { scope }) {
  const source = resolvePlatformByKeyword(sourceKeyword);
  if (!source) {
    throw new Error(`Unknown source platform: ${sourceKeyword}`);
  }

  const target = resolvePlatformByKeyword(targetKeyword);
  if (!target) {
    throw new Error(`Unknown target platform: ${targetKeyword}`);
  }

  console.log(`[sync-skill] Syncing ${scope} skills from ${source.name} -> ${target.name}`);
  await performSync({ source, target, scope });
}

async function runInteractiveSync() {
  clearTerminal();
  console.log('\x1b[44m ***** Welcome to sync-skill interactive mode. ***** \x1b[0m');

  const scope = await select({
    message: 'Select the skill scope:',
    choices: [
      { name: 'Global (personal, e.g. ~/.claude/skills)', value: 'global' },
      { name: 'Project (workspace, e.g. ./.claude/skills)', value: 'project' },
    ],
  });

  const detected = await detectExistingSkillDirs({ scope });
  if (detected.length === 0) {
    throw new Error(
      `No ${scope} skill directories with skills were found. Add a skill first, or check the scope.`,
    );
  }

  clearTerminal();
  const sourceId = await select({
    message: 'Select the source platform:',
    choices: detected.map(({ platform, dir, count }) => ({
      name: `${platform.name} (${count} skill${count === 1 ? '' : 's'}, ${formatPathForDisplay(dir)})`,
      value: platform.id,
    })),
  });
  const source = getPlatformById(sourceId);

  clearTerminal();
  const targetId = await select({
    message: 'Select the target platform:',
    choices: PLATFORMS.filter((platform) => platform.id !== source.id).map((platform) => ({
      name: `${platform.name} (${formatPathForDisplay(resolveSkillsDir(platform, { scope }))})`,
      value: platform.id,
    })),
  });
  const target = getPlatformById(targetId);

  const sourceDir = resolveSkillsDir(source, { scope });
  const sourceSkills = await listSkillFolders(sourceDir);

  clearTerminal();
  const selected = await checkbox({
    message: 'Select the skills to sync:',
    choices: sourceSkills.map((skill) => ({
      name: skill.description
        ? `${skill.name} — ${truncate(skill.description, 70)}`
        : skill.name,
      value: skill.name,
      checked: true,
    })),
  });

  if (selected.length === 0) {
    console.log('[sync-skill] No skills selected. No action taken.');
    return;
  }

  clearTerminal();
  await performSync({ source, target, scope, selected });
}

async function performSync({ source, target, scope, selected = null }) {
  const sourceDir = resolveSkillsDir(source, { scope });
  const targetDir = resolveSkillsDir(target, { scope });

  if (path.resolve(sourceDir) === path.resolve(targetDir)) {
    console.log(
      `[sync-skill] ${source.name} and ${target.name} share the same skills directory (${formatPathForDisplay(sourceDir)}). No action taken.`,
    );
    return;
  }

  const sourceSkills = await listSkillFolders(sourceDir);
  if (sourceSkills.length === 0) {
    throw new Error(`No skills found in ${source.name} (${formatPathForDisplay(sourceDir)}).`);
  }

  async function confirmOverwrite({ skill, existingFrontmatter }) {
    console.log(
      `[sync-skill] "${skill.name}" already exists in ${target.name} (${formatPathForDisplay(targetDir)}).`,
    );
    const sourceVersion = skill.frontmatter?.version;
    const targetVersion = existingFrontmatter?.version;
    if (sourceVersion || targetVersion) {
      console.log(
        `[sync-skill]   Source version: ${sourceVersion ?? '(none)'}  Target version: ${targetVersion ?? '(none)'}`,
      );
    }
    return confirm({
      message: `Replace "${skill.name}"? This cannot be undone — no backup will be kept.`,
      default: false,
    });
  }

  const result = await syncSkillFolders({ sourceDir, targetDir, selected, onConflict: confirmOverwrite });

  if (result.skills.length === 0 && result.skipped.length === 0) {
    console.log('[sync-skill] Nothing to sync.');
    return;
  }

  if (result.skills.length > 0) {
    console.log(
      `[sync-skill] Synced ${result.skills.length} skill(s) ${source.name} -> ${target.name} (${formatPathForDisplay(targetDir)}).`,
    );
  }
  if (result.copied.length > 0) {
    console.log(`[sync-skill]   Added: ${result.copied.join(', ')}`);
  }
  if (result.overwritten.length > 0) {
    console.log(`[sync-skill]   Overwritten: ${result.overwritten.join(', ')}`);
  }
  if (result.skipped.length > 0) {
    console.log(`[sync-skill]   Skipped (kept existing): ${result.skipped.join(', ')}`);
  }

  reportModelFields(result.skills, target);
}

function reportModelFields(skills, target) {
  const report = collectModelFields(skills);
  if (report.length === 0) {
    return;
  }

  console.log('');
  console.log('[sync-skill] Heads up — some synced skills declare model-specific fields:');
  for (const { name, fields } of report) {
    const parts = Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join(', ');
    console.log(`[sync-skill]   - ${name} (${parts})`);
  }
  console.log(
    `[sync-skill] ${target.name} uses a different model family. These values were copied as-is — please edit them manually.`,
  );
}

async function detectExistingSkillDirs({ scope }) {
  const results = [];
  for (const platform of PLATFORMS) {
    const dir = resolveSkillsDir(platform, { scope });
    const skills = await listSkillFolders(dir);
    if (skills.length > 0) {
      results.push({ platform, dir, count: skills.length });
    }
  }
  return results;
}

function resolvePlatformByKeyword(keyword) {
  if (!keyword) {
    return null;
  }
  const normalized = keyword.trim().toLowerCase();
  return (
    PLATFORMS.find(
      (platform) =>
        platform.id === normalized ||
        platform.name.toLowerCase() === normalized ||
        platform.keywords.some((alias) => alias.toLowerCase() === normalized),
    ) ?? null
  );
}

function getPlatformById(id) {
  const platform = PLATFORMS.find((entry) => entry.id === id);
  if (!platform) {
    throw new Error(`Unsupported platform identifier: ${id}`);
  }
  return platform;
}

function clearTerminal() {
  if (!process.stdout.isTTY) {
    return;
  }
  const clearCommand = process.platform === 'win32' ? '\x1Bc' : '\x1B[2J\x1B[3J\x1B[H';
  process.stdout.write(clearCommand);
}

function formatPathForDisplay(filePath) {
  const resolved = path.resolve(filePath);
  const home = os.homedir();
  if (resolved.startsWith(home)) {
    return `~${resolved.slice(home.length)}`;
  }
  return resolved;
}

function truncate(text, max) {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

main();
