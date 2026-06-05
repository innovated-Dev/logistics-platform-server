// src/services/paystackService.js
// All Paystack API calls are centralised here.
// Never call Paystack directly from a controller — this layer
// adds logging, error normalisation, and retry logic.

import  env   from '../config/env.js';
import axios    from 'axios';
import crypto   from 'crypto';
import { logger } from '../utils/logger.js';

const PS  = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET}` },
  timeout: 15000,
});

// Retry wrapper — Paystack occasionally has transient errors
async function psCall(fn) {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch(err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

// ── Initialize a payment transaction ──
// Returns { authorization_url, access_code, reference }
export async function initializePayment({ email, amount, reference, callbackUrl, metadata }) {
  const { data } = await psCall(() => PS.post('/transaction/initialize', {
    email,
    amount:       Math.round(amount * 100), // kobo
    reference,
    callback_url: callbackUrl,
    metadata:     metadata || {},
  }));
  logger.info(`Paystack init: ref=${reference} amount=₦${amount}`);
  return data.data;
}

// ── Verify a transaction after callback/webhook ──
// Returns the transaction object with status, amount, metadata.
export async function verifyPayment(reference) {
  const { data } = await psCall(() => PS.get(`/transaction/verify/${reference}`));
  return data.data;
}

// ── Verify a bank account number ──
// Returns { account_name } — use to confirm before saving bank details.
export async function verifyBankAccount(accountNumber, bankCode) {
  const { data } = await psCall(() =>
    PS.get('/bank/resolve', { params: { account_number: accountNumber, bank_code: bankCode } })
  );
  return data.data; // { account_name, account_number, bank_id }
}

// ── List supported Nigerian banks ──
export async function getBanks() {
  const { data } = await psCall(() => PS.get('/bank', { params: { country: 'nigeria', perPage: 200 } }));
  return data.data;
}

// ── Create transfer recipient (needed for automated payouts) ──
export async function createTransferRecipient({ name, accountNumber, bankCode }) {
  const { data } = await psCall(() => PS.post('/transferrecipient', {
    type:           'nuban',
    name,
    account_number: accountNumber,
    bank_code:      bankCode,
    currency:       'NGN',
  }));
  return data.data; // { recipient_code }
}

// ── Initiate transfer to pickman ──
export async function initiateTransfer({ amount, recipientCode, reason, reference }) {
  const { data } = await psCall(() => PS.post('/transfer', {
    source:         'balance',
    amount:         Math.round(amount * 100),
    recipient:      recipientCode,
    reason,
    reference,
  }));
  logger.info(`Transfer initiated: ${recipientCode} ₦${amount}`);
  return data.data;
}

// ── Webhook signature verification ──
// Must use raw body (Buffer) — call before body parser runs on the webhook route.
export function verifyWebhookSignature(rawBody, signature) {
  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}