import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountTool, selectAccount, accountArguments } from './gog-mcp.mjs';
const accounts = ['a@example.com', 'b@example.com'];
test('selection uses an explicit supported identity and rejects unknown or ambiguous accounts', () => {
  assert.equal(selectAccount(undefined, accounts, accounts[0]), accounts[0]);
  assert.equal(selectAccount(accounts[1], accounts, accounts[0]), accounts[1]);
  for (const value of ['auto', '', null, 'other@example.com']) assert.throws(() => selectAccount(value, accounts, accounts[0]));
});
test('account schema preserves existing validation and annotations', () => {
  const original = { name: 'docs_write', annotations: { readOnlyHint: false }, inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } };
  const wrapped = accountTool(original, accounts, accounts[0]);
  assert.deepEqual(wrapped.inputSchema.required, ['text']);
  assert.equal(wrapped.inputSchema.additionalProperties, false);
  assert.deepEqual(wrapped.annotations, original.annotations);
  assert.deepEqual(wrapped.inputSchema.properties.acting_email.enum, accounts);
  assert.equal(original.inputSchema.properties.acting_email, undefined);
});

test('legacy selection stays compatible and conflicting selectors fail before routing', () => {
  assert.equal(accountArguments({acting_account: accounts[1]}, accounts, accounts[0]).email, accounts[1]);
  assert.throws(() => accountArguments({acting_email: accounts[0], acting_account: accounts[1]}, accounts, accounts[0]));
});
