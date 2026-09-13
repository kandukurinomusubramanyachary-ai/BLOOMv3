const SUCCESS = 'If an account uses this email, you’ll receive a password-reset link. Check your inbox and spam folder.';
async function requestPasswordRecovery(email, send) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    const error = new Error('Enter a valid email address.'); error.field = 'email'; throw error;
  }
  try { await send(normalized); }
  catch (error) {
    if (error?.code !== 'auth/user-not-found') throw new Error('Bloom could not send a reset email. Check your connection, wait a little, then try again.');
  }
  return SUCCESS;
}
module.exports = { requestPasswordRecovery };
