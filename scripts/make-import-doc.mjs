// Writes docs/IMPORT-FORMAT.md from the guide the app copies (src/importGuide.ts), and checks that the
// guide's complete example imports without errors. Usage: node scripts/make-import-doc.mjs
import { readFileSync, writeFileSync } from 'node:fs';

import { IMPORT_GUIDE } from '../src/importGuide.ts';
import { parseTrainingFile } from '../src/domain/importer.ts';

const all = JSON.parse(readFileSync(new URL('../src/data/exercises.json', import.meta.url), 'utf8'));
const example = IMPORT_GUIDE.split('## 11. Complete example')[1].split('\n').filter((l) => l.startsWith('    ')).join('\n');
const r = parseTrainingFile(example, all, { sessions: [], cardio: [] });
if (r.errors.length) throw new Error(`The guide's example does not import:\n${r.errors.join('\n')}`);

const doc = IMPORT_GUIDE.replace(/\nNow, from what I tell you below, write the file:\n$/, '\n');
writeFileSync(new URL('../docs/IMPORT-FORMAT.md', import.meta.url), doc);
console.log(`docs/IMPORT-FORMAT.md written; example imports ${r.rows.length} entries:`);
for (const row of r.rows) console.log(`  ${row.date} ${row.type} ${row.kind} ${row.name}`);
for (const s of r.sessions) for (const x of [...s.plan, ...s.sets]) console.log(`    ${x.exerciseId}${'implements' in x ? ` x${x.implements}` : ''}`);
