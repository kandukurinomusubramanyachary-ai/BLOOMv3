const { isNonPublicHostname } = require('../services/megUrlPolicy');
const REQUIRED_FIELDS = ['publisherLegalName', 'supportContact', 'retentionPolicy', 'deletionPolicy', 'providerInventory', 'eligibilityAndJurisdiction', 'approvedBy', 'approvedAt', 'effectiveDate'];
function legalApprovalIssues(registry = {}) {
  const issues = [];
  if (registry.status !== 'approved') issues.push('Legal publication approval is pending');
  if (registry.operatingCountry !== 'India') issues.push('Legal operating country must match the approved India scope');
  for (const field of REQUIRED_FIELDS) {
    const value = registry[field];
    if (typeof value !== 'string' || !value.trim() || /pending|placeholder|\[|\]|todo/i.test(value)) issues.push(`Legal ${field} requires finalized approval`);
  }
  for (const field of ['approvedAt', 'effectiveDate']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(registry[field] || '') || !Number.isFinite(Date.parse(registry[field]))) issues.push(`Legal ${field} requires an approved ISO date`);
  }
  return issues;
}
function approvedPublicUrl(value, registry) {
  if (legalApprovalIssues(registry).length) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !isNonPublicHostname(url.hostname) ? url.href : null;
  } catch { return null; }
}
module.exports = { REQUIRED_FIELDS, legalApprovalIssues, approvedPublicUrl };
