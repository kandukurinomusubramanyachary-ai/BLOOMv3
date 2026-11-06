const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_FIELDS, legalApprovalIssues, approvedPublicUrl } = require('../src/legal/publication');
const registry = require('../config/legal-publication.json');
const drafts = require('../src/legal/drafts');
function approved() { return { ...Object.fromEntries(REQUIRED_FIELDS.map(key => [key, 'Synthetic reviewed value'])), status:'approved', operatingCountry:'India', approvedAt:'2026-11-01', effectiveDate:'2026-11-01' }; }
test('unapproved legal metadata blocks publication even with configured HTTPS pages', () => {
  assert.ok(legalApprovalIssues(registry).length); assert.equal(approvedPublicUrl('https://bloom-test.example/privacy', registry), null);
  assert.equal(registry.operatingCountry, 'India'); assert.equal(registry.publisherLegalName, null);
});
test('each missing or pending legal decision fails closed, while a complete synthetic registry passes', () => {
  assert.deepEqual(legalApprovalIssues(approved()), []);
  for (const field of REQUIRED_FIELDS) for (const value of [null, '', '[PENDING]', 'TODO']) assert.ok(legalApprovalIssues({...approved(), [field]:value}).some(issue => issue.includes(field)));
  assert.ok(legalApprovalIssues({...approved(), approvedAt:'not-a-date'}).length);
  assert.ok(legalApprovalIssues({...approved(), status:'pending'}).length);
});
test('approved publication still rejects local, insecure and credential-bearing URLs', () => {
  for(const value of ['http://bloom-test.example', 'https://127.0.0.1', 'https://192.168.0.1', 'https://u:p@bloom-test.example', 'garbage']) assert.equal(approvedPublicUrl(value, approved()), null);
  assert.equal(approvedPublicUrl('https://bloom-test.example/delete', approved()), 'https://bloom-test.example/delete');
});
test('seven reviewable legal drafts include pending ownership and no fabricated periods', () => {
  assert.equal(Object.keys(drafts).length, 7);
  for (const page of Object.values(drafts)) { assert.ok(page.sections.length >= 4); assert.match(JSON.stringify(page), /PENDING/); }
  assert.match(JSON.stringify(drafts.privacy), /does not delete existing messages/);
  assert.match(JSON.stringify(drafts.deletion), /receipt/);
  assert.match(JSON.stringify(drafts.retention), /PENDING LEGAL REVIEW/);
});
