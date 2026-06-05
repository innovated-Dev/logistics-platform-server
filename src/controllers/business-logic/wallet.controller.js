// src/controllers/wallet.controller.js
// FIX: was '../../models/Wallet.js' — path depends on your actual file layout.
// Adjusted to match the flat models/ structure visible in your skeleton.
import Wallet from '../../models/Wallet.js';
import {
  initializePayment, verifyPayment, verifyBankAccount,
  getBanks, createTransferRecipient, initiateTransfer,
} from '../../services/paystackService.js';
import env              from '../../config/env.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { ValidationError, PaymentError, NotFoundError } from '../../utils/errors.js';
import { ok }  from '../../utils/response.js';
import { nanoid } from 'nanoid';

// ── GET /api/wallet ──
export async function getWallet(req, res, next) {
  try {
    const wallet = await Wallet.findOne({ owner: req.user._id });
    if (!wallet) throw new NotFoundError('Wallet not found');
    ok(res, {
      balance:         wallet.balance,
      codPendingDebit: wallet.codPendingDebit || 0,
      bankDetails:     wallet.bankDetails,
    });
  } catch (err) { next(err); }
}

// ── GET /api/wallet/transactions ──
// Validation: transactionQuerySchema applied on route (query)
export async function getTransactions(req, res, next) {
  try {
    const { page = 1, limit = 30, type } = req.query;
    const wallet = await Wallet.findOne({ owner: req.user._id });
    let txns = wallet?.transactions || [];
    if (type) txns = txns.filter(t => t.type === type);
    txns = txns.slice().reverse();
    const start = (parseInt(page) - 1) * parseInt(limit);
    ok(res, {
      transactions: txns.slice(start, start + parseInt(limit)),
      total: txns.length,
    });
  } catch (err) { next(err); }
}

// ── POST /api/wallet/topup ──
// Validation: initiateTopupSchema applied on route
export async function initiateTopup(req, res, next) {
  try {
    const { amount } = req.body;
    const reference  = `TOPUP-${req.user._id}-${nanoid(10)}`;
    const data = await initializePayment({
      email:       req.user.email,
      amount,
      reference,
      callbackUrl: `${env.FRONTEND_URL}/payment/verify?type=topup`,
      metadata:    { type: 'topup', userId: req.user._id.toString() },
    });
    ok(res, { authorizationUrl: data.authorization_url, reference });
  } catch (err) { next(err); }
}

// ── GET /api/wallet/verify ──
// Validation: verifyTopupQuerySchema applied on route (query)
export async function verifyTopup(req, res, next) {
  try {
    const { ref } = req.query;
    const data    = await verifyPayment(ref);
    if (data.status !== 'success') throw new PaymentError('Payment was not successful');

    // Idempotency — prevent double-credit on the same reference
    const alreadyProcessed = await cacheGet(`ps:verified:${ref}`);
    if (alreadyProcessed)
      return ok(res, { message: 'Payment already credited', amount: data.amount / 100 });

    const amount = data.amount / 100;
    const userId = data.metadata?.userId || req.user._id;
    const wallet = await Wallet.findOne({ owner: userId });
    await wallet.credit(amount, 'Wallet top-up via Paystack', null, { paystackRef: ref });

    await cacheSet(`ps:verified:${ref}`, true, 86400 * 7);
    ok(res, { message: `₦${amount.toLocaleString()} added to your wallet`, amount });
  } catch (err) { next(err); }
}

// ── GET /api/wallet/banks ──
export async function listBanks(req, res, next) {
  try {
    const cached = await cacheGet('banks:ng');
    if (cached) return ok(res, { banks: cached });
    const banks = await getBanks();
    await cacheSet('banks:ng', banks, 86400);
    ok(res, { banks });
  } catch (err) { next(err); }
}

// ── POST /api/wallet/verify-bank ──
// Validation: verifyBankSchema applied on route
export async function verifyBank(req, res, next) {
  try {
    const { accountNumber, bankCode } = req.body;
    const data = await verifyBankAccount(accountNumber, bankCode);
    ok(res, { accountName: data.account_name, accountNumber: data.account_number });
  } catch (err) { next(err); }
}

// ── POST /api/wallet/withdraw ──
// Validation: withdrawSchema applied on route
export async function withdraw(req, res, next) {
  try {
    const { amount, accountNumber, bankCode, bankName, accountName } = req.body;

    const wallet = await Wallet.findOne({ owner: req.user._id });
    if (!wallet || wallet.balance < amount)
      throw new PaymentError(`Insufficient balance. Available: ₦${(wallet?.balance || 0).toLocaleString()}`);

    if (req.user.role === 'pickman' && (wallet.codPendingDebit || 0) > 0)
      throw new ValidationError(
        `You have ₦${wallet.codPendingDebit.toLocaleString()} in uncleared COD fees. Settle them first.`
      );

    let recipientCode = wallet.bankDetails?.recipientCode;
    if (!recipientCode) {
      const recipient = await createTransferRecipient({ name: accountName, accountNumber, bankCode });
      recipientCode   = recipient.recipient_code;
      wallet.bankDetails = { bankCode, bankName, accountNumber, accountName, recipientCode, verifiedAt: new Date() };
      await wallet.save();
    }

    await wallet.debit(amount, `Withdrawal to ${bankName} ${accountNumber}`);

    const ref = `WD-${req.user._id}-${nanoid(8)}`;
    await initiateTransfer({
      amount,
      recipientCode,
      reason:    `OffScape withdrawal`,
      reference: ref,
    });

    ok(res, { message: `₦${amount.toLocaleString()} transfer initiated. Arrives within minutes.`, reference: ref });
  } catch (err) { next(err); }
}

// ── POST /api/wallet/airtime ──
// Validation: convertAirtimeSchema applied on route
export async function convertAirtime(req, res, next) {
  try {
    const { network, amount } = req.body;
    const rates    = { mtn: 78, airtel: 75, glo: 72, etisalat: 70 };
    const rate     = rates[network] / 100;
    const credited = Math.floor(amount * rate);

    const wallet = await Wallet.findOne({ owner: req.user._id });
    await wallet.credit(
      credited,
      `Airtime conversion: ${network.toUpperCase()} ₦${amount} → ₦${credited} (${rates[network]}%)`,
      null,
      { network, airtimeAmount: amount, rate: rates[network] }
    );

    ok(res, { message: `₦${credited.toLocaleString()} credited to your wallet`, creditAmount: credited, rate: rates[network] });
  } catch (err) { next(err); }
}

// ── GET /api/wallet/cod-debit ──
export async function getCodDebit(req, res, next) {
  try {
    const wallet = await Wallet.findOne({ owner: req.user._id });
    ok(res, { codPendingDebit: wallet?.codPendingDebit || 0 });
  } catch (err) { next(err); }
}

// ── POST /api/wallet/settle-cod ──
export async function settleCodDebit(req, res, next) {
  try {
    const wallet = await Wallet.findOne({ owner: req.user._id });
    if (!wallet || !wallet.codPendingDebit)
      return ok(res, { message: 'No COD fees outstanding' });

    const debitAmount = wallet.codPendingDebit;
    await wallet.debit(debitAmount, 'COD platform fee settlement');
    wallet.codPendingDebit = 0;
    await wallet.save();

    ok(res, { message: `₦${debitAmount.toLocaleString()} COD fees cleared.`, settled: debitAmount });
  } catch (err) { next(err); }
}