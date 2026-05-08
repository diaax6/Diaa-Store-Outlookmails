import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminSession } from '@/lib/auth';

export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('queue_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const body = await request.json();
  const { action, session_id } = body;

  if (action === 'start') {
    const { data, error } = await supabase
      .from('queue_sessions')
      .insert({ status: 'active' })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }

  if (!session_id) {
    return NextResponse.json({ success: false, error: 'session_id required' }, { status: 400 });
  }

  if (action === 'pause') {
    await supabase.from('queue_sessions').update({ status: 'paused' }).eq('id', session_id);
  } else if (action === 'resume') {
    await supabase.from('queue_sessions').update({ status: 'active' }).eq('id', session_id);
  } else if (action === 'stop') {
    await supabase
      .from('queue_sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', session_id);
  }

  return NextResponse.json({ success: true });
}
