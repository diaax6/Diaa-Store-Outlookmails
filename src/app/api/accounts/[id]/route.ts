import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { verifyAdminSession } from '@/lib/auth';

// GET — Get single account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

// PATCH — Update account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();
  const { id } = await params;

  const body = await request.json();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to;
  if (body.health_score !== undefined) updateData.health_score = body.health_score;
  if (body.password) updateData.encrypted_password = encrypt(body.password);
  if (body.refresh_token) updateData.encrypted_refresh_token = encrypt(body.refresh_token);
  if (body.client_id) updateData.client_id = body.client_id;

  const { data, error } = await supabase
    .from('email_accounts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// DELETE — Delete account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();
  const { id } = await params;

  const { error } = await supabase.from('email_accounts').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
