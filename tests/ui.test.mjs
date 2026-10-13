import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { build } from 'esbuild';

// A simulated DOM exercises application logic, not layout or real browsers.
const source = await readFile('src/pages/index.html', 'utf8');
await mkdir('.artifacts', { recursive: true });
await build({ entryPoints: ['src/js/main.js'], outfile: '.artifacts/ui-under-test.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', define: { __PUBLIC_CONFIG__: '{"enabled":false}' } });
globalThis.document = parseHTML('<html><head></head><body></body></html>').document;
const { initSignup, initNavigation } = await import('../.artifacts/ui-under-test.mjs');
const sample = { full_name: 'Aïcha Bello', email: 'AICHA@example.com', country: 'NG', french_level: 'B1', website: '' };
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(values = sample) {
  const { document, window } = parseHTML(source);
  globalThis.document = document; globalThis.window = window;
  window.matchMedia = () => ({ addEventListener() {} });
  let focused; let reset = false;
  window.HTMLElement.prototype.focus = function () { focused = this; };
  document.querySelector('form').reset = () => { reset = true; };
  globalThis.FormData = class { *[Symbol.iterator]() { yield* Object.entries(values); } };
  const options = {};
  const turnstile = { render: (_, opts) => { Object.assign(options, opts); return 'widget'; }, reset() {}, remove() {} };
  const submitEvent = () => document.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  return { document, window, options, turnstile, submitEvent, focused: () => focused, reset: () => reset };
}

test('UI state transitions with simulated DOM and mocked network', async t => {
  await t.test('unconfigured form stays disabled and cannot display success', async () => {
    const f = setup(); await initSignup({ enabled:false });
    assert.equal(f.document.querySelector('#signup-fields').hasAttribute('disabled'), true);
    assert.equal(f.document.querySelector('#signup-success').hidden, true);
  });
  await t.test('invalid fields show errors and focus the first field without a network call', async () => {
    const f = setup({}); let count=0;
    await initSignup({enabled:true}, {submit: async()=>{count++;}, loadTurnstile:async()=>f.turnstile});
    f.options.callback('token'); f.submitEvent(); await tick();
    assert.equal(count,0); assert.equal(f.focused().id,'full-name');
    assert.equal(f.document.querySelector('#email-error').hidden,false);
  });
  await t.test('pending submissions block double-clicks; success only follows resolved write', async () => {
    const f=setup(); let count=0; let resolveWrite;
    await initSignup({enabled:true}, {submit: ()=>{count++; return new Promise(resolve=>{resolveWrite=resolve;});},loadTurnstile:async()=>f.turnstile});
    f.options.callback('token'); f.submitEvent(); f.submitEvent(); await tick();
    assert.equal(count,1); assert.equal(f.document.querySelector('form').getAttribute('aria-busy'),'true');
    assert.equal(f.document.querySelector('#signup-success').hidden,true); assert.equal(f.reset(),false);
    resolveWrite({status:'accepted'}); await tick();
    assert.equal(f.document.querySelector('#signup-success').hidden,false); assert.equal(f.focused().id,'signup-success');
    assert.equal(f.reset(),true);
    f.submitEvent(); await tick(); assert.equal(count,1);
  });
  await t.test('network failure preserves the form, shows an error and requires a new verification', async () => {
    const f=setup();
    await initSignup({enabled:true},{submit:async()=>{throw new Error('Could not confirm registration.');},loadTurnstile:async()=>f.turnstile});
    f.options.callback('token'); f.submitEvent(); await tick();
    assert.equal(f.document.querySelector('#signup-success').hidden,true);
    assert.equal(f.document.querySelector('#form-message').textContent,'Could not confirm registration.');
    assert.equal(f.document.querySelector('#submit-button').disabled,true); assert.equal(f.reset(),false);
    assert.equal(f.document.querySelector('#signup-fields').disabled,false);
  });
  await t.test('menu opens, closes with Escape, and returns focus', () => {
    const f=setup(); initNavigation();
    f.document.querySelector('#menu-toggle').click();
    assert.equal(f.document.querySelector('#menu-toggle').getAttribute('aria-expanded'),'true');
    const escape=new f.window.Event('keydown'); escape.key='Escape'; f.document.dispatchEvent(escape);
    assert.equal(f.document.querySelector('#menu-toggle').getAttribute('aria-expanded'),'false');
    assert.equal(f.focused().id,'menu-toggle');
  });
});

test('document structure: labelled controls, headings and valid internal anchor targets', async () => {
  for (const page of ['index.html','privacy.html','contact.html']) {
    const {document}=parseHTML(await readFile(`src/pages/${page}`,'utf8'));
    assert.equal(document.querySelectorAll('h1').length,1,page);
    assert.equal(document.querySelector('html').lang,'en');
    for (const control of document.querySelectorAll('input,select')) assert.ok(document.querySelector(`label[for="${control.id}"]`),control.id);
    for (const link of document.querySelectorAll('a[href^="#"]')) assert.ok(document.getElementById(link.getAttribute('href').slice(1)),link.outerHTML);
    const ids=[...document.querySelectorAll('[id]')].map(node=>node.id); assert.equal(ids.length,new Set(ids).size);
  }
});
