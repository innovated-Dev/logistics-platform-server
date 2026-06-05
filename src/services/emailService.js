import env         from '../config/env.js';
import { BrevoClient } from '@getbrevo/brevo';
import { logger }      from '../utils/logger.js';

// New SDK uses a single unified client — no more separate API class instances
const brevo = new BrevoClient({ apiKey: env.BREVO_APIKEY });

export const send = async (to, subject, textContent, htmlContent) => {
  try {
    // transactionalEmails is a sub-client accessed as a property
    // sendTransacEmail still exists — same method name, different structure
    await brevo.transactionalEmails.sendTransacEmail({
      sender: {
        email: env.EMAIL_FROM,
        name:  'OffScape Cabinet',
      },
      to:          [{ email: to }],
      subject,
      textContent,
      htmlContent,
    });

    logger.info(`Email sent → ${to} | ${subject}`);
  } catch (err) {
    logger.error(`Email failed → ${to} | ${err.message}`);
    throw err;
  }
};

// ── Wrappers used by controllers ──

export async function sendEmailVerification(email, firstName, verifyUrl) {
  
    const text = `Welcome to OffScape ${firstName}! Visit ${verifyUrl} to verify your email.`;
    const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#e74c3c">OffScape Logistics</div>
      <h2>Welcome, ${firstName}! Verify your email ✉️</h2>
      <p style="color:#64748b">Click below to confirm your email and activate your account.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#e74c3c;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;margin:20px 0">
        Verify Email →
      </a> 
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Link expires in 24 hours: ${verifyUrl}</p>
    </div>
  `;

  await send(email, "Verify your offScape email!", text, html);
}

export async function sendPasswordResetOTP(email, firstName, otp, expiryMinutes = 15) {

    const text = `Hello ${firstName}, your password reset code is: ${otp}. This code expires in ${expiryMinutes} minutes. If you did not request this, please ignore this email.`;
    const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#e74c3c">OffScape Logistics</div>
      <h2>Password Reset Request 🔑</h2>
      <p>Hello ${firstName}, use the code below to reset your password:</p>
      <div style="background:#f4f4f4;padding:24px;text-align:center;border-radius:8px;margin:20px 0">
        <h1 style="font-size:48px;color:#1c282a;letter-spacing:10px;margin:0">${otp}</h1>
        <p style="color:#666;margin-top:8px">Valid for ${expiryMinutes} minutes</p>
      </div>
      <p style="color:#666">If you didn't request this, ignore this email.</p>
      <hr style="margin:30px 0">
      <p style="color:#999;font-size:12px">Do not share this code with anyone.</p>
    </div>
  `;
  await send(email, 'Password Reset — Your OTP Code', text, html);

}

export async function sendPasswordResetLink(email, firstName, resetUrl) {
    const text = `Hello ${firstName}, your OTP has been verified. Click the link below to set your new OffScape password. This link expires in 15 minutes, so please act promptly. ${resetUrl} — If you did not request a password reset, please ignore this message or contact our support team immediately.`;
    const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#e74c3c">OffScape Logistics</div>
      <h2>OTP Verified — Set a New Password</h2>
      <p>Hello ${firstName}, click below to set your new password:</p>
      <a href="${resetUrl}" style="display:inline-block;background:#1c282a;color:#fff;text-decoration:none;padding:15px 30px;border-radius:5px;font-weight:bold;margin:20px 0">
        Reset Password →
      </a>
      <p style="color:#e74c3c;font-weight:bold">This link expires in 15 minutes.</p>
      <p style="color:#94a3b8;font-size:12px;word-break:break-all">${resetUrl}</p>
    </div>
  `;

    await send(email, 'Reset Your Password — Link Inside', text, html);

}

export async function sendPasswordChangeConfirmation(email, firstName) {
    const text = `Hello ${firstName}, this is a confirmation that your OffScape account password was successfully changed. All other active sessions have been signed out for your security. If you made this change, no further action is needed. If you did not make this change, please contact our support team immediately as your account may be at risk.`;
    const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#e74c3c">OffScape Logistics</div>
      <h2 style="color:#2ecc71">Password Changed ✓</h2>
      <p>Hello ${firstName}, your password was successfully updated.</p>
      <div style="background:#d4edda;border-left:4px solid #28a745;padding:15px;border-radius:4px;margin:20px 0">
        <p style="color:#155724;margin:0"><strong>✓ Secure:</strong> Your account is protected with your new password.</p>
      </div>
      <p style="color:#e74c3c;font-weight:bold">If you didn't make this change, contact support immediately.</p>
    </div>
  `;

    await send(email, 'Password Successfully Changed', text, html);
}

export async function sendResendResetOTP(email, firstName, otp, resendsRemaining, expiryMinutes = 15) {
    const text = `Hello ${firstName}, you requested a new password reset code. Your new code is: ${otp}. This code is valid for ${expiryMinutes} minutes and replaces any previous code you may have received. Do not share this code with anyone. If you did not request this, please ignore this message.`;
    const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#e74c3c">OffScape Logistics</div>
      <h2>New OTP Code</h2>
      <p>Hello ${firstName}, here is your new password reset code:</p>
      <div style="background:#f4f4f4;padding:24px;text-align:center;border-radius:8px;margin:20px 0">
        <h1 style="font-size:48px;color:#1c282a;letter-spacing:10px;margin:0">${otp}</h1>
        <p style="color:#666;margin-top:8px">Valid for ${expiryMinutes} minutes</p>
      </div>
      <p style="color:#666">Resends remaining: ${resendsRemaining}</p>
    </div>
  `;

    await send(email, 'Password Reset — New OTP Code', text, html);

}

export async function sendKycApproved(email, firstName) {    
    const text = `Hello ${firstName}, great news! Your identity documents have been reviewed and your OffScape pickman account is now fully verified. You can sign in, go online, and start accepting delivery jobs right away. Welcome to the OffScape network — visit ${env.FRONTEND_URL}/signin to get started.`;
    const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#e74c3c">OffScape Logistics</div>
      <h2>You're verified, ${firstName}! 🛵</h2>
      <p style="color:#64748b">Your KYC documents have been reviewed and approved. You can now log in, go online, and start accepting jobs.</p>
      <a href="${env.FRONTEND_URL}/signin" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;margin:20px 0">
        Sign In &amp; Start Earning →
      </a>
    </div>
  `;

  await send(email, 'Your OffScape pickman account is approved! 🎉', text, html);

}

export async function sendKycRejected(email, firstName, reason) {
    const text = `Hello ${firstName}, thank you for submitting your documents to OffScape. After reviewing your application, our team needs a correction before we can approve your account. Reason: ${reason}. Please log in and resubmit the required documents at your earliest convenience. If you have any questions, our support team is happy to help.`;
    const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#e74c3c">OffScape Logistics</div>
      <h2>KYC Update Needed, ${firstName}</h2>
      <p style="color:#64748b">We reviewed your documents and need a correction before approving your account.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
        <strong>Reason:</strong> ${reason}
      </div>
      <a href="${env.FRONTEND_URL}/kyc-pending" style="display:inline-block;background:#e74c3c;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;margin:16px 0">
        Resubmit Documents →
      </a>
    </div>
  `;

  await send(email, 'OffScape KYC — Action Required', text, html);

}

