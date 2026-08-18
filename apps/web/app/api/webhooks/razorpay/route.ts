import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { env } from '@/lib/razorpay/env';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET || 'secret_placeholder')
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const supabase = createAdminClient(process.env.SUPABASE_SERVICE_ROLE_KEY || 'service_role_placeholder');

    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        const subscription = event.payload.subscription.entity;
        const customerId = subscription.customer_id;

        // Find workspace by customer id or metadata.
        // Assuming we store workspace_id in notes when creating subscription
        const workspaceId = subscription.notes?.workspace_id;

        if (workspaceId) {
           await supabase
            .from('workspace_subscriptions')
            .upsert({
              workspace_id: workspaceId,
              razorpay_customer_id: customerId,
              razorpay_subscription_id: subscription.id,
              tier: 'pro',
              status: subscription.status,
              current_period_end: new Date(subscription.current_end * 1000).toISOString(),
              updated_at: new Date().toISOString()
            });
        }
        break;
      }
      case 'subscription.cancelled':
      case 'subscription.halted': {
        const subscription = event.payload.subscription.entity;

        const { data: sub } = await supabase
          .from('workspace_subscriptions')
          .select('workspace_id')
          .eq('razorpay_subscription_id', subscription.id)
          .single();

        if (sub) {
          await supabase
            .from('workspace_subscriptions')
            .update({
              status: subscription.status,
              updated_at: new Date().toISOString()
            })
            .eq('workspace_id', sub.workspace_id);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
