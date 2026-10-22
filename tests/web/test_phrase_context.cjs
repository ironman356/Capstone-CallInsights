// Run: node --preserve-symlinks --preserve-symlinks-main tests/web/test_phrase_context.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const webRequire = createRequire(path.resolve(__dirname, '../../apps/web/package.json'));
const ts = webRequire('typescript');
const out = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.resolve(__dirname, '../../apps/web/src/utils.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS } },
).outputText, { exports: out.exports });
const { phraseContext } = out.exports;
const call = { turns: [
  { speaker: 'Customer', text: 'Please review your escrow shortage with me.' },
  { speaker: 'Agent', text: 'First, we will REVIEW your escrow, shortage and explain the options.' },
  { speaker: 'Customer', text: 'What happens next?' },
] };
const excerpt = phraseContext(call, 'review your escrow shortage', 'Agent');
assert.equal(excerpt.match, 'REVIEW your escrow, shortage');
assert(excerpt.before.endsWith('Agent: First, we will '));
assert(excerpt.after.includes('Customer: What happens next?'));
assert.equal(phraseContext(call, 'not present here', 'Agent'), null);
assert.equal(phraseContext(call, '!!!', 'Agent'), null);
const long = phraseContext({ turns: [{ speaker: 'Agent', text: 'x'.repeat(200) + ' review your escrow shortage ' + 'y'.repeat(200) }] }, 'review your escrow shortage', 'Agent');
assert(long.before.startsWith('\u2026') && long.after.endsWith('\u2026'));
assert(long.before.length <= 161 && long.after.length <= 161);
console.log('Phrase context checks passed: source wording, speaker, neighboring turns, missing match, bounded context.');
