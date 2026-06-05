// src/routes/main.routes.js
// Central router — mounts every sub-router onto the Express app.
// Import this once in server.js: app.use('/api', mainRouter)
import { Router } from 'express';

import authRouter     from '../auth/main.routes.js';
import ordersRouter   from '../business-logic/orders.js';
import pickmenRouter   from '../business-logic/pickmen.js';
import walletRouter   from './wallet.js';
import zonesRouter    from './zones.js';
import supportRouter  from '../auth/support.official.js';
import adminRouter    from '../auth/admin.official.js';
import webhookRouter  from './webhook.js';
import kycRouter      from './kyc.js';
import adminKycRouter from './admin.kyc.routes.js';

const router = Router();

// Webhook MUST come before any body-parser — it needs raw Buffer
router.use('/webhook',  webhookRouter);

router.use('/auth',     authRouter);
router.use('/orders',   ordersRouter);
router.use('/pickmen',   pickmenRouter);
router.use('/wallet',   walletRouter);
router.use('/zones',    zonesRouter);
router.use('/support',  supportRouter);
router.use('/kyc',      kycRouter);
router.use('/admin/kyc', adminKycRouter);
router.use('/admin',    adminRouter);

export default router;