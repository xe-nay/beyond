// Everything checkable before a push, so a build is not spent finding it. Each check below is an error
// that once failed a GitHub build or walkthrough:
// - lockfile out of step with package.json for CI's npm 10 (`npm ci` refused to install)
// - TypeScript errors, the calculation tests (Node's type stripping rejects some TS syntax), the app
//   tests, including timers left running after them ("import after the environment was torn down")
// - new lint errors beyond the known baseline
// - the iOS JavaScript bundle not building
// - walkthrough steps looking for text the app no longer shows ("Test Upper", "Complete set 1"…)
// - workflow files that do not parse
// - private words in what is about to be pushed (patterns from .git/preflight-private.txt, untracked)
// Usage: node scripts/preflight.mjs [--quick]   (--quick skips the npm 10 lockfile and iOS bundle checks)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

const quick = process.argv.includes('--quick');
const results = [];
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
const check = (name, fn) => {
  const t = Date.now();
  let error = null;
  try { error = fn(); } catch (e) { error = String(e?.message ?? e); }
  results.push({ name, ok: !error, error, s: ((Date.now() - t) / 1000).toFixed(0) });
  console.log(`${error ? '✗' : '✓'} ${name}${error ? `\n    ${String(error).split('\n').slice(0, 12).join('\n    ')}` : ''}`);
};
const tail = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n');

if (!quick) {
  check('Lockfile matches package.json for npm 10 (CI runs npm ci)', () => {
    const before = readFileSync('package-lock.json', 'utf8');
    const r = run('npx', ['-y', 'npm@10', 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
    const after = readFileSync('package-lock.json', 'utf8');
    if (r.status !== 0) return tail(r);
    if (after !== before) {
      writeFileSync('package-lock.json', before);
      return 'npm 10 would rewrite package-lock.json: run `npx npm@10 install` and commit the lockfile.';
    }
  });
}

check('Exercise catalog generated', () => (existsSync('src/data/exercises.json') ? null : 'Run node scripts/build-exercises.mjs first.'));
check('TypeScript', () => { const r = run('npx', ['tsc', '--noEmit']); return r.status ? tail(r) : null; });
check('Calculation tests (node --test)', () => { const r = run('npm', ['test', '--silent']); return r.status ? tail(r) : null; });
check('App tests (jest), nothing left running', () => {
  const r = run('npx', ['jest', '--ci']);
  const out = `${r.stdout}${r.stderr}`;
  if (r.status) return tail(r);
  if (/torn down|force exited|open handle/i.test(out)) return out.split('\n').filter((l) => /torn down|force exited|open handle|at .*src\//i.test(l)).slice(0, 8).join('\n');
});
check('Lint: no new errors', () => {
  const base = JSON.parse(readFileSync('scripts/lint-baseline.json', 'utf8')).errors;
  // Results go to a file: through a pipe they once came back empty and read as "0 errors".
  const out = join(mkdtempSync(join(tmpdir(), 'beyond-lint-')), 'lint.json');
  const r = run('npx', ['eslint', '.', '-f', 'json', '-o', out]);
  if (!existsSync(out)) return `ESLint wrote no results.
${tail(r)}`;
  const files = JSON.parse(readFileSync(out, 'utf8') || '[]');
  if (!files.length) return 'ESLint checked no files: something is wrong with its setup.';
  const errors = files.reduce((n, f) => n + f.errorCount, 0);
  if (errors > base) {
    const list = files.flatMap((f) => f.messages.filter((m) => m.severity === 2).map((m) => `${f.filePath.replace(process.cwd(), '')}:${m.line} ${m.ruleId}`));
    return `${errors} errors, baseline ${base}. Errors:\n${list.join('\n')}`;
  }
  if (errors < base) console.log(`    (${errors} errors, below the baseline of ${base}: lower it in scripts/lint-baseline.json)`);
});

if (!quick) {
  check('iOS JavaScript bundle builds (expo export)', () => {
    const out = mkdtempSync(join(tmpdir(), 'beyond-export-'));
    const r = run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', out]);
    rmSync(out, { recursive: true, force: true });
    return r.status ? tail(r) : null;
  });
}

// Walkthrough text: every text a flow taps, waits for or asserts must exist somewhere the app gets its
// words from. Regex parts and numbers are wildcards; what is left must appear in the source.
check('Walkthrough text matches the app', () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const corpus = ['app', 'src', 'modules'].flatMap(walk).filter((f) => /\.(tsx?|json)$/.test(f)).concat(['scripts/test-plan.mjs'])
    .map((f) => readFileSync(f, 'utf8')).join('\n');
  const flows = walk('.maestro').filter((f) => f.endsWith('.yaml'));
  const missing = [];
  const texts = (step, path = []) => {
    if (!step || typeof step !== 'object') return [];
    const out = [];
    for (const [k, v] of Object.entries(step)) {
      if (['tapOn', 'assertVisible', 'assertNotVisible', 'visible', 'notVisible', 'element', 'doubleTapOn', 'longPressOn'].includes(k)) {
        if (typeof v === 'string') out.push({ text: v, optional: false });
        else if (v && typeof v === 'object' && typeof v.text === 'string') out.push({ text: v.text, optional: !!v.optional });
      }
      if (v && typeof v === 'object') out.push(...texts(v, [...path, k]).map((x) => ({ ...x, optional: x.optional || !!v.optional })));
    }
    return out;
  };
  for (const f of flows) {
    const docs = readFileSync(f, 'utf8').split(/^---$/m);
    const steps = parse(docs[docs.length - 1]) ?? [];
    for (const { text, optional } of steps.flatMap((s) => texts(s))) {
      if (optional) continue; // system prompts ("Allow") and taps that may not be needed
      const parts = text.replace(/\$\{[^}]*\}/g, ' ').replace(/\(\.\*, \)\?|\.\*|\.\+|\\.|[()?|^$[\]]/g, '\u0000').split(/\u0000|[0-9]+/).map((x) => x.trim()).filter((x) => x.length >= 2);
      const gone = parts.filter((p) => !corpus.includes(p));
      if (gone.length) missing.push(`${f}: "${text}" (not found: ${gone.map((g) => `"${g}"`).join(', ')})`);
    }
  }
  return missing.length ? missing.join('\n') : null;
});

check('Workflow files parse', () => {
  const bad = readdirSync('.github/workflows').filter((f) => /\.ya?ml$/.test(f)).flatMap((f) => {
    try { const d = parse(readFileSync(join('.github/workflows', f), 'utf8')); return d?.jobs ? [] : [`${f}: no jobs`]; } catch (e) { return [`${f}: ${e.message}`]; }
  });
  return bad.length ? bad.join('\n') : null;
});

check('Nothing private in what is about to be pushed', () => {
  const file = '.git/preflight-private.txt';
  if (!existsSync(file)) return null;
  const words = readFileSync(file, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
  const r = run('git', ['diff', 'origin/main', '--', '.', ':(exclude)package-lock.json']);
  const added = (r.stdout ?? '').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  const hits = added.filter((l) => words.some((w) => new RegExp(w, 'i').test(l)));
  return hits.length ? hits.slice(0, 10).join('\n') : null;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? `✗ ${failed.length} of ${results.length} checks failed: do not push.` : `✓ All ${results.length} checks passed.`}`);
process.exit(failed.length ? 1 : 0);
