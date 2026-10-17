import { afterEach, beforeEach, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeTempDir } from './helpers.js';
import { importSkillPackage, initSkillsPath, listManagedSkills } from '../src/main/skills.js';
import { installRecommendedSkill, listRecommendedSkills } from '../src/main/recommended-skills.js';
import { RECOMMENDED_SKILLS } from '../src/shared/recommended-skills.js';
import { ECC_COMPLETE_PACK, ECC_PACK, ECC_SKILLS } from '../src/shared/ecc-skills.js';
import { ECC_CATALOG } from '../src/shared/ecc-catalog.js';
import { MAX_SKILLS, MAX_SKILL_DESCRIPTION_CHARS, MAX_SKILL_NAME_CHARS, SKILL_ID_PATTERN } from '../src/shared/skills.js';

let root: string;
beforeEach(async () => { root = await makeTempDir(); await initSkillsPath(root); });
afterEach(async () => { await removeTempDir(root); });

it('ships well-formed recommended skills with unique ids', () => {
  expect(new Set(RECOMMENDED_SKILLS.map(skill => skill.id)).size).toBe(RECOMMENDED_SKILLS.length);
  for (const skill of RECOMMENDED_SKILLS) {
    expect(skill.id).toMatch(SKILL_ID_PATTERN);
    expect(skill.name.length).toBeLessThanOrEqual(MAX_SKILL_NAME_CHARS);
    expect(skill.description.length).toBeLessThanOrEqual(MAX_SKILL_DESCRIPTION_CHARS);
    expect(skill.markdown.startsWith(`---\nname: ${JSON.stringify(skill.name)}\ndescription: ${JSON.stringify(skill.description)}\n---\n`)).toBe(true);
  }
});

it('installs a recommended skill only on request, with its own metadata, and reports it as installed', async () => {
  expect((await listRecommendedSkills()).every(entry => !entry.installed)).toBe(true);
  expect(await listManagedSkills()).toEqual([]);
  const skills = await installRecommendedSkill('code-review');
  expect(skills.map(skill => [skill.id, skill.name])).toEqual([['code-review', 'Code review']]);
  expect((await listRecommendedSkills()).find(entry => entry.id === 'code-review')?.installed).toBe(true);
  await expect(installRecommendedSkill('code-review')).rejects.toThrow();
  await expect(installRecommendedSkill('not-a-skill')).rejects.toThrow('Unknown recommended skill');
});

it('installs every recommended skill with its exact name and description (#561)', async () => {
  // Six descriptions contain ": ", which unquoted YAML read as a nested mapping, so their
  // Install button failed with "bad indentation of a mapping entry".
  for (const recommended of RECOMMENDED_SKILLS) await installRecommendedSkill(recommended.id);
  const installed = new Map((await listManagedSkills()).map(skill => [skill.id, skill]));
  for (const recommended of RECOMMENDED_SKILLS) {
    expect(installed.get(recommended.id)).toMatchObject({ name: recommended.name, description: recommended.description });
  }
});

it('installs the optional ECC pack with working metadata and without duplicate imports', async () => {
  const before = (await listRecommendedSkills()).find(entry => entry.id === ECC_PACK.id);
  expect(before).toMatchObject({ installed: false, members: ECC_SKILLS.map(skill => skill.id) });
  expect(new Set(ECC_SKILLS.map(skill => skill.id)).size).toBe(ECC_SKILLS.length);
  const skills = await installRecommendedSkill(ECC_PACK.id);
  expect(skills.map(skill => skill.id).sort()).toEqual(ECC_SKILLS.map(skill => skill.id).sort());
  expect((await listRecommendedSkills()).find(entry => entry.id === ECC_PACK.id)?.installed).toBe(true);
  for (const expected of ECC_SKILLS) {
    const actual = skills.find(skill => skill.id === expected.id);
    expect(actual).toMatchObject({ name: expected.name, description: expected.description });
    expect(expected.markdown).toContain('https://github.com/affaan-m/ECC');
  }
  const again = await installRecommendedSkill(ECC_PACK.id);
  expect(again).toEqual(skills);
});

it('keeps a user-owned Skill intact when the ECC pack includes its id', async () => {
  const staging = await makeTempDir();
  try {
    const folder = path.join(staging, 'ecc-search-first');
    await fs.mkdir(folder);
    await fs.writeFile(path.join(folder, 'SKILL.md'), '---\nname: "Custom search"\ndescription: "My own research instructions"\n---\n\n# Private workflow\n');
    await importSkillPackage(folder);
    const original = (await listManagedSkills()).find(skill => skill.id === 'ecc-search-first');
    expect(original).toBeDefined();
    const installed = await installRecommendedSkill(ECC_PACK.id);
    expect(installed).toHaveLength(ECC_SKILLS.length);
    expect(installed.find(skill => skill.id === original!.id)).toEqual(original);
    expect((await fs.readFile(path.join(root, 'skills', original!.id, 'SKILL.md'), 'utf8'))).toContain('# Private workflow');
  } finally {
    await removeTempDir(staging);
  }
});

