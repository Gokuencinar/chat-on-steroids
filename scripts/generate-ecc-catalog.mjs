/**
 * Generate the ONLY ECC v2.2.3 skills explicitly audited for native CoS.
 * No network, runtime hook, installer, or external command is ever executed.
 *
 * Usage: node scripts/generate-ecc-catalog.mjs /path/to/ECC-2.2.3-source [--check]
 * SPDX-License-Identifier: MIT; source attribution: Affaan Mustafa © 2026.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Positive, human-reviewed allowlist. Do not expand this set from pi/core by
 * inference: pi/core's offline Pi portability does NOT prove native CoS safety.
 * Each entry pins the exact upstream one-file skill. Explicit text-only CoS
 * adaptations have separate bundled hashes; no Claude hooks/scripts ship.
 */
const APPROVED = Object.freeze({
  'accessibility': {
    sha256: '2762f21d09d199009ed4f95b28c911436b367c30963dc5ddb48b8e1ad7fc1585',
    reason: 'Web, iOS and Android accessibility examples; adapted to avoid false WCAG certification or unavailable related-Skill assumptions.',
    adaptation: 'cos-accessibility'
  },
  'agent-introspection-debugging': {
    sha256: '0cdbfe3c822ff50d21df8cd0e20c72407a6f5658089edc0e96e79a03927cb956',
    reason: 'Failure capture, root-cause diagnosis and recovery through current CoS evidence; replaces unbundled ECC related-workflow references.',
    adaptation: 'cos-introspection'
  },
  'ai-regression-testing': {
    sha256: '83f2f5c4083af5762dd658f742d4a390eb3a6f969d835f69e8f47efba296c127',
    reason: 'Regression test and parity methodology; Claude command example is rewritten as an explicit CoS workflow.',
    adaptation: 'cos-regression'
  },
  'agent-harness-construction': {
    sha256: 'e7fb390a6663b46ea5d3c2876753a5ce32ba3bad1889686b21a42894caa1742d',
    reason: 'Pure tool-schema, observation, recovery and context-design guidance; uses no external runner.'
  },
  'ai-first-engineering': {
    sha256: '114913bdcb6127392df56d96f7f1312f36c74d69c278dece6d377b9bd92123a5',
    reason: 'Process and review checklist only; no provider-specific commands or automated lifecycle.'
  },
  'api-design': {
    sha256: '250e464413a13c0eb93cc73447b423df1f9aa8e4f80e5e68c41f895b2c33e352',
    reason: 'REST design, schemas, authorization and pagination examples require no provider runtime.'
  },
  'architecture-decision-records': {
    sha256: '263b20e81801aa5fa7e75eaec6c38345c0ac028ca0edbd67b1b9071c5fcbe11f',
    reason: 'Local Markdown ADR format and opt-in documentation procedure; no executable dependency.'
  },
  'backend-patterns': {
    sha256: '9b983d0297a983110fdfda8dce55d19b750ca3e53ef155d75a3eff740d3874b8',
    reason: 'Backend architecture patterns and example code; no required service or runner.'
  },
  'benchmark-optimization-loop': {
    sha256: 'f11208b6a86bc311cfbd9e20688a189238fda6c1e03b6f8000ef9e55487f6f95',
    reason: 'Bounded measured optimization; replaces Claude Bash tool metadata with CoS existing-tool and authorization guidance.',
    adaptation: 'cos-benchmark'
  },
  'benchmark-methodology': {
    sha256: 'f24585262b9c3e106dc27d45f75c4b965501680a16ff6dc5a9995a53322549df',
    reason: 'Evidence-based comparison and scoring framework; sources are evaluated with existing research tools.'
  },
  'coding-standards': {
    sha256: 'e80544c3d1eac5b14f22022146bd91a6b0ecc30e099cf5181894853aeb81dee1',
    reason: 'Language conventions and maintainability patterns; no automatic lint hook.'
  },
  'click-path-audit': {
    sha256: '662fc5d02483bcd8ff799d6d3109a38da673182341cfc14445e9076fcd920162',
    reason: 'UI handler/state transition tracing; adapts eight-worker and unavailable Superpowers commands to CoS bounded review.',
    adaptation: 'cos-click-path'
  },
  'contract-first': {
    sha256: '3eaacf16a9bbd92888659e9c1e15b0fa4eb96a41c257dd9e08f2e63b824f0cea',
    reason: 'Contract ownership, schemas and existing project-generator guidance; no new generator is installed.'
  },
  'content-hash-cache-pattern': {
    sha256: 'c0242ee2fcb5c096d0625cb6957481fce2266e92985036795f5b5c13c329d802',
    reason: 'Self-contained Python standard-library cache pattern; examples are inert, no installation.'
  },
  'error-handling': {
    sha256: 'e8eec6756c950b570486493e64e3bf14c12baf6bf0858bf3928097fe2bfeaf79',
    reason: 'Cross-language typed error, cleanup, retry and result examples; no integration requirement.'
  },
  'frontend-a11y': {
    sha256: 'e00991a3f4d47fcf1529dd74a080afcf46137dc5061e70dc6e3da7b27f2ae3f3',
    reason: 'Semantic HTML, ARIA and accessible form guidance; existing DOM/tests suffice.'
  },
  'frontend-patterns': {
    sha256: 'a5b971eb9e74cd763c7e3308bfd888e0d9cf69f8b88477659889d77182479740',
    reason: 'Frontend composition, state and rendering patterns implemented with project dependencies.'
  },
  'hexagonal-architecture': {
    sha256: '1579f70e4cd5a2dde39d29a2055d18b39f06b063a308d3b43a498900c99495b7',
    reason: 'Framework-independent architecture/testing pattern; no required CLI, model, or hook.'
  },
  'i18n-sync': {
    sha256: '05fc3e2ae72c2f55cc44fa0e9531688c1112081037d628e1124fd5bf40825325',
    reason: 'Safe locale synchronization; optional upstream hook and sibling links are replaced by explicit CoS guidance.',
    adaptation: 'cos-i18n'
  },
  'intent-driven-development': {
    sha256: 'e34045f7b3bf6a6fbd364f85c7bc81d8208e18bb929ceff80bbc987f78aadea8',
    reason: 'Observable acceptance criteria and risk decisions using ordinary project read/plan tools.'
  },
  'iterative-retrieval': {
    sha256: 'b453b16d3e36174b8487c05ab807d0321a66c2d058812b2ae129d82824183725',
    reason: 'Dispatch/evaluate/refine/retrieve strategy with current repository search and read tools.'
  },
  'kotlin-patterns': {
    sha256: 'e519234772a3697763ad484908d180c4c653439fea75a56c03440c272f9f0896',
    reason: 'Kotlin and Gradle idioms; examples apply when target project already uses Kotlin.'
  },
  'living-docs-governance': {
    sha256: 'e8c22a1f69743e256c6d6df138d99e49d22e29effbf008dfe2328b7fdc76247e',
    reason: 'Self-contained documentation ownership/governance method; explicitly follows the active harness, no automatic hooks.'
  },
  'production-audit': {
    sha256: '3ab3dd8a364ee17566e9361f0ebed2aec3b3146ede44e1db0a72c5ceae1ca0a4',
    reason: 'Local release, CI, security and rollback audit with explicit evidence and no external scanner.'
  },
  'python-patterns': {
    sha256: '103e0130dac33a49d26705fc5a2df804980fcab6a0138d65bc7f370a987d49f6',
    reason: 'Python implementation conventions and examples; optional developer tools are not automatically installed.'
  }
});

