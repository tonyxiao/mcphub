import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// Deploy a built fork revision without copying host settings or credentials.
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Commit tracked source changes before deploying');
if (revision !== git('rev-parse', 'origin/main')) throw new Error('Push main before deploying');
for (const file of ['dist/index.js', 'frontend/dist/index.html', 'node_modules']) {
  if (!existsSync(join(root, file))) throw new Error(`Missing ${file}; install dependencies and run pnpm build first`);
}
const release = join(homedir(), '.local/share/mcphub/releases', revision);
if (existsSync(release)) throw new Error('This revision is already deployed; use its existing release');
mkdirSync(release, { recursive: true });
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const file of ['dist', 'frontend/dist', 'bin', 'locales', 'scripts/gog-mcp.mjs']) {
  if (existsSync(join(root, file))) { mkdirSync(dirname(join(release, file)), { recursive: true }); cpSync(join(root, file), join(release, file), { recursive: true }); }
}
pkg.version = `${pkg.version === 'dev' ? '0.0.0' : pkg.version}-tonyxiao.${revision.slice(0, 7)}`;
writeFileSync(join(release, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
// Retain the frozen-lockfile dependency tree used to build this revision.
symlinkSync(join(root, 'node_modules'), join(release, 'node_modules'));
const current = join(homedir(), '.local/share/mcphub/current');
const nextCurrent = current + `.next-${process.pid}`;
symlinkSync(release, nextCurrent);
renameSync(nextCurrent, current);
const install = join(homedir(), '.local/lib/node_modules/@samanhappy/mcphub');
const previous = lstatSync(install).isSymbolicLink() ? readlinkSync(install) : install + `.before-fork-${Date.now()}`;
writeFileSync(join(release, 'deployment.json'), JSON.stringify({ repository: 'https://github.com/tonyxiao/mcphub', revision, previous, builtFrom: root, dependencies: join(root, 'node_modules') }, null, 2) + '\n');
const link = install + `.next-${process.pid}`;
symlinkSync(release, link);
if (!lstatSync(install).isSymbolicLink()) renameSync(install, previous);
renameSync(link, install);
console.log(JSON.stringify({ repository: 'tonyxiao/mcphub', revision, release, previous }));
