// src/controllers/auth/pickman.auth.js
import mongoose        from 'mongoose';
import crypto          from 'crypto';
import Pickman         from '../../models/user/pickman.role.js';
import User            from '../../models/base/user.base.js';
import Zone            from '../../models/Zone.js';
import KycApplication  from '../../models/kyc.js';
import { issueTokens } from './auth.base.js';
import { sendEmailVerification } from '../../services/emailService.js';
import { ConflictError, AuthError, ValidationError } from '../../utils/errors.js';
import env        from '../../config/env.js';
import { logger }      from '../../utils/logger.js';

// ── POST /api/auth/pickman/signup ──
// Validation: PickmanSignupSchema applied on route
export async function signUpPickman(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
        firstName, lastName, email, phone, password, city,
        operatingZoneId,
        vehicleType, vehicleModel, plateNumber, nin,
        guarantorFullName, guarantorPhone, guarantorRelationship, guarantorAddress,
      } = req.body;

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

      // ── 4. Create the pickman with pending KYC status ──
    const pickman = new Pickman({
      firstName,
      lastName,
      email,
      phone,
      password,
      city:        city.toLowerCase(),
      status:      'pending_kyc',
      isOnline:    false,

      // Zone stored as array — pickman can cover multiple zones later
      operatingZones: [zone._id],

      // Vehicle info — vehicleModel and plateNumber are optional for bicycle
      vehicleType,
      ...(vehicleModel && { vehicleModel }),
      ...(plateNumber  && { plateNumber: plateNumber.toUpperCase() }),

      // NIN — encrypted by pre('save') hook on the Pickman schema
      nin,

      // Email verification
      emailVerifyToken:   tokenHash,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Create KYC application inside the same transaction
    const kycApp = new KycApplication({
      riderId:     pickman._id,
      vehicleType: pickman.vehicleType,
      countryCode: 'NG',
      status:      'draft',
      // Store guarantor info collected at signup
      guarantor: {
        fullName:     guarantorFullName,
        phone:        guarantorPhone,
        address:      guarantorAddress,
        relationship: guarantorRelationship,
      },
    });

    // Link KycApplication back to Pickman
    pickman.kycApplication = kycApp._id;

    // Save both inside the transaction — if either fails, both roll back
    await pickman.save({ session });
    await kycApp.save({ session });
    
    // ── Transaction complete — DB work is done ──

    await session.commitTransaction();
    session.endSession();
    
    // ── 5. Send verification email outside transaction ──

    // Issue tokens so frontend can make authenticated KYC requests immediately
    const accessToken = await issueTokens(res, pickman, req);

    let emailSent = true;
 
    try {
      const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
      await sendEmailVerification(email, firstName, verifyUrl);
    } catch (emailErr) {
      emailSent = false;
      logger.error(`Verification email failed for Pickman ${email}: ${emailErr.message}`);
    }

    res.status(201).json({
      success: true,
      emailSent,
      message: emailSent
        ? 'Account created. Check your email, then upload your KYC documents to start working.'
        : 'Account created but verification email failed. Use the resend option.',
      accessToken,
      user: {
        ...pickman.toSafeObject(),
        vehicleType: pickman.vehicleType,  // frontend KYC view needs this immediately
      },
    });


  } catch (err) {
    console.error("TRANSACTION ABORTED. Error details:", err);
    
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    // Pass the error to your error handling middleware
    next(err);
  }
}

// ── POST /api/auth/pickman/login ──
// Validation: pickmanLoginSchema applied on route
export async function signInPickman(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'pickman' }).select('+password');
    console.log(user);
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

    // 5. KYC pending — let them in but frontend redirects to /kyc-pending
      
    if (user.status === 'pending_kyc') {
      await user.resetLoginAttempts?.();   // ← add this
      user.lastLogin = new Date();          // ← add this
      await user.save({ validateBeforeSave: false }); // ← add this
      
      const accessToken = await issueTokens(res, user, req);
      return res.json({
        success:    true,
        kycPending: true,
        message:    'Please upload your KYC documents to start working.',
        accessToken,
        user:       user.toSafeObject(),
      });
    }

    // 6. All checks passed - issues tokens
    await user.resetLoginAttempts?.();
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const accessToken = await issueTokens(res, user, req);

   res.json({ success: true, message: 'Login successful', accessToken, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}