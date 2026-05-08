import { cookies } from 'next/headers';

/**
 * Verify admin session from cookie.
 * Returns true if admin_session cookie exists.
 * Note: IP validation is done at the API auth endpoint level.
 */
export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return !!session?.value;
}
