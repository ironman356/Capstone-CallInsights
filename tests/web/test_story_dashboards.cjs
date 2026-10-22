// Run: node --preserve-symlinks --preserve-symlinks-main tests/web/test_story_dashboards.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const webRequire = createRequire(path.resolve(__dirname, '../../apps/web/package.json'));
const ts = webRequire('typescript');
const { renderToStaticMarkup } = webRequire('react-dom/server');
const source = path.resolve(__dirname, '../../apps/web/src');

function load(file, states = []) {
  const exports = {};
  let index = 0;
  const require = (id) => {
    if (id === 'react') return { ...webRequire('react'), useState: (initial) => [states[index++] ?? initial, () => {}] };
    if (id === '../utils') return { titleCase: (text) => text, compareCallRecency: () => 0 };
    if (id === '../approachComparison') return load('approachComparison.ts');
    return webRequire(id);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(source, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require });
  return exports;
}

const issues = [{ slug: 'escrow', issue: 'escrow', count: 4 }];
const call = (id, behaviors, resolved, issue = 'escrow') => ({
  call_id: id, behaviors, issue, outcome: resolved ? 'resolved' : 'unresolved',
  sentiments: { shift: 0 }, turn_count: 10, summary: id,
});
const render = (file, calls, states = []) => renderToStaticMarkup(load(`pages/${file}.tsx`, states).default({ issues, calls, onOpenCall() {} }));
const matching = [call('a', ['used empathy'], true), call('b', ['used empathy'], false)];
const contrast = [call('c', [], true), call('d', [], false)];
const observed = render('ApproachMatrixPage', [...matching, ...contrast]);
assert(observed.includes('0 pp'), 'An observed zero difference must remain zero');
assert(!observed.includes('Prototype mode:'), 'Equal observed outcomes must not trigger modeled lift');
assert(observed.includes('aria-pressed="false"'), 'Matrix selection must be exposed to assistive technology');

// A positive modeled lift cannot increase an already 100% baseline.
const modeled = render('ApproachMatrixPage', [call('a', ['offered next steps'], true)], ['offered next steps::escrow']);
assert(modeled.includes('Prototype mode:'));
assert(modeled.includes('0 pp'), 'Modeled lift must agree with the bounded rate shown in the detail');
assert(modeled.includes('100%'));

const examples = [
  call('wrong-issue', ['offered next steps'], true, 'payment'),
  call('alias-example', ['set explicit next steps'], true),
  call('canonical-example', ['offered next steps'], true),
];
const portfolio = render('ApproachPortfolioPage', examples, ['fcr', 'adoption', 'escrow', 'offered-next-steps']);
assert(!portfolio.includes('wrong-issue'), 'Evidence must respect the selected issue');
assert(portfolio.includes('alias-example') && portfolio.includes('canonical-example'), 'Evidence must recognize existing behavior aliases');
assert(portfolio.includes('Modeled confidence'), 'Prototype confidence must not imply measured evidence');
console.log('Story dashboard checks passed: observed zero, bounded modeled rates, selection accessibility, scoped evidence, and aliases.');