it('coalesces simultaneous ECC pack installations into one import', async () => {
  const [first, second] = await Promise.all([
    installRecommendedSkill(ECC_PACK.id), installRecommendedSkill(ECC_PACK.id)
  ]);
  expect(first).toEqual(second);
  expect(first).toHaveLength(ECC_SKILLS.length);
});

it('preflights orphan ECC folders without partially installing the pack', async () => {
  await fs.mkdir(path.join(root, 'skills', ECC_SKILLS[4]!.id));
  await expect(installRecommendedSkill(ECC_PACK.id)).rejects.toThrow('already exists');
  expect(await listManagedSkills()).toEqual([]);
});

it('offers a separate complete pack and installs all 8 + 25 through the verified sources, idempotently', async () => {
  const all = [...ECC_SKILLS, ...ECC_CATALOG].map(skill => skill.id);
  expect(new Set(all).size).toBe(33);
  const offered = await listRecommendedSkills();
  expect(offered.find(item => item.id === ECC_COMPLETE_PACK.id))
    .toMatchObject({ installed: false, members: all });
  const initial = await installRecommendedSkill(ECC_COMPLETE_PACK.id);
  expect(initial.map(skill => skill.id).sort()).toEqual([...all].sort());
  expect((await listRecommendedSkills()).find(item => item.id === ECC_COMPLETE_PACK.id)?.installed).toBe(true);
  const actual = await fs.readFile(path.join(root, 'skills', 'i18n-sync', 'SKILL.md'), 'utf8');
  expect(actual).toContain('CoS compatibility');
  expect(await installRecommendedSkill(ECC_COMPLETE_PACK.id)).toEqual(initial);
  expect(await installRecommendedSkill(ECC_PACK.id)).toEqual(initial);
});

it('adds only missing ECC Skills after the original 8-pack and preserves customized Skills', async () => {
  await installRecommendedSkill(ECC_PACK.id);
  const custom = '---\nname: "My custom review"\ndescription: "Personal instructions"\n---\n\n# Private user content\n';
  const customRoot = await makeTempDir();
  try {
    const folder = path.join(customRoot, 'click-path-audit');
    await fs.mkdir(folder); await fs.writeFile(path.join(folder, 'SKILL.md'), custom);
    await importSkillPackage(folder);
    const done = await installRecommendedSkill(ECC_COMPLETE_PACK.id);
    expect(done).toHaveLength(33);
    expect(await fs.readFile(path.join(root, 'skills', 'click-path-audit', 'SKILL.md'), 'utf8')).toBe(custom);
    expect(done.find(skill => skill.id === 'click-path-audit')?.name).toBe('My custom review');
  } finally { await removeTempDir(customRoot); }
});

it('refuses the complete pack before any write if 33 imports cannot fit the 64-Skill cap', async () => {
  for (let i = 0; i < MAX_SKILLS - 32; i++) {
    const id = `my-${String(i).padStart(2, '0')}`;
    const folder = path.join(root, 'skills', id);
    await fs.mkdir(folder);
    await fs.writeFile(path.join(folder, 'SKILL.md'), `---\nname: "${id}"\ndescription: "Custom item ${i}"\n---\n`);
  }
  const before = await fs.readdir(path.join(root, 'skills'));
  await expect(installRecommendedSkill(ECC_COMPLETE_PACK.id)).rejects.toThrow('Not enough room');
  expect(await fs.readdir(path.join(root, 'skills'))).toEqual(before);
});

it('refuses orphan ECC folders before creating any workflows or approved Skills', async () => {
  await fs.mkdir(path.join(root, 'skills', 'i18n-sync'));
  await expect(installRecommendedSkill(ECC_COMPLETE_PACK.id)).rejects.toThrow('already exists');
  expect(await fs.readdir(path.join(root, 'skills'))).toEqual(['i18n-sync']);
});

it('serializes simultaneous basic and complete packs without overwriting or duplicating anything', async () => {
  const [basic, full] = await Promise.all([
    installRecommendedSkill(ECC_PACK.id), installRecommendedSkill(ECC_COMPLETE_PACK.id)
  ]);
  expect(full).toHaveLength(33);
  expect(basic.length).toBeGreaterThanOrEqual(8);
  expect((await listManagedSkills()).length).toBe(33);
});
