import { NextResponse } from 'next/server';
import { razorpay } from '@/lib/razorpay/client';
import { PLANS } from '@/lib/razorpay/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, planId } = await req.json();

    if (!workspaceId || planId !== 'PRO') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Verify user is admin of workspace
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create a subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: PLANS.PRO.id,
      total_count: 120, // number of billing cycles
      customer_notify: 1,
      notes: {
        workspace_id: workspaceId,
      },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
