export const PLANS = {
  PRO: {
    id: process.env.RAZORPAY_PLAN_ID_PRO || 'plan_placeholder_pro',
    name: 'Pro',
    price: 4900, // in cents/paise
    currency: 'USD',
    features: [
      'Unlimited Campaigns',
      'Advanced Editor',
      'Analytics',
      'Priority Support',
    ],
  },
};
