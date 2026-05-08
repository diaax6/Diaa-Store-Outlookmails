import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// In-memory session store (IP-bound)
const sessions: Map<string, { token: string; ip: string; createdAt: number }> = new Map();

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (password !== adminPassword) {
    return NextResponse.json(
      { success: false, error: 'Wrong password' },
      { status: 401 }
    );
  }

  const clientIP = getClientIP(request);
  const sessionToken = crypto.randomBytes(32).toString('hex');

  // Store session with IP binding
  sessions.set(sessionToken, { token: sessionToken, ip: clientIP, createdAt: Date.now() });

  const cookieStore = await cookies();
  cookieStore.set('admin_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year — session only expires on IP change
  });

  cookieStore.set('is_logged_in', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  });

  return NextResponse.json({ success: true });
}

// Verify session (GET)
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'No session' }, { status: 401 });
  }

  const session = sessions.get(token);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }

  const clientIP = getClientIP(request);
  if (session.ip !== clientIP) {
    // IP changed — invalidate session
    sessions.delete(token);
    cookieStore.delete('admin_session');
    cookieStore.delete('is_logged_in');
    return NextResponse.json({ success: false, error: 'IP changed, please login again' }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}

// Logout (DELETE)
export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (token) sessions.delete(token);
  cookieStore.delete('admin_session');
  cookieStore.delete('is_logged_in');
  return NextResponse.json({ success: true });
}
