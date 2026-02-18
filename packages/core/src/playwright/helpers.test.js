import { describe, it } from 'node:test';
import assert from 'node:assert';
import { setupLocalStorageState, resetToFreshState } from './helpers.js';

describe('setupLocalStorageState', () => {
  it('calls page.evaluate with a function that sets localStorage from data', async () => {
    const storage = {};
    const page = {
      evaluate: async (fn, data) => {
        const mockLocalStorage = {
          setItem(key, value) {
            storage[key] = value;
          },
        };
        const fnStr = fn.toString();
        const wrapped = new Function('localStorage', 'd', `return (${fnStr})(d);`);
        wrapped(mockLocalStorage, data);
      },
    };
    const data = { user: { name: 'Test' }, token: 'abc' };
    await setupLocalStorageState(page, data);
    assert.strictEqual(storage.user, JSON.stringify({ name: 'Test' }));
    assert.strictEqual(storage.token, JSON.stringify('abc'));
  });
});

describe('resetToFreshState', () => {
  it('calls goto, evaluate(clear localStorage), and reload', async () => {
    const calls = [];
    const page = {
      goto: async (url) => { calls.push({ type: 'goto', url }); },
      evaluate: async (fn) => {
        const mockLocalStorage = { clear: () => { calls.push({ type: 'clear' }); } };
        const fnStr = fn.toString();
        const wrapped = new Function('localStorage', `return (${fnStr})();`);
        wrapped(mockLocalStorage);
      },
      reload: async (opts) => { calls.push({ type: 'reload', opts }); },
    };
    await resetToFreshState(page, 'http://localhost:3000');
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[0].type, 'goto');
    assert.strictEqual(calls[0].url, 'http://localhost:3000');
    assert.strictEqual(calls[1].type, 'clear');
    assert.strictEqual(calls[2].type, 'reload');
    assert.deepStrictEqual(calls[2].opts, { waitUntil: 'networkidle' });
  });
});
