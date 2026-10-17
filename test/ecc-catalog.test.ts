import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ECC_CATALOG, ECC_CATALOG_AUDIT, ECC_CATALOG_REF, eccCatalogUrl } from '../src/shared/ecc-catalog.js';
import { parseGitHubSkillUrl, SKILL_ID_PATTERN } from '../src/shared/skills.js';
import { parseSkillFrontmatter } from '../src/main/skill-metadata.js';
import { makeTempDir, removeTempDir } from './helpers.js';
import { initSkillsPath, listManagedSkills } from '../src/main/skills.js';
import { importBundledEccSkill } from '../src/main/ecc-catalog.js';

const APPROVED = [
  'accessibility',
  'agent-harness-construction',
  'agent-introspection-debugging',
  'ai-first-engineering',
  'ai-regression-testing',
  'api-design',
  'architecture-decision-records',
  'backend-patterns',
  'benchmark-methodology',
  'benchmark-optimization-loop',
  'click-path-audit',
  'coding-standards',
  'content-hash-cache-pattern',
  'contract-first',
  'error-handling',
  'frontend-a11y',
  'frontend-patterns',
  'hexagonal-architecture',
  'i18n-sync',
  'intent-driven-development',
  'iterative-retrieval',
  'kotlin-patterns',
  'living-docs-governance',
  'production-audit',
  'python-patterns'
] as const;
const base = path.resolve('resources', 'ecc', 'v2.2.3', 'skills');
const ADAPTATIONS = {
  'accessibility': 'cos-accessibility',
  'agent-introspection-debugging': 'cos-introspection',
  'ai-regression-testing': 'cos-regression',
  'benchmark-optimization-loop': 'cos-benchmark',
  'click-path-audit': 'cos-click-path',
  'i18n-sync': 'cos-i18n'
} as const;

