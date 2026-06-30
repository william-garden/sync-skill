import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  collectModelFields,
  listSkillFolders,
  parseFrontmatter,
  syncSkillFolders,
} from '../src/skills.js';

async function writeSkill(dir, name, frontmatter, body = 'Body.') {
  const skillDir = path.join(dir, name);
  await mkdir(skillDir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  await writeFile(path.join(skillDir, 'SKILL.md'), `---\n${fm}\n---\n\n${body}\n`, 'utf-8');
  return skillDir;
}

async function tmp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test('parseFrontmatter reads top-level scalars and strips quotes', () => {
  const fm = parseFrontmatter('---\nname: demo\ndescription: "Does a thing"\nmodel: opus\n---\nbody');
  assert.equal(fm.name, 'demo');
  assert.equal(fm.description, 'Does a thing');
  assert.equal(fm.model, 'opus');
});

test('parseFrontmatter ignores nested/indented keys', () => {
  const fm = parseFrontmatter('---\nname: demo\nmetadata:\n  version: 1\n  author: x\n---\nbody');
  assert.equal(fm.name, 'demo');
  assert.equal(fm.version, undefined);
  assert.equal(fm.author, undefined);
});

test('listSkillFolders discovers SKILL.md folders with metadata', async (t) => {
  const dir = await tmp('sync-skill-list-');
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeSkill(dir, 'beta', { name: 'beta', description: 'Beta skill' });
  await writeSkill(dir, 'alpha', { name: 'alpha', description: 'Alpha skill', model: 'opus' });
  await mkdir(path.join(dir, 'not-a-skill'), { recursive: true }); // no SKILL.md

  const skills = await listSkillFolders(dir);
  assert.deepEqual(skills.map((s) => s.name), ['alpha', 'beta']); // sorted
  assert.equal(skills[0].description, 'Alpha skill');
  assert.equal(skills[0].frontmatter.model, 'opus');
});

test('listSkillFolders returns [] for a missing directory', async () => {
  const skills = await listSkillFolders(path.join(os.tmpdir(), 'sync-skill-does-not-exist-xyz'));
  assert.deepEqual(skills, []);
});

test('collectModelFields reports skills with model/effort fields', async (t) => {
  const dir = await tmp('sync-skill-model-');
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeSkill(dir, 'plain', { name: 'plain', description: 'No model' });
  await writeSkill(dir, 'fancy', { name: 'fancy', description: 'Has model', model: 'opus', effort: 'high' });

  const report = collectModelFields(await listSkillFolders(dir));
  assert.equal(report.length, 1);
  assert.equal(report[0].name, 'fancy');
  assert.deepEqual(report[0].fields, { model: 'opus', effort: 'high' });
});

test('syncSkillFolders copies new, backs up overwrites, preserves unrelated skills', async (t) => {
  const sourceDir = await tmp('sync-skill-src-');
  const targetDir = await tmp('sync-skill-tgt-');
  const home = await tmp('sync-skill-home-');
  t.after(() => Promise.all([
    rm(sourceDir, { recursive: true, force: true }),
    rm(targetDir, { recursive: true, force: true }),
    rm(home, { recursive: true, force: true }),
  ]));

  await writeSkill(sourceDir, 'alpha', { name: 'alpha', description: 'New skill' }, 'NEW alpha');
  await writeSkill(sourceDir, 'beta', { name: 'beta', description: 'Updated' }, 'NEW beta');

  // Pre-existing target: an old "beta" (to be overwritten) and an unrelated "gamma".
  await writeSkill(targetDir, 'beta', { name: 'beta', description: 'Old' }, 'OLD beta');
  await writeSkill(targetDir, 'gamma', { name: 'gamma', description: 'Keep me' }, 'gamma');

  const result = await syncSkillFolders({ sourceDir, targetDir, home });

  assert.deepEqual(result.copied, ['alpha']);
  assert.deepEqual(result.overwritten, ['beta']);
  assert.equal(result.backups.length, 1);

  // alpha copied, beta updated to new content, gamma preserved.
  const names = (await readdir(targetDir)).sort();
  assert.deepEqual(names, ['alpha', 'beta', 'gamma']);
  assert.match(await readFile(path.join(targetDir, 'beta', 'SKILL.md'), 'utf-8'), /NEW beta/);
  assert.match(await readFile(path.join(targetDir, 'gamma', 'SKILL.md'), 'utf-8'), /gamma/);

  // The backup under the injected home holds the OLD beta content.
  const backupRoot = path.join(home, '.sync-skill', 'backup');
  assert.match(await readFile(path.join(result.backups[0], 'SKILL.md'), 'utf-8'), /OLD beta/);
  assert.ok(result.backups[0].startsWith(backupRoot));
});

test('syncSkillFolders honours the selected subset', async (t) => {
  const sourceDir = await tmp('sync-skill-sel-src-');
  const targetDir = await tmp('sync-skill-sel-tgt-');
  t.after(() => Promise.all([
    rm(sourceDir, { recursive: true, force: true }),
    rm(targetDir, { recursive: true, force: true }),
  ]));

  await writeSkill(sourceDir, 'one', { name: 'one', description: 'one' });
  await writeSkill(sourceDir, 'two', { name: 'two', description: 'two' });

  const result = await syncSkillFolders({ sourceDir, targetDir, selected: ['two'] });
  assert.deepEqual(result.copied, ['two']);
  assert.deepEqual((await readdir(targetDir)).sort(), ['two']);
});
