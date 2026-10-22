// Run: node --preserve-symlinks --preserve-symlinks-main tests/web/test_approach_comparison.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = createRequire(path.resolve(__dirname, '../../apps/web/package.json'))('typescript');
const out = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.resolve(__dirname, '../../apps/web/src/approachComparison.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS } },
).outputText, { exports: out.exports });
const { callApproaches, compareCohorts, relativeIssueMix, summarizeApproach } = out.exports;
const call = (id, behaviors, outcome, turn_count, shift) => ({ call_id: id, behaviors, outcome, turn_count, sentiments: { shift } });
const calls = [
  call('a', ['showed empathy', 'used empathy'], 'resolved', 10, 0.5),
  call('b', ['transferred or escalated'], 'escalated', 20, -0.5),
  call('both', ['used empathy', 'transferred / escalated'], 'unresolved', undefined, undefined),
];
assert.equal(callApproaches(calls[0]).length, 1, 'Aliases must not duplicate behaviors');
let groups = compareCohorts(calls, ['used empathy', 'transferred / escalated'], true);
assert.equal(groups.shared.length, 1);
assert.equal(groups.groups[0].length, 1);
assert.equal(groups.groups[1].length, 1);
assert.equal(summarizeApproach(groups.groups[0]).resolution, 100);
assert.equal(summarizeApproach(groups.groups[1]).resolution, 0);
assert.equal(summarizeApproach(groups.groups[1]).friction, 100);
groups = compareCohorts(calls, ['used empathy', 'transferred / escalated'], false);
assert.equal(groups.groups[0].length, 2);
assert.equal(groups.groups[1].length, 2);
const summary = summarizeApproach(groups.groups[0]);
assert.equal(summary.resolution, 50);
assert.equal(summary.turns.count, 1);
assert.equal(summary.turns.value, 10);
assert.equal(summary.sentiment.value, 0.5);
assert(summary.interval[0] < 50 && summary.interval[1] > 50);
const empty = summarizeApproach([]);
assert.equal(empty.resolution, null);
assert.equal(empty.interval, null);
assert.equal(empty.turns.value, null);
assert.equal(summarizeApproach([call('x', [], 'resolved', NaN, Infinity)]).sentiment.count, 0);
assert(summarizeApproach([calls[0]]).interval[0] < 100);
assert(summarizeApproach([calls[1]]).interval[1] > 0);
const multiCalls = [...calls,
  call('c', ['offered next steps'], 'resolved', 12, 0.2),
  call('d', ['explained policy clearly'], 'resolved', 14, 0.1),
  call('ac', ['used empathy', 'set explicit next steps'], 'unresolved', 16, -0.2),
  call('bcd', ['transferred or escalated', 'offered next steps', 'explained policy clearly'], 'escalated', 20, -0.5),
];
const selections = ['used empathy', 'transferred / escalated', 'offered next steps', 'explained policy clearly'];
const four = compareCohorts(multiCalls, selections, true);
assert.equal(four.groups.length, 4);
assert.equal(four.shared.length, 3, 'Count each shared call once, even with three selected approaches');
for (let index = 0; index < 4; index++) assert.equal(four.groups[index].length, 1);
const included = compareCohorts(multiCalls, selections, false);
assert.equal(included.groups[0].length, 3);
assert.equal(included.groups[1].length, 3);
assert.equal(included.groups[2].length, 3);
assert.equal(included.groups[3].length, 2);
const three = compareCohorts(multiCalls, selections.slice(0, 3), true);
assert.equal(three.groups.length, 3);
assert.equal(three.shared.length, 3);
assert.equal(relativeIssueMix(20, 20, true).width, 50, 'Baseline is half full');
assert.equal(relativeIssueMix(10, 20, false).width, 25, 'Half the baseline share is quarter full');
assert.equal(relativeIssueMix(40, 20, false).width, 100, 'Twice the baseline share fills the bar');
assert.equal(relativeIssueMix(60, 20, false).width, 100, 'Large ratios stay inside the track');
assert.equal(relativeIssueMix(60, 20, false).ratio, 3, 'Capping must preserve the actual ratio');
assert.equal(relativeIssueMix(0, 20, false).width, 0);
assert.equal(relativeIssueMix(0, 0, true).width, 50, 'Zero baseline remains anchored');
assert.equal(relativeIssueMix(20, 0, false).ratio, null, 'Cannot divide by a zero baseline');
assert.equal(relativeIssueMix(20, 0, false).width, null);
assert.equal(relativeIssueMix(null, 20, false).width, null, 'Missing cohort is not a measured zero');
assert.equal(relativeIssueMix(20, null, false).width, null);
console.log('Comparison checks passed: aliases, cohorts, outcomes, uncertainty, and relative issue mix scaling.');