describe('ECC compatibility-gated catalog', () => {
  it('exposes exactly 25 individually source-pinned CoS-compatible skills', () => {
    expect(ECC_CATALOG_REF).toBe('v2.2.3');
    expect(ECC_CATALOG.map(skill => skill.id)).toEqual(APPROVED);
    expect(new Set(ECC_CATALOG.map(skill => skill.id)).size).toBe(APPROVED.length);
    for (const skill of ECC_CATALOG) {
      expect(skill.id).toMatch(SKILL_ID_PATTERN);
      expect(skill.curated).toBe(true);
      expect(skill.compatibility).toBe('verified');
      expect(skill.compatibilityReason.length).toBeGreaterThan(30);
      expect(skill.name).toBe(skill.id);
      expect(skill.description.trim().length).toBeGreaterThan(0);
      expect(skill.description.length).toBeLessThanOrEqual(240);
      expect(skill.sha256).toMatch(/^[a-f0-9]{64}$/);
      if (skill.adaptation) {
        expect(ADAPTATIONS[skill.id as keyof typeof ADAPTATIONS]).toBe(skill.adaptation);
        expect(skill.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(skill.sourceSha256).not.toBe(skill.sha256);
      } else {
        expect(skill.sourceSha256).toBeUndefined();
      }
    }
  });

  it('accounts for every upstream source candidate and documents conservative exclusion reasons', () => {
    expect(ECC_CATALOG_AUDIT).toMatchObject({
      sourceSkills: 293,
      upstreamPiCoreSkills: 123,
      upstreamPiCoreOriginalOverlap: 122,
      verifiedForCos: 25,
      excludedBeforeCatalog: 268,
      verifiedWithinPiCore: 21,
      verifiedOutsidePiCore: 4,
      excludedByPiCuration: 167,
      piPortableButNotCosVerified: 101
    });
    expect(ECC_CATALOG_AUDIT.excludedByPiCuration + ECC_CATALOG_AUDIT.piPortableButNotCosVerified)
      .toBe(ECC_CATALOG_AUDIT.excludedBeforeCatalog);
    expect(ECC_CATALOG_AUDIT.excludedExamples['continuous-learning-v2']).toMatch(/hook/i);
    expect(ECC_CATALOG_AUDIT.excludedExamples['verification-loop']).toMatch(/Windows/i);
    expect(ECC_CATALOG_AUDIT.excludedExamples['agentic-engineering']).toMatch(/Haiku/i);
    expect(ECC_CATALOG_AUDIT.excludedExamples['security-review']).toMatch(/platform/i);
    for (const id of Object.keys(ECC_CATALOG_AUDIT.excludedExamples)) {
      expect(ECC_CATALOG.some(skill => skill.id === id)).toBe(false);
    }
  });

  it('produces only revision-pinned official URLs, rejects unknown IDs before dispatch', () => {
    for (const skill of ECC_CATALOG) {
      expect(parseGitHubSkillUrl(eccCatalogUrl(skill.id))).toMatchObject({
        owner: 'affaan-m', repository: 'ECC', ref: 'v2.2.3', directory: `skills/${skill.id}`
      });
    }
    expect(() => eccCatalogUrl('verification-loop')).toThrow('not verified');
    expect(() => eccCatalogUrl('../unsafe')).toThrow('not verified');
  });

  it('bundles exactly the allowed one-file Skills with pinned original or reviewed adapted bytes', () => {
    expect(readdirSync(base).sort()).toEqual(APPROVED);
    for (const skill of ECC_CATALOG) {
      const folder = path.join(base, skill.id);
      expect(readdirSync(folder)).toEqual(['SKILL.md']);
      expect(statSync(folder).isDirectory()).toBe(true);
      const file = path.join(folder, 'SKILL.md');
      const bytes = readFileSync(file);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(skill.sha256);
      expect(bytes.length).toBeLessThan(128_000);
      expect(parseSkillFrontmatter(bytes.toString('utf8'))).not.toBeNull();
      const text = bytes.toString('utf8');
      expect(text).not.toMatch(/\]\(\.\.\/|\]\(\.\/|\$\{CLAUDE_PLUGIN_ROOT\}/);
      if (skill.id === 'i18n-sync') {
        expect(text).toContain('## CoS compatibility');
        expect(text).not.toContain('## Hook Integration');
      }
      if (skill.id === 'ai-regression-testing') {
        expect(text).toContain('## Integrating Tests into the CoS Review Workflow');
        expect(text).not.toContain('.claude/commands/bug-check.md');
      }
      if (skill.id === 'agent-introspection-debugging') {
        expect(text).toContain('## Integration with CoS');
        expect(text).not.toContain('`verification-loop`');
        expect(text).not.toContain('`continuous-learning-v2`');
        expect(text).not.toContain('`workspace-surface-audit`');
      }
      if (skill.id === 'click-path-audit') {
        expect(text).toContain('### CoS execution');
        expect(text).not.toContain('Agent 8:');
        expect(text).not.toContain('/superpowers:');
      }
      if (skill.id === 'benchmark-optimization-loop') {
        expect(text).toContain('Use only currently authorized CoS Core');
        expect(text).not.toContain('tools: Read, Write, Edit, Bash, Grep, Glob');
      }
      if (skill.id === 'accessibility') {
        expect(text).toContain('It does not certify WCAG conformance');
        expect(text).toContain('Focus Appearance is SC 2.4.13');
        expect(text).not.toContain('- `liquid-glass-design`');
      }
      if (skill.id === 'living-docs-governance') {
        expect(text).toContain('# Living Docs Governance');
        expect(skill.adaptation).toBeUndefined();
      }
    }
  });

  it('regenerates byte-for-byte from the pinned checkout when source is present', () => {
    const source = path.resolve('..', 'ECC-2.2.3-source');
    // CI can verify the pinned shipped hashes without cloning upstream; in the
    // user's development workspace also verify inventory and generator output.
    if (!existsSync(path.join(source, 'pi', 'core', 'CURATION.md'))) return;
    expect(() => execFileSync(process.execPath, [
      path.resolve('scripts', 'generate-ecc-catalog.mjs'), source, '--check'
    ], { cwd: process.cwd(), timeout: 20_000 })).not.toThrow();
    for (const skill of ECC_CATALOG) {
      const sourceFile = path.join(source, 'skills', skill.id, 'SKILL.md');
      const hash = createHash('sha256').update(readFileSync(sourceFile)).digest('hex');
      expect(hash).toBe(skill.sourceSha256 ?? skill.sha256);
    }
  });
});

let workspace: string | null = null;
afterEach(async () => { if (workspace) { await removeTempDir(workspace); workspace = null; } });

it('imports an approved skill and blocks unverified packages through the main import API', async () => {
  workspace = await makeTempDir();
  await initSkillsPath(workspace);
  const installed = await importBundledEccSkill('agent-harness-construction');
  expect(installed).toHaveLength(1);
  expect(installed[0]).toMatchObject({ id: 'agent-harness-construction', origin: null });
  expect((await listManagedSkills())[0]?.id).toBe('agent-harness-construction');
  const adapted = await importBundledEccSkill('i18n-sync');
  expect(adapted.map(item => item.id)).toEqual(['agent-harness-construction', 'i18n-sync']);
  const extra = await importBundledEccSkill('click-path-audit');
  expect(extra.map(item => item.id)).toEqual(['agent-harness-construction', 'click-path-audit', 'i18n-sync']);
  for (const denied of ['hookify-rules', 'verification-loop', 'security-review', 'continuous-learning-v2', '../invalid']) {
    await expect(importBundledEccSkill(denied)).rejects.toThrow('not verified for CoS');
  }
});
