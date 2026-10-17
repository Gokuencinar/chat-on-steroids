import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { RECOMMENDED_SKILLS } from '../shared/recommended-skills.js';
import { ECC_COMPLETE_PACK, ECC_PACK, ECC_SKILLS } from '../shared/ecc-skills.js';
import { ECC_CATALOG } from '../shared/ecc-catalog.js';
import type { ManagedSkill } from '../shared/skills.js';
import { verifiedBundledEccSkillSource } from './ecc-catalog.js';
import { importSkillPackage, importSkillPackages, listManagedSkills } from './skills.js';

export interface RecommendedSkillEntry { id: string; name: string; description: string; installed: boolean; members?: string[] }

const installingPacks = new Map<string, Promise<ManagedSkill[]>>();

export async function listRecommendedSkills(): Promise<RecommendedSkillEntry[]> {
  const installed = new Set((await listManagedSkills()).map(skill => skill.id));
  return [
    ...RECOMMENDED_SKILLS.map(({ id, name, description }) => ({ id, name, description, installed: installed.has(id) })),
    { ...ECC_PACK, installed: ECC_SKILLS.every(skill => installed.has(skill.id)), members: ECC_SKILLS.map(skill => skill.id) },
    { ...ECC_COMPLETE_PACK, installed: [...ECC_SKILLS, ...ECC_CATALOG].every(skill => installed.has(skill.id)),
      members: [...ECC_SKILLS, ...ECC_CATALOG].map(skill => skill.id) }
  ];
}

/** Installs through the ordinary validated package import, from a private temporary folder. */
async function installOne(skill: (typeof RECOMMENDED_SKILLS)[number]): Promise<void> {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'cos-recommended-skill-'));
  try {
    const folder = path.join(temporary, skill.id);
    await fs.mkdir(folder);
    await fs.writeFile(path.join(folder, 'SKILL.md'), skill.markdown, { flag: 'wx', mode: 0o600 });
    await importSkillPackage(folder);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

/** ECC workflows install only on request, without replacing any existing user-owned skill. */
export async function installRecommendedSkill(id: string): Promise<ManagedSkill[]> {
  if (id === ECC_PACK.id || id === ECC_COMPLETE_PACK.id) {
    const running = installingPacks.get(id);
    if (running) return running;
    const installing = (async () => {
      // Stage only our exact in-memory workflows in an isolated temporary root.
      // The managed-library batch owner performs the *authoritative* validation,
      // capacity check and collision preflight under the same serial lock as
      // standalone imports. No requested item overwrites an existing package.
      const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'cos-ecc-pack-'));
      try {
        const sources: Array<{ sourcePath: string; sha256: string }> = [];
        for (const skill of ECC_SKILLS) {
          const folder = path.join(temporary, skill.id);
          await fs.mkdir(folder);
          await fs.writeFile(path.join(folder, 'SKILL.md'), skill.markdown, { flag: 'wx', mode: 0o600 });
          sources.push({ sourcePath: folder, sha256: createHash('sha256').update(skill.markdown).digest('hex') });
        }
        if (id === ECC_COMPLETE_PACK.id) {
          // Validate all 25 bundled SKILL.md files *before* attempting the batch.
          // The serialized importer checks the revisions again before publication.
          for (const skill of ECC_CATALOG) sources.push(await verifiedBundledEccSkillSource(skill.id));
        }
        return await importSkillPackages(sources);
      } finally {
        await fs.rm(temporary, { recursive: true, force: true });
      }
    })();
    installingPacks.set(id, installing);
    void installing.finally(() => { if (installingPacks.get(id) === installing) installingPacks.delete(id); }).catch(() => undefined);
    return installing;
  }
  const skill = RECOMMENDED_SKILLS.find(entry => entry.id === id);
  if (!skill) throw new Error('Unknown recommended skill');
  await installOne(skill);
  return listManagedSkills();
}
