// Dependency-injected so ordering and partial failures are testable without a
// real account. No stage after a failed deletion is allowed to run.
async function deleteAccountInOrder({ reauthenticate, deleteMeg, deleteAppData, deleteAuth, clearLocal }) {
  const stages = [reauthenticate, deleteMeg, deleteAppData, deleteAuth, clearLocal];
  for (let index = 0; index < stages.length; index += 1) {
    try { await stages[index](); } catch (cause) {
      const error = new Error(index === 4
        ? 'Your account was deleted, but Bloom could not clear its data from this device. Clear this app’s device storage before sharing the device.'
        : 'Deletion did not finish. Some records may already be removed. Your account has not been deleted; please retry.');
      error.stage = index;
      error.accountDeleted = index === 4;
      error.cause = cause;
      throw error;
    }
  }
}
module.exports = { deleteAccountInOrder };
