import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const tests = readdirSync(new URL('../tests/', import.meta.url)).filter(name => /^test-.*\.mjs$/.test(name)).sort();
if (!tests.length) throw new Error('No tests found');
for (const test of tests) {
  console.log(`\n${test}`);
  const result = spawnSync(process.execPath, [`tests/${test}`], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`\n${tests.length} test files passed`);
