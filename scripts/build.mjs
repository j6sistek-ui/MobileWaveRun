import { cp, mkdir, readFile, readdir, rm, writeFile, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
// Only our own generated directory may be cleaned; refuse links/junctions.
if (dirname(out) !== root || out !== resolve(root, 'dist')) throw new Error('Unsafe output directory');
try { if ((await lstat(out)).isSymbolicLink()) throw new Error('dist must not be a link'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(out, { recursive: true, force: true });
const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc')], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
async function rewrite(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await rewrite(path);
    else if (item.name.endsWith('.js')) {
      const source = await readFile(path, 'utf8');
      const fixed = source.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])(\.\.?\/[^"']+)\2/g,
        (match, prefix, quote, specifier) => /\.[a-z0-9]+$/i.test(specifier) ? match : `${prefix}${quote}${specifier}.js${quote}`);
      await writeFile(path, fixed);
    }
  }
}
await rewrite(join(out, 'js'));
await cp(join(root, 'public'), out, { recursive: true });
await cp(join(root, 'illustrated-src/spill-workshop.css'), join(out, 'spill-workshop.css'));
await mkdir(join(out, 'js'), { recursive: true });
console.log('Built browser game in dist/');
