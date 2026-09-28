import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeArch, normalizePlatform, PLATFORM_INFO } from './packaging-targets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function value(name, fallback) {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}

const platform = normalizePlatform(value('platform', process.platform));
const arches = value('arch', process.arch).split(',').map((item) => normalizeArch(item.trim()));
const dirOnly = args.includes('--dir');

function verifyReleaseMetadata() {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
  const versionSource = readFileSync(path.join(root, 'src', 'main', 'version.ts'), 'utf8');
  const appVersion = versionSource.match(/APP_VERSION = '([^']+)'/)?.[1];
  const versions = {
    'package.json': pkg.version,
    'package-lock.json': lock.version,
    'package-lock.json root': lock.packages?.['']?.version,
    'extension/manifest.json': manifest.version,
    'src/main/version.ts': appVersion
  };
  const mismatches = Object.entries(versions).filter(([, version]) => version !== pkg.version);
  if (mismatches.length) {
    const details = Object.entries(versions).map(([name, version]) => `${name}=${version ?? '<missing>'}`).join(', ');
    throw new Error(`Release metadata is not aligned: ${details}`);
  }
}

function run(command, commandArgs, env = process.env) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const node = process.execPath;
verifyReleaseMetadata();
// electron-builder can download its own runtime into its cache, but our package also copies
// Electron's LICENSE files from node_modules/electron/dist. A fresh npm install may leave that
// package payload lazy until Electron itself is resolved, so make the local runtime materialize
// before assembly instead of emitting an otherwise-working installer with missing notices.
run(node, ['-e', "require('electron')"]);
run(node, ['scripts/generate-third-party-notices.mjs']);
run(node, ['scripts/make-icon.mjs']);
// Before the bundle is built, so the stamp that ships is the stamp of what ships. The app and the
// extension both read this one file to tell which extension build a browser is running.
run(node, ['scripts/write-extension-stamp.mjs']);
run(node, [path.join('node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build']);

for (const arch of arches) {
  const targetArgs = ['--platform', platform, '--arch', arch];
  run(node, ['scripts/fetch-tunnel-client.mjs', ...targetArgs]);
  run(node, ['scripts/fetch-ripgrep.mjs', ...targetArgs]);
  run(node, ['scripts/prepare-packaging-native.mjs', ...targetArgs]);
  run(node, ['scripts/prepare-macos-desktop-helper.mjs', ...targetArgs]);

  const builderArgs = [
    path.join('node_modules', 'electron-builder', 'out', 'cli', 'cli.js'),
    PLATFORM_INFO[platform].builderFlag,
    `--${arch}`,
    '--publish',
    'never'
  ];
  if (dirOnly) builderArgs.push('--dir');
  run(node, builderArgs, { ...process.env, COS_PACKAGE_ARCH: arch });
  // A successful electron-builder exit only proves that an artifact was assembled. Exercise the
  // unpacked artifact immediately so missing transitive runtime modules (for example when the
  // checkout's node_modules was linked to another tree) fail this same packaging command instead
  // of producing an installer that crashes before the first BrowserWindow exists.
  run(node, ['scripts/smoke-packaged-runtime.mjs', ...targetArgs]);
}
