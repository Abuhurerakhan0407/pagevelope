'use client';

import { useState } from 'react';
import Script from 'next/script';
import { env } from '@/lib/razorpay/env';

export function BillingClient({ workspaceId, subscription }: { workspaceId: string, subscription: unknown }) {
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Safe extraction from unknown subscription type
  const sub = subscription as { tier?: string, status?: string, cancel_at_period_end?: boolean } | null;
  const isPro = sub?.tier === 'pro' && sub?.status === 'active';
  const isCanceling = sub?.cancel_at_period_end;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, planId: 'PRO' }),
      });
      const data = await res.json();

      if (data.subscriptionId) {
        const options = {
          key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          subscription_id: data.subscriptionId,
          name: 'Pagevelope',
          description: 'Pro Subscription',
          handler: function () {
            window.location.reload();
          },
          theme: {
            color: '#000000',
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will have access until the end of the current billing period.')) return;

    setCancelLoading(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
        <div className="mb-6">
          <p className="text-gray-600">
            You are currently on the <strong className="text-black capitalize">{sub?.tier || 'free'}</strong> plan.
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Status: {sub?.status || 'active'}
            {isCanceling && ' (Cancels at end of period)'}
          </p>
        </div>

        {!isPro ? (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Upgrade to Pro'}
          </button>
        ) : (
           <button
            onClick={handleCancel}
            disabled={cancelLoading || isCanceling}
            className="bg-red-50 text-red-600 px-4 py-2 rounded border border-red-200 hover:bg-red-100 disabled:opacity-50"
          >
            {cancelLoading ? 'Canceling...' : isCanceling ? 'Canceled' : 'Cancel Subscription'}
          </button>
        )}
      </div>
    </div>
  );
}
