import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { verifyAdminSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('email_accounts')
    .select('email, encrypted_password')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  let password = '';
  try { password = decrypt(data.encrypted_password); } catch { password = '(decryption failed)'; }

  return NextResponse.json({ success: true, data: { email: data.email, password } });
}
