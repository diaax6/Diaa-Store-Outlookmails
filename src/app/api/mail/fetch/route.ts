import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { decrypt, encrypt } from '@/lib/crypto';
import { refreshAccessToken } from '@/lib/graph/token';
import { fetchMessages } from '@/lib/graph/mail';
import { extractOTP } from '@/lib/otp-extractor';
import { verifyAdminSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const body = await request.json();
  const { account_id, search, top = 15 } = body;

  if (!account_id) {
    return NextResponse.json({ success: false, error: 'account_id required' }, { status: 400 });
  }

  // Get account
  const { data: account, error: accountError } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', account_id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
  }

  try {
    // Decrypt refresh token
    const refreshToken = decrypt(account.encrypted_refresh_token);

    // Refresh access token
    const tokenData = await refreshAccessToken(account.client_id, refreshToken);

    // If we got a new refresh token, store it
    if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
      await supabase
        .from('email_accounts')
        .update({
          encrypted_refresh_token: encrypt(tokenData.refresh_token),
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq('id', account_id);
    }

    // Fetch messages from Graph API
    const graphMessages = await fetchMessages(tokenData.access_token, {
      top,
      search,
    });

    // Store messages and extract OTPs
    const messages = [];
    const otps = [];

    for (const gMsg of graphMessages) {
      // Upsert message
      const { data: savedMsg } = await supabase
        .from('mail_messages')
        .upsert(
          {
            account_id,
            graph_message_id: gMsg.id,
            sender: gMsg.from.emailAddress.address,
            subject: gMsg.subject,
            body_preview: gMsg.bodyPreview,
            raw_body: gMsg.body.content,
            received_at: gMsg.receivedDateTime,
            is_read: gMsg.isRead,
          },
          { onConflict: 'graph_message_id' }
        )
        .select()
        .single();

      if (savedMsg) {
        messages.push(savedMsg);

        // Extract OTPs
        const extractions = extractOTP(gMsg.subject || '', gMsg.body.content || '');
        if (extractions.length > 0) {
          // Mark message as having OTP
          await supabase
            .from('mail_messages')
            .update({ has_otp: true })
            .eq('id', savedMsg.id);

          savedMsg.has_otp = true;

          for (const ext of extractions) {
            const { data: otpData } = await supabase
              .from('otp_results')
              .insert({
                message_id: savedMsg.id,
                account_id,
                code: ext.code,
                code_type: ext.type,
                sender: gMsg.from.emailAddress.address,
                subject: gMsg.subject,
              })
              .select()
              .single();

            if (otpData) otps.push(otpData);
          }
        }
      }
    }

    // Update account stats
    await supabase
      .from('email_accounts')
      .update({
        last_checked_at: new Date().toISOString(),
        last_code: otps.length > 0 ? otps[0].code : account.last_code,
        last_code_at: otps.length > 0 ? new Date().toISOString() : account.last_code_at,
        total_fetches: (account.total_fetches || 0) + 1,
        total_otps: (account.total_otps || 0) + otps.length,
        status: 'active',
      })
      .eq('id', account_id);

    return NextResponse.json({
      success: true,
      data: { messages, otps, account_id },
    });
  } catch (err: unknown) {
    // Mark account as failed
    await supabase
      .from('email_accounts')
      .update({
        status: 'failed',
        health_score: Math.max(0, (account.health_score || 100) - 10),
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', account_id);

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
