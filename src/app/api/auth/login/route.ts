import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, password } = body;

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== adminUsername || password !== adminPassword) {
    return NextResponse.json(
      { success: false, error: 'Invalid username or password' },
      { status: 401 }
    );
  }

  // Generate a simple session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Set session cookie (httpOnly for security)
  const cookieStore = await cookies();
  cookieStore.set('admin_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  // Set a readable flag cookie for client-side auth checks
  cookieStore.set('is_logged_in', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return NextResponse.json({
    success: true,
    data: { username: adminUsername, expiresAt: expiresAt.toISOString() },
  });
}

// Logout
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  cookieStore.delete('is_logged_in');
  return NextResponse.json({ success: true });
}
