import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { verifyAdminSession } from '@/lib/auth';

// GET — List accounts
export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('email_accounts')
    .select('id, email, status, health_score, last_checked_at, last_code, last_code_at, total_fetches, total_otps, assigned_to, token_expires_at, notes, client_id, is_used, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data, count: data?.length ?? 0 });
}

// POST — Create account
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const body = await request.json();
  const { email, password, client_id, refresh_token } = body;

  if (!email || !password || !client_id || !refresh_token) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
  }

  // Encrypt sensitive data
  const encrypted_password = encrypt(password);
  const encrypted_refresh_token = encrypt(refresh_token);

  const { data, error } = await supabase
    .from('email_accounts')
    .insert({
      email,
      encrypted_password,
      client_id,
      encrypted_refresh_token,
      status: 'active',
      health_score: 100,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data });
}
