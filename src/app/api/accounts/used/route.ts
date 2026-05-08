import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminSession } from '@/lib/auth';

// GET — Get all used account IDs
export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('email_accounts')
    .select('id')
    .eq('is_used', true);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, used_ids: (data || []).map(d => d.id) });
}

// POST — Toggle used status for an account
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    console.log('[USED API] POST rejected - not authenticated');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const body = await request.json();
  const { account_id, is_used } = body;

  if (!account_id || typeof is_used !== 'boolean') {
    console.log('[USED API] POST rejected - invalid params:', { account_id, is_used });
    return NextResponse.json({ success: false, error: 'account_id and is_used (boolean) required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('email_accounts')
    .update({ is_used })
    .eq('id', account_id);

  if (error) {
    console.log('[USED API] Supabase error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  console.log('[USED API] SUCCESS - account', account_id, 'is_used =', is_used);
  return NextResponse.json({ success: true });
}

// DELETE — Clear all used statuses
export async function DELETE() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('email_accounts')
    .update({ is_used: false })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
