// src/controllers/auth/rider.auth.js
import mongoose from 'mongoose';
import crypto   from 'crypto';
import Rider    from '../../models/user/rider.role.js';
import User     from '../../models/base/user.base.js';
import Zone     from '../../models/Zone.js';
import { issueTokens } from '../auth/auth.base.js';

import { sendEmailVerification } from '../../services/emailService.js';
import { ConflictError, AuthError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { env } from '../../config/env.js';

// ── POST /api/auth/rider/signup ──
// Validation: riderSignupSchema applied on route
export async function signUpRider(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      firstName, lastName, email, phone, password, city, operatingZoneId, // ObjectId of the zone they selected from dropdown
      vehicleType, vehicleModel, plateNumber,  nin, guarantorFullName, guarantorPhone, guarantorRelationship } = req.body;

     // ── 1. Check for duplicate email or phone ──
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      // await session.abortTransaction();
      // session.endSession();
      throw existing.phone === phone
        ? new ConflictError('Phone number already registered')
        : new ConflictError('Email already registered');
    }

     // ── 2. Validate the selected zone exists and belongs to chosen city ──
    // This prevents someone crafting a request with a fake zone ID
    const zone = await Zone.findOne({
      _id: operatingZoneId,
      city: city.toLowerCase(),
      isActive: true,
    });

    if(!zone) {
      throw new ValidationError('Selected zone is invalid or not available in your city');
    }

    // ── 3. Build email verification token ──
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const rider = new Rider({
      firstName, lastName, email, phone, password, 
      city: city.toLowerCase(),
      role:          'rider',
      status:        'pending_kyc', // riders gate at KYC, not email
      isOnline: false,

      // Zone stored as array — rider can cover multiple zones later
      // For signup we start with the one they selected
      operatingZone: [zone._id],

       // Vehicle info
      vehicleType: vehicleType,
      vehicleModel: vehicleModel,
      plateNumber: plateNumber?.toUpperCase(),
      nin,

      // Guarantor nested correctly under the subdocument
      guarantor:{
          fullName: guarantorFullName,
          phone: guarantorPhone,
          relationship: guarantorRelationship,
      },
    
      // KYC starts at not_submitted
      kyc: { status: 'not_submitted' },

      isAvailable:   false,
      emailVerifyToken:   tokenHash,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await rider.save({ session });
    await session.commitTransaction();
    session.endSession();
    // ── Transaction complete — DB work is done ──
    
    // ── 5. Send verification email outside transaction ──
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
      message: emailSent
      ? 'Rider account created. Check your email, then upload your KYC documents to start working.'
      : 'Rider account created but verification email failed. Use the resend option.',
      user:    rider.toJSON(),
    });


  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
}

// ── POST /api/auth/rider/login ──
// Validation: riderLoginSchema applied on route
export async function signInRider(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'rider' }).select('+password');
    if (!user) return next(new AuthError('Invalid credentials'));

    //1. Locked check first - security priority
    if (user.isLocked)
      return res.status(423).json({ success: false, message: 'Account locked. Try again later.', locked: true });

    // 2. Deactivated - admin explicitly disabled this account
    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is deactivated', deactivated: true });

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

    //5. Check KYC Status
    if (user.status === 'pending_kyc')
      return res.status(403).json({
        success: false,
        message: 'Your account is pending KYC approval. Upload your documents to continue.',
        kycPending: true,
      });

    // 6. All checks passed - issues tokens
    await user.resetLoginAttempts?.();
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const accessToken = await issueTokens(res, user, req);

    res.json({ success: true, message: 'Login successful', accessToken, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}