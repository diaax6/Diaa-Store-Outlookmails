import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { verifyAdminSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const body = await request.json();
  const { accounts } = body;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return NextResponse.json({ success: false, error: 'No accounts provided' }, { status: 400 });
  }

  let success = 0;
  let failed = 0;
  const errors: { line: number; email: string; error: string }[] = [];

  for (let i = 0; i < accounts.length; i++) {
    const { email, password, client_id, refresh_token } = accounts[i];

    if (!email || !password || !client_id || !refresh_token) {
      failed++;
      errors.push({ line: i + 1, email: email || '', error: 'Missing required fields' });
      continue;
    }

    try {
      const encrypted_password = encrypt(password);
      const encrypted_refresh_token = encrypt(refresh_token);

      const { error } = await supabase.from('email_accounts').insert({
        email: email.trim(),
        encrypted_password,
        client_id: client_id.trim(),
        encrypted_refresh_token,
        status: 'active',
        health_score: 100,
      });

      if (error) {
        failed++;
        errors.push({ line: i + 1, email, error: error.message });
      } else {
        success++;
      }
    } catch (err: unknown) {
      failed++;
      errors.push({ line: i + 1, email, error: String(err) });
    }
  }

  return NextResponse.json({
    success: true,
    data: { total: accounts.length, success, failed, errors },
  });
}
