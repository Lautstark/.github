#!/usr/bin/env node
/**
 * Moves one consumer from `github:Lautstark/<pkg>#vX.Y.Z` pins to caret
 * ranges on the npm packages - step 3 of the 2026-09-16 release automation,
 * written the day the packages started releasing to npmjs.org and runnable
 * the day they are actually there.
 *
 *     node path/to/consumers-to-npm.mjs            # in the consumer's checkout
 *     node path/to/consumers-to-npm.mjs --dry-run  # say what would change
 *
 * For every @lautstark/* dependency pinned as a github: tag it asks the
 * registry for the newest published version, refuses to go backwards from
 * the pinned tag, and writes `^<version>`. Then, once no github: pin is left
 * in package.json, it removes what only existed to police those pins:
 *
 *   - tools/installcheck.mjs, and the `node tools/installcheck.mjs && `
 *     prefix on the test scripts, and the `preflight` script
 *   - the pins.js and preflight steps in the workflows under .github/
 *   - the install check in tests/run.py (the two vorlaut repositories)
 *
 * and the product's own .small/.muted/.faint rules where design >= 1.32
 * draws them (bildhaft, wochenwerk) - shadows.js --strict would refuse the
 * deploy otherwise.
 *
 * It does NOT run npm install, the tests, or git. Read the diff, run
 * `npm install`, run the suites, commit as
 *   build: take the shared packages from npm as ranges, not github: tags
 * and land it. The renovate.json5 prose needs no edit - it was rewritten
 * for this on the same day.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry-run');
const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');
const write = (p, text) => { if (dry) console.log(`  would write ${p}`); else writeFileSync(join(root, p), text); };

const PIN = /^github:Lautstark\/([^#]+)#v(\d+\.\d+\.\d+)$/;
const pkg = JSON.parse(read('package.json'));
let moved = 0;
let manifestChanged = false;
for (const field of ['dependencies', 'devDependencies']) {
  for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
    const m = PIN.exec(spec);
    if (!m) continue;
    const [, repo, pinned] = m;
    let latest;
    try {
      latest = execFileSync('npm', ['view', name, 'version'], { encoding: 'utf8' }).trim();
    } catch {
      console.error(`${name}: not on npmjs.org yet. Nothing changed for it - publish it first.`);
      continue;
    }
    const cmp = (a, b) => { const [x, y] = [a, b].map((v) => v.split('.').map(Number)); return (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]); };
    if (cmp(latest, pinned) < 0) {
      console.error(`${name}: npm has ${latest}, older than the pinned ${pinned} (Lautstark/${repo}). Not moving backwards.`);
      continue;
    }
    console.log(`${name}: github:Lautstark/${repo}#v${pinned} -> ^${latest}`);
    pkg[field][name] = `^${latest}`;
    moved++;
  }
}
const left = Object.values({ ...pkg.dependencies, ...pkg.devDependencies }).filter((s) => /^github:/.test(s));

if (left.length === 0) {
  // The pin police go with the last pin.
  for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
    if (name === 'preflight' && /installcheck/.test(script)) { delete pkg.scripts[name]; manifestChanged = true; console.log(`scripts.${name}: removed`); continue; }
    const cleaned = script.replace(/^node (tools\/|node_modules\/@lautstark\/design\/)installcheck\.mjs && /, '');
    if (cleaned !== script) { pkg.scripts[name] = cleaned; manifestChanged = true; console.log(`scripts.${name}: without the install check`); }
  }
  if (existsSync(join(root, 'tools/installcheck.mjs'))) {
    console.log('tools/installcheck.mjs: removed');
    if (!dry) rmSync(join(root, 'tools/installcheck.mjs'));
  }
  const wf = join(root, '.github/workflows');
  if (existsSync(wf)) {
    for (const f of readdirSync(wf)) {
      const p = `.github/workflows/${f}`;
      const before = read(p);
      // A step is `      - ` up to the next line at that indent; drop the ones
      // that run pins.js, the preflight or the install check.
      const after = before.replace(/^      - (?:name:[^\n]*\n(?:        [^\n]*\n|\n)*?|)        run: (?:npm run preflight|node (?:tools\/|node_modules\/@lautstark\/design\/)(?:pins|installcheck)\.(?:m?js)[^\n]*)\n(?:\n)?/gm, '')
        .replace(/^      - run: node node_modules\/@lautstark\/design\/pins\.js[^\n]*\n/gm, '')
        // The shadows step's comment leaned on the step above it.
        .replace(/# pins\.js above asks whether this product has the right version of\n(\s*)# @lautstark\/design\. This asks the question underneath it: whether it\n(\s*)# is using it\./g,
          '# Renovate keeps this product on the current @lautstark/design. This\n$1# asks the question underneath that: whether it is actually using\n$2# it.');
      if (after !== before) { console.log(`${p}: pins/preflight steps removed`); write(p, after); }
      for (const [i, line] of after.split('\n').entries()) {
        if (/pins\.js|installcheck|preflight/.test(line)) console.log(`  ${p}:${i + 1} still mentions it in prose - read it: ${line.trim().slice(0, 70)}`);
      }
    }
  }
  if (existsSync(join(root, 'tests/run.py'))) {
    const before = read('tests/run.py');
    const after = before
      .replace(/PREFLIGHT = HERE\.parent \/ "tools" \/ "installcheck\.mjs"\n\n\ndef install_is_current\(\) -> bool:[\s\S]*?\n\n\n/m, '')
      .replace(/    # Before anything is compiled or run\.[\s\S]*?    if not install_is_current\(\):\n        return 1\n\n/m, '');
    if (after !== before) { console.log('tests/run.py: install check removed'); write('tests/run.py', after); }
    else console.error('tests/run.py: the install check was not where this script expected it; edit by hand.');
  }
  for (const css of ['src/styles/app.css', 'src/kalender.css']) {
    if (!existsSync(join(root, css))) continue;
    const before = read(css);
    const after = before.replace(/^\.(small|muted|faint) \{[^\n]*\}\n/gm, '');
    if (after !== before) { console.log(`${css}: own .small/.muted/.faint removed - components.css draws them since design 1.32`); write(css, after); }
  }
} else if (moved) {
  console.log(`${left.length} github: pin(s) left; the install check and pins.js stay until the last one is gone.`);
}

if (moved || manifestChanged) write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(moved ? `\n${moved} pin(s) moved. Now: npm install, the suites, commit.` : '\nNothing moved.');