/** Deterministic, reviewed editorial deltas, applied only after the source SHA check. */
function replaceOnce(text, from, to, id) {
  if (text.split(from).length !== 2) throw new Error(`ECC ${id} adaptation anchor changed`);
  return text.replace(from, to);
}
function adaptForCos(id, original) {
  if (id === 'agent-introspection-debugging') {
    const bounded = replaceOnce(original,
      '- feature verification after code changes; use `verification-loop`',
      '- feature verification after code changes; use the existing CoS `/ecc-verification` Skill if installed, otherwise run the project checks directly', id);
    return replaceOnce(bounded,
      ['## Integration with ECC', '', '- Use `verification-loop` after recovery if code was changed.',
        '- Use `continuous-learning-v2` when the failure pattern is worth turning into an instinct or later skill.',
        '- Use `council` when the issue is not technical failure but decision ambiguity.',
        '- Use `workspace-surface-audit` if the failure came from conflicting local state or repo drift.'].join('\n'),
      ['## Integration with CoS', '',
        '- For code changes, run the relevant project tests and existing CoS `/ecc-verification` workflow when installed.',
        '- Capture recurring lessons in project documentation only with the user\'s authorization; this Skill does not invoke automatic learning.',
        '- For ambiguity, clarify the decision using the current task and project evidence.',
        '- For local state drift, inspect the actual approved workspace and live tool/session ownership.',
        '- No hidden agent reset, background observer or additional tool permission is provided.'].join('\n'), id);
  }
  if (id === 'click-path-audit') {
    let adapted = replaceOnce(original,
      ['- **Full app audit:** Use when launching or after major refactor. Launch parallel agents per page.',
        '- **Single page audit:** Use after building a new page or after a user reports a broken button.',
        '- **Store-focused audit:** Use after modifying a Zustand store — audit all consumers of the changed actions.',
        '',
        '### Recommended agent split for full app:',
        '',
        '```',
        'Agent 1: Map ALL state stores (Step 1) — this is shared context for all other agents',
        'Agent 2: Dashboard (Tasks, Notes, Journal, Ideas)',
        'Agent 3: Chat (DanteChatColumn, JustChatPage)',
        'Agent 4: Emails (ThreadList, DraftArea, EmailsPage)',
        'Agent 5: Projects (ProjectsPage, ProjectOverviewTab, NewProjectWizard)',
        'Agent 6: CRM (all sub-tabs)',
        'Agent 7: Profile, Settings, Vault, Notifications',
        'Agent 8: Management Suite (all pages)',
        '```',
        '',
        'Agent 1 MUST complete first. Its output is input for all other agents.'].join('\n'),
      ['- **Full app audit:** Scope it before launch or a major refactor; inspect state ownership first and then review bounded UI areas.',
        '- **Single page audit:** Inspect one page after a refactor or a reported broken button.',
        '- **Store-focused audit:** Inspect every caller of a changed shared-state action.',
        '',
        '### CoS execution',
        '',
        'Map the actual store actions with Core read/search first. If CoS `agents` is enabled, delegate',
        'independent UI areas to the available workers, respecting the session\'s concurrency limit.',
        'Reuse the initial state map as read-only input, assign one owner per edited file, and verify',
        'each reported path yourself. Use Desktop/browser interaction only when those tools are',
        'connected, currently permitted, and suitable for the selected test environment.',
        'A static trace alone is a hypothesis about runtime behavior, not proof of a reproduced bug.'].join('\n'), id);
    adapted = replaceOnce(adapted,
      ['## Integration with Other Skills', '',
        '- Run AFTER `/superpowers:systematic-debugging` (which finds the other 54 bug types)',
        '- Run BEFORE `/superpowers:verification-before-completion` (which verifies fixes work)',
        '- Feeds into `/superpowers:test-driven-development` — every bug found here should get a test'].join('\n'),
      ['## Integration with CoS Verification', '',
        '- Reproduce and narrow failures with existing CoS read/search/debugging tools.',
        '- When a fix is authorized, add a focused regression test where meaningful.',
        '- Verify behavior and report actual test results using existing CoS Core capabilities.',
        '- This Skill does not install Superpowers commands, plugins or automatic browser tests.'].join('\n'), id);
    return adapted;
  }
  if (id === 'benchmark-optimization-loop') {
    let adapted = replaceOnce(original,
      'tools: Read, Write, Edit, Bash, Grep, Glob\n', '', id);
    adapted = replaceOnce(adapted,
      '# Benchmark Optimization Loop\n',
      ['# Benchmark Optimization Loop', '',
        'Use only currently authorized CoS Core read, patch and terminal tools.',
        'These instructions do not enable Bash, extra permissions, a benchmark runner',
        'or background execution. Work in an approved local project; verify its existing',
        'test and benchmark commands before use. Never run destructive, production',
        'or billable load tests without explicit authorization and a bounded safe target.',
        'On Windows use the available PowerShell shell; do not assume POSIX commands.',
        ''].join('\n'), id);
    return adapted;
  }
  if (id === 'accessibility') {
    let adapted = replaceOnce(original,
      'This skill ensures that digital interfaces are Perceivable, Operable, Understandable, and Robust (POUR) for all users, including those using screen readers, switch controls, or keyboard navigation. It focuses on the technical implementation of WCAG 2.2 success criteria.',
      'This skill guides accessibility design and review using the POUR principles and WCAG 2.2 examples across Web, iOS and Android. It does not certify WCAG conformance: verify criteria against current official guidance and test with actual assistive technologies and supported devices. Use only the project tools available through current CoS permissions.', id);
    adapted = replaceOnce(adapted,
      '- Ensure a minimum **24x24 CSS pixel** target size (WCAG 2.2 SC 2.5.8).\n- Verify all interactive elements are reachable via keyboard and have a visible focus indicator (SC 2.4.11).',
      '- Check **24x24 CSS pixel** targets under WCAG 2.2 SC 2.5.8 (Level AA), considering its spacing and other stated exceptions. Native platform target guidance differs.\n- Verify keyboard reachability, visible focus, and non-obscured focus (SC 2.4.11, Level AA). Focus Appearance is SC 2.4.13 (Level AAA).', id);
    adapted = replaceOnce(adapted,
      ['## Related Skills', '',
        '- `frontend-patterns`',
        '- `design-system`',
        '- `liquid-glass-design`',
        '- `swiftui-patterns`'].join('\n'),
      ['## Related guidance', '',
        'Use the project\'s actual frontend, design-system, SwiftUI, Android or testing',
        'instructions when present. This Skill does not install any of those other Skills.'].join('\n'), id);
    return adapted;
  }
  if (id === 'ai-regression-testing') {
    const from = '## Integrating Tests into Bug-Check Workflow\n';
    const to = '## Common AI Regression Patterns\n';
    if (original.split(from).length !== 2 || original.split(to).length !== 2)
      throw new Error('ECC regression workflow anchor changed');
    const replacement = [
      '## Integrating Tests into the CoS Review Workflow',
      '',
      'Select this Skill explicitly in CoS. Inspect the project test scripts and run only',
      'the relevant existing tests and build through the authorized Core terminal.',
      'Review sandbox/production response parity, incomplete database projections,',
      'error cleanup and optimistic-update rollback. For each confirmed bug, prepare',
      'a regression test and report its observed result. No Claude command, hook,',
      'new test runner or automatic check is registered by this Skill.',
      '',
      '## Common AI Regression Patterns',
      ''
    ].join('\n');
    return original.slice(0, original.indexOf(from)) + replacement
      + original.slice(original.indexOf(to) + to.length);
  }
  if (id === 'i18n-sync') {
    const from = '## Hook Integration\n';
    const to = '## Out of Scope\n';
    if (original.split(from).length !== 2 || original.split(to).length !== 2)
      throw new Error('ECC i18n hook anchor changed');
    const replacement = [
      '## CoS compatibility',
      '',
      'Use the existing CoS Core read, patch and project-specific verification tools.',
      'This Skill installs no hooks, background reminders, extra CLI or permissions.',
      'Optional Locakit workflows require a separately reviewed existing installation.',
      '',
      '## Out of Scope',
      ''
    ].join('\n');
    let text = original.slice(0, original.indexOf(from)) + replacement
      + original.slice(original.indexOf(to) + to.length);
    const related = '## Related\n\n- [frontend-patterns](../frontend-patterns/SKILL.md)\n- [seo](../seo/SKILL.md)\n- [Locakit package reference](https://www.npmjs.com/package/locakit)';
    if (!text.includes(related)) throw new Error('ECC i18n related references changed');
    text = text.replace(related, '## Related topics\n\nFrontend localization, accessibility and SEO should follow the selected project\'s installed Skills and tools. See the reviewed upstream ECC source for external Locakit reference links.');
    return text;
  }
  return original;
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const sourceArg = args.filter(arg => arg !== '--check');
if (sourceArg.length !== 1) throw new Error('Pass the exact ECC v2.2.3 checkout folder and optionally --check');
const repo = path.resolve(sourceArg[0]);
const version = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')).version;
if (version !== '2.2.3') throw new Error(`ECC source must be v2.2.3, got ${version}`);

const source = path.join(repo, 'skills');
const sourceIds = readdirSync(source, { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
if (sourceIds.length !== 293 || new Set(sourceIds).size !== 293)
  throw new Error(`ECC source inventory unexpectedly has ${sourceIds.length} skills, expected 293`);
const coreDir = path.join(repo, 'pi', 'core', 'skills');
const piIds = readdirSync(coreDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name);
const curated = new Set(piIds);
if (curated.size !== 123 || [...curated].filter(id => sourceIds.includes(id)).length !== 122)
  throw new Error('ECC pi/core membership differs from pinned v2.2.3 review (123 / 122 overlap)');

const allowed = Object.keys(APPROVED).sort();
const items = allowed.map(id => {
  const pin = APPROVED[id];
  if (!sourceIds.includes(id))
    throw new Error(`Approved skill missing from pinned ECC source: ${id}`);
  const folder = path.join(source, id);
  const children = readdirSync(folder).sort();
  if (lstatSync(folder).isSymbolicLink() || children.length !== 1 || children[0] !== 'SKILL.md')
    throw new Error(`Allowed source package contains extra files or links: ${id}`);
  const skillFile = path.join(folder, 'SKILL.md');
  if (!lstatSync(skillFile).isFile() || lstatSync(skillFile).isSymbolicLink())
    throw new Error(`Allowed SKILL.md is not a regular source file: ${id}`);
  const body = readFileSync(skillFile, 'utf8');
  const sha256 = createHash('sha256').update(body).digest('hex');
  if (sha256 !== pin.sha256) throw new Error(`Pinned ECC skill changed: ${id}`);
  if (Buffer.byteLength(body, 'utf8') > 128_000 || !body.startsWith('---\n'))
    throw new Error(`Invalid or oversized ECC skill: ${id}`);
  const end = body.indexOf('\n---\n', 4);
  if (end < 0) throw new Error(`SKILL.md metadata lacks closing boundary: ${id}`);
  const frontmatter = body.slice(4, end);
  const field = key => {
    const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(frontmatter);
    if (!match) throw new Error(`Required skill metadata missing ${key}: ${id}`);
    return match[1].trim().replace(/^['"]|['"]$/g, '');
  };
  if (field('name') !== id) throw new Error(`SKILL.md frontmatter name differs: ${id}`);
  const description = field('description').replace(/\s+/g, ' ').slice(0, 240);
  if (!description || /^(?:\[|\{)/.test(description)) throw new Error(`Invalid skill description: ${id}`);
  const packagedText = adaptForCos(id, body);
  const packagedHash = createHash('sha256').update(packagedText).digest('hex');
  if (/\]\(\.\.\/|\]\(\.\/|\$\{CLAUDE_PLUGIN_ROOT\}/.test(packagedText))
    throw new Error(`ECC package retains an unavailable relative link or Claude hook: ${id}`);
  // These skills were manually audited in full, so any future source edits
  // need a new explicit digest, reason, and review before becoming visible.
  return { id, name: id, description, curated: true, sha256,
    ...(pin.adaptation ? { sourceSha256: sha256, sha256: packagedHash, adaptation: pin.adaptation } : {}),
    compatibility: 'verified', compatibilityReason: pin.reason, packagedText };
});
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundled = path.join(root, 'resources', 'ecc', 'v2.2.3', 'skills');
const bundledIds = existsSync(bundled) ? readdirSync(bundled).sort() : [];
const extras = bundledIds.filter(id => !allowed.includes(id));
if (extras.length) throw new Error(`Unreviewed ECC bundles found: ${extras.join(', ')}`);
for (const item of items) {
  const dir = path.join(bundled, item.id);
  if (existsSync(dir)) {
    const stat = lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || readdirSync(dir).some(name => name !== 'SKILL.md'))
      throw new Error(`Unsafe ECC bundled directory: ${item.id}`);
    const dest = path.join(dir, 'SKILL.md');
    if (existsSync(dest) && (lstatSync(dest).isSymbolicLink() || !lstatSync(dest).isFile()))
      throw new Error(`Unsafe ECC bundled SKILL.md: ${item.id}`);
    if (check && (!existsSync(dest) || readFileSync(dest, 'utf8') !== item.packagedText))
      throw new Error(`Bundled ECC skill differs from pinned source: ${item.id}`);
  } else if (check) throw new Error(`Bundled ECC skill is missing: ${item.id}`);
}

const header = `/** Source-SHA-vetted ECC v2.2.3 Skills with reviewed text-only adaptations.
 * MIT © Affaan Mustafa 2026.
 * Generated by scripts/generate-ecc-catalog.mjs; only vetted entries may be imported.
 * Upstream Pi portability is NOT equivalent to CoS compatibility.
 */
export interface EccCatalogSkill {
  id: string;
  name: string;
  description: string;
  curated: true;
  sha256: string;
  /** Upstream original digest when a reviewed CoS-only editorial adaptation is bundled. */
  sourceSha256?: string;
  adaptation?: 'cos-i18n' | 'cos-regression' | 'cos-introspection' | 'cos-click-path' | 'cos-benchmark' | 'cos-accessibility';
  compatibility: 'verified';
  compatibilityReason: string;
}
export const ECC_CATALOG_REF = 'v2.2.3';
export const ECC_CATALOG_AUDIT = {
  sourceSkills: 293,
  upstreamPiCoreSkills: 123,
  upstreamPiCoreOriginalOverlap: 122,
  verifiedForCos: ${items.length},
  excludedBeforeCatalog: ${sourceIds.length - items.length},
  verifiedWithinPiCore: ${items.filter(item => curated.has(item.id)).length},
  verifiedOutsidePiCore: ${items.filter(item => !curated.has(item.id)).length},
  excludedByPiCuration: ${sourceIds.length - 122 - items.filter(item => !curated.has(item.id)).length},
  piPortableButNotCosVerified: ${122 - items.filter(item => curated.has(item.id)).length},
  excludedExamples: {
    'continuous-learning-v2': 'Claude lifecycle hooks and automatic observer; excluded by upstream pi/core.',
    'verification-loop': 'Upstream pi/core candidate, but shell pipelines/set -o pipefail are not native Windows CoS.',
    'agentic-engineering': 'Upstream pi/core candidate, but assumes Haiku/Sonnet/Opus model tier routing.',
    'security-review': 'Upstream pi/core candidate with platform and command assumptions; not approved unmodified.',
    'api-connector-builder': 'Upstream pi/core candidate references optional ECC-only related workflow names.',
  }
} as const;
export const ECC_CATALOG: readonly EccCatalogSkill[] = ${JSON.stringify(items.map(({ packagedText: _text, ...item }) => item), null, 2)};
export function eccCatalogUrl(id: string): string {
  if (!ECC_CATALOG.some(item => item.id === id)) throw new Error('ECC skill is not verified for CoS');
  return \`https://github.com/affaan-m/ECC/tree/\${ECC_CATALOG_REF}/skills/\${encodeURIComponent(id)}\`;
}
`;
const destination = path.join(root, 'src', 'shared', 'ecc-catalog.ts');
if (check) {
  if (readFileSync(destination, 'utf8') !== header) throw new Error('Generated ECC allowlist is stale');
  console.log(`Verified ${items.length} CoS-compatible Skills; ${sourceIds.length - items.length} excluded`);
} else {
  if (!existsSync(bundled)) mkdirSync(bundled, { recursive: true });
  for (const item of items) {
    const directory = path.join(bundled, item.id);
    if (!existsSync(directory)) mkdirSync(directory);
    const filename = path.join(directory, 'SKILL.md');
    if (!existsSync(filename) || readFileSync(filename, 'utf8') !== item.packagedText)
      writeFileSync(filename, item.packagedText, 'utf8');
  }
  writeFileSync(destination, header, 'utf8');
  console.log(`Generated ${items.length} verified ECC Skills; excluded ${sourceIds.length - items.length} before catalog`);
}
