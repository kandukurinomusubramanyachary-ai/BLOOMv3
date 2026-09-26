function productTourStorageKey(baseKey, uid) {
  return `${baseKey}:${encodeURIComponent(String(uid || 'guest'))}`;
}

function isTourHandled(record) {
  return record?.status === 'completed' || record?.status === 'skipped';
}

function createTourRecord(status, timestamp = new Date().toISOString()) {
  if (status === 'completed') return { status, completedAt: timestamp, skipped: false };
  if (status === 'skipped') return { status, completedAt: null, skippedAt: timestamp };
  throw new Error('Unsupported tour status');
}

module.exports = { productTourStorageKey, isTourHandled, createTourRecord };
