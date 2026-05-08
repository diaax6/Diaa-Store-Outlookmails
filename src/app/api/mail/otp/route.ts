import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { extractOTP } from '@/lib/otp-extractor';
import { verifyAdminSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const body = await request.json();
  const { message_id } = body;

  if (!message_id) {
    return NextResponse.json({ success: false, error: 'message_id required' }, { status: 400 });
  }

  const { data: message, error: msgError } = await supabase
    .from('mail_messages')
    .select('*')
    .eq('id', message_id)
    .single();

  if (msgError || !message) {
    return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
  }

  const extractions = extractOTP(message.subject || '', message.raw_body || message.body_preview || '');

  if (extractions.length === 0) {
    return NextResponse.json({ success: true, data: { otps: [], message: 'No OTP codes found' } });
  }

  const otps = [];
  for (const ext of extractions) {
    const { data: existing } = await supabase
      .from('otp_results')
      .select('id')
      .eq('message_id', message_id)
      .eq('code', ext.code)
      .single();

    if (!existing) {
      const { data: otpData } = await supabase
        .from('otp_results')
        .insert({
          message_id,
          account_id: message.account_id,
          code: ext.code,
          code_type: ext.type,
          sender: message.sender,
          subject: message.subject,
        })
        .select()
        .single();

      if (otpData) otps.push(otpData);
    }
  }

  if (otps.length > 0) {
    await supabase.from('mail_messages').update({ has_otp: true }).eq('id', message_id);
  }

  return NextResponse.json({ success: true, data: { otps } });
}
