import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ECC_SKILLS } from '../src/shared/ecc-skills.js';
import { ECC_CATALOG } from '../src/shared/ecc-catalog.js';

const base = path.resolve('resources/ecc/v2.2.3');
const digest = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
type Entry = { id: string; source: 'skills' | 'workflows'; sha256: string };
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'install-manifest.json'), 'utf8')) as {
  format: string; entries: Entry[];
};

describe('public ECC import pack', () => {
  it('contains exactly 8 CoS workflows, 25 reviewed ECC Skills and opt-in /ecc-all', () => {
    expect(manifest.format).toBe('cos-ecc-v2.2.3-v1');
    const ids = new Set([...ECC_SKILLS, ...ECC_CATALOG].map(skill => skill.id));
    ids.add('ecc-all');
    expect(manifest.entries).toHaveLength(34);
    expect(new Set(manifest.entries.map(entry => entry.id))).toEqual(ids);
    expect(fs.readdirSync(path.join(base, 'skills')).sort()).toEqual(ECC_CATALOG.map(skill => skill.id).sort());
    expect(fs.readdirSync(path.join(base, 'workflows')).sort()).toEqual(['ecc-all', ...ECC_SKILLS.map(skill => skill.id)].sort());
  });

  it('pins every byte and keeps reviewed source docs unchanged', () => {
    for (const entry of manifest.entries) {
      expect(entry.source).toBe(entry.id === 'ecc-all' || entry.id.startsWith('ecc-') ? 'workflows' : 'skills');
      const folder = path.join(base, entry.source, entry.id);
      expect(fs.readdirSync(folder)).toEqual(['SKILL.md']);
      const bytes = fs.readFileSync(path.join(folder, 'SKILL.md'));
      expect(digest(bytes)).toBe(entry.sha256);
      const reviewed = ECC_CATALOG.find(item => item.id === entry.id);
      if (reviewed) expect(entry.sha256).toBe(reviewed.sha256);
      const workflow = ECC_SKILLS.find(item => item.id === entry.id);
      if (workflow) expect(bytes.toString('utf8')).toBe(workflow.markdown);
    }
    expect(fs.readFileSync(path.join(base, 'workflows/ecc-all/SKILL.md')))
      .toEqual(fs.readFileSync('docs/ecc-all/SKILL.md'));
  });
});
