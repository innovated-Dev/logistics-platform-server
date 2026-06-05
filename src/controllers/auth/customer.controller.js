// src/controllers/auth/customer.auth.js
import mongoose    from 'mongoose';
import crypto      from 'crypto';
import Customer    from '../../models/user/customer.role.js';
import User        from '../../models/base/user.base.js';
import { issueTokens } from './auth.base.js';
import { sendEmailVerification } from '../../services/emailService.js';
import { ConflictError, AuthError } from '../../utils/errors.js';
import env  from '../../config/env.js';

// ── POST /api/auth/customer/signup ──
// Validation: customerSignupSchema applied on route via validate() middleware
export async function signUpCustomer(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstName, lastName, email, phone, password, city } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      // await session.abortTransaction();
      // session.endSession();
      throw existing.phone === phone
        ? new ConflictError('Phone number already registered')
        : new ConflictError('Email already registered');
    }

    // Email verification token
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const customer = new Customer({
      firstName, lastName, email, phone, password, city,
      role:               'customer',
      emailVerifyToken:   tokenHash,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await customer.save({ session });
    await session.commitTransaction();
    session.endSession();

    // ── Send verification email outside transaction ──
    let emailSent = true;
      try {
        const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
        await sendEmailVerification(email, firstName, verifyUrl);
      } catch (emailErr) {
        emailSent = false;
        logger.error(`Verification email failed for rider ${email}: ${emailErr.message}`);
    }

    res.status(201).json({
      success: true,
      emailSent,
      message: 'Account created. Check your email to verify your address.',
      user:    customer.toJSON(),
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
}

// ── POST /api/auth/customer/login ──
// Validation: customerLoginSchema applied on route via validate() middleware
export async function signInCustomer(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'customer' }).select('+password');
    if (!user) return next(new AuthError('Invalid credentials'));

    // 1. Locked check first - security priority
    if (user.isLocked) {
      return res.status(423).json({ success: false, message: 'Account locked. Try again later.', locked: true });
    }

    // 2. Deactivated - admin explicitly disabled this account
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated', deactivated: true });
    }

    //3. Password check before revealing verification status
    // (Don't tell an attacker the account exists and is unverified)
    const valid = await user.matchPassword(password);
    if (!valid) {
      await user.incLoginAttempts?.();
      const attemptsLeft = 5 - (user.loginAttempts + 1);
      return res.status(401).json({ success: false, message: 'Invalid credentials', attemptsLeft });
    }

    //4. Email Verification check - AFTER password is confirmed correct
    //This way only someone who knows the password learns the account is unverified 
    if(!user.emailVerified){
      return res.status(403).json({
        success: false, 
        message: 'Please verify your email before signing in. ',
        emailUnverified: true, // <-- frontend uses this flag to show resend UI
        email: user.email, // <-- frontend pre-fills the resend form
      })
    }


    // 5. All checks passed - issues tokens
    await user.resetLoginAttempts?.();
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const accessToken = await issueTokens(res, user, req);

    res.json({ success: true, message: 'Login successful', accessToken, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}