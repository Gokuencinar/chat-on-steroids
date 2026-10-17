/** Import only a source-pinned ECC skill independently verified for CoS. */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ECC_CATALOG } from '../shared/ecc-catalog.js';
import { importSkillPackage, listManagedSkills } from './skills.js';
import type { ManagedSkill } from '../shared/skills.js';

/**
 * The catalog is an affirmative allowlist, not all 293 ECC source packages.
 * Untrusted IDs, changed content and linked packages are rejected before import.
 */
export async function verifiedBundledEccSkillSource(id: string): Promise<{ sourcePath: string; sha256: string }> {
  const entry = ECC_CATALOG.find(item => item.id === id && item.compatibility === 'verified');
  if (!entry) throw new Error('ECC skill is not verified for CoS');
  const packaged = process.resourcesPath
    ? path.join(process.resourcesPath, 'ecc', 'v2.2.3', 'skills') : '';
  const development = path.resolve('resources', 'ecc', 'v2.2.3', 'skills');
  // Electron development's resourcesPath points into the Electron runtime, not CoS.
  const base = packaged && await fs.stat(packaged).then(stat => stat.isDirectory(), () => false)
    ? packaged : development;
  const folder = path.join(base, id);
  const file = path.join(folder, 'SKILL.md');
  const folderInfo = await fs.lstat(folder);
  if (!folderInfo.isDirectory() || folderInfo.isSymbolicLink() ||
      (await fs.realpath(folder)).toLowerCase() !== path.resolve(folder).toLowerCase())
    throw new Error('Bundled ECC package contains a linked folder');
  const children = (await fs.readdir(folder)).sort();
  if (children.length !== 1 || children[0] !== 'SKILL.md')
    throw new Error('Bundled ECC skill contains unreviewed files');
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Bundled ECC skill is invalid');
  const digest = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  if (digest !== entry.sha256) throw new Error('Bundled ECC skill differs from the pinned source');
  return { sourcePath: folder, sha256: digest };
}

export async function importBundledEccSkill(id: string): Promise<ManagedSkill[]> {
  const { sourcePath } = await verifiedBundledEccSkillSource(id);
  await importSkillPackage(sourcePath);
  return listManagedSkills();
}
