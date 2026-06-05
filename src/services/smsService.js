// src/services/smsService.js — Termii SMS + OTP for Nigerian numbers
// Termii is the recommended provider for Nigerian delivery platforms
// because it supports generic SMS, branded sender IDs (OffScape),
// and native OTP APIs with server-side PIN management.
import env  from '../config/env.js';
import axios    from 'axios';
import bcrypt   from 'bcryptjs';
import { logger } from '../utils/logger.js';

const BASE = 'https://api.ng.termii.com/api';

// ── Generic SMS ──
export async function sendSMS(to, message) {
  try {
    // Normalise phone to +234 format
    const phone = normalisePhone(to);
    await axios.post(`${BASE}/sms/send`, {
      to:         phone,
      from:       env.TERMII_SENDER,
      sms:        message,
      type:       'plain',
      channel:    'generic',
      api_key:    env.TERMII_KEY,
    }, { timeout: 8000 });
    logger.info(`SMS sent to ${phone}`);
  } catch(err) {
    // SMS failures are logged but never crash the request
    logger.error(`SMS failed to ${to}: ${err.message}`);
  }
}

// ── OTP: generate and send ──
// Returns the PIN for storage (hashed) — backend never exposes the raw PIN.
export async function sendOTP(phone, message) {
  const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const hash = await bcrypt.hash(pin, 10);

  const body = message.replace('{{OTP}}', pin);
  await sendSMS(phone, body);

  return hash; // store this in the order or user doc
}

// ── OTP: verify ──
export async function verifyOTP(inputPin, storedHash) {
  return bcrypt.compare(inputPin.toString(), storedHash);
}

// ── Key notification helpers ──

export async function smsOrderPlaced(phone, orderRef, pickmanName) {
  await sendSMS(phone,
    `OffScape: Order ${orderRef} placed! ${pickmanName ? `pickman ${pickmanName} is on the way.` : 'Finding you a pickman now.'} Track in the app.`
  );
}

export async function smsPickmanAssigned(phone, pickmanName, pickmanPhone, orderRef) {
  await sendSMS(phone,
    `OffScape: pickman ${pickmanName} (${pickmanPhone}) is heading to pick up your order ${orderRef}. Call them directly if needed.`
  );
}

export async function smsOrderDelivered(phone, orderRef) {
  await sendSMS(phone,
    `OffScape: Order ${orderRef} has been delivered! Thank you for using OffScape. Rate your experience in the app.`
  );
}

export async function smsPickmanPayout(phone, amount, orderRef) {
  await sendSMS(phone,
    `OffScape: ₦${amount.toLocaleString()} credited to your wallet for ${orderRef}. Well done! Open the app to withdraw.`
  );
}

export async function smsCodOtp(phone, otp) {
  await sendSMS(phone,
    `OffScape Delivery OTP: ${otp}. Your pickman is at the door. Share this 6-digit code with them to confirm delivery. Do NOT share it before delivery.`
  );
}

export async function smsKycApproved(phone, firstName) {
  await sendSMS(phone,
    `OffScape: Congratulations ${firstName}! Your account is verified. Sign in, go Online, and start accepting jobs. Earn up to ₦25,000 daily.`
  );
}

export async function smsKycRejected(phone, reason) {
  await sendSMS(phone,
    `OffScape KYC: Your documents need correction. Reason: ${reason}. Log in and resubmit via Profile > KYC Documents.`
  );
}

// ── Normalise Nigerian phone to international format ──
function normalisePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234'))  return `+${digits}`;
  if (digits.startsWith('0'))    return `+234${digits.slice(1)}`;
  if (digits.length === 10)      return `+234${digits}`;
  return phone;
}