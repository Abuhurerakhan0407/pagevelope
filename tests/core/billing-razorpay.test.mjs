import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

test('Razorpay webhook signature validation', () => {
  const payload = JSON.stringify({ event: 'subscription.activated' });
  const secret = 'test_secret';

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const invalidSignature = crypto
    .createHmac('sha256', 'wrong_secret')
    .update(payload)
    .digest('hex');

  assert.notStrictEqual(signature, invalidSignature);
});
