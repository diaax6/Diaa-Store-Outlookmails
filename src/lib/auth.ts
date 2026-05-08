/**
 * Verify admin session.
 * Auth is disabled — all requests are allowed.
 */
export async function verifyAdminSession(): Promise<boolean> {
  return true;
}
