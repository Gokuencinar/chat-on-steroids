/** Deterministic public release resources: 8 native CoS workflows, opt-in
 * /ecc-all orchestrator, and the 25 SHA-vetted ECC documents. No userData. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'resources/ecc/v2.2.3');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check' && arg !== '--write')) throw new Error('Use --check or --write');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function loadExports(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const module = { exports: {} };
  const context = { module, exports: module.exports };
  vm.runInNewContext(code, context, { timeout: 2000, filename: file });
  return module.exports;
}
const { ECC_SKILLS } = loadExports('src/shared/ecc-skills.ts');
const { ECC_CATALOG } = loadExports('src/shared/ecc-catalog.ts');
if (ECC_SKILLS.length !== 8 || ECC_CATALOG.length !== 25) throw new Error('The approved ECC inventory changed');
const approved = new Set([...ECC_SKILLS, ...ECC_CATALOG].map(item => item.id));
if (approved.size !== 33) throw new Error('Duplicate ECC ID');
const entries = [];
function output(relative, content) {
  const file = path.join(sourceDir, relative);
  const bytes = Buffer.from(content, 'utf8');
  if (check) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) throw new Error('ECC release resource missing or stale: ' + relative);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  return hash(bytes);
}
for (const skill of ECC_SKILLS) {
  if (!/^ecc-[a-z-]+$/.test(skill.id)) throw new Error('Unexpected workflow ID');
  entries.push({ id: skill.id, source: 'workflows', sha256: output('workflows/' + skill.id + '/SKILL.md', skill.markdown) });
}
const orchestratorFile = path.join(root, 'docs/ecc-all/SKILL.md');
if (!fs.existsSync(orchestratorFile)) throw new Error('Missing maintained public /ecc-all source');
const orchestrator = fs.readFileSync(orchestratorFile, 'utf8');
entries.push({ id: 'ecc-all', source: 'workflows', sha256: output('workflows/ecc-all/SKILL.md', orchestrator) });
for (const skill of ECC_CATALOG) {
  const file = path.join(sourceDir, 'skills', skill.id, 'SKILL.md');
  if (hash(fs.readFileSync(file)) !== skill.sha256) throw new Error('Vetted ECC Skill digest mismatch: ' + skill.id);
  entries.push({ id: skill.id, source: 'skills', sha256: skill.sha256 });
}
const manifest = JSON.stringify({ format: 'cos-ecc-v2.2.3-v1', version: '2.2.3', entries: entries.sort((a,b) => a.id.localeCompare(b.id, 'en')) }, null, 2) + '\n';
output('install-manifest.json', manifest);
const present = fs.readdirSync(path.join(sourceDir, 'workflows'), { withFileTypes: true });
if (present.length !== 9 || present.some(entry => !entry.isDirectory() || (!approved.has(entry.name) && entry.name !== 'ecc-all')))
  throw new Error('Unexpected workflow directory');
console.log((check ? 'Verified' : 'Wrote') + ' 8 CoS workflows, /ecc-all and 25 vetted ECC Skills; SHA manifest OK');
