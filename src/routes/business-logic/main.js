// src/routes/main.routes.js
// Central router — mounts every sub-router onto the Express app.
// Import this once in server.js: app.use('/api', mainRouter)
import { Router } from 'express';

import authRouter     from '../auth/main.routes.js';
import ordersRouter   from '../business-logic/orders.js';
import ridersRouter   from '../business-logic/riders.js';
import walletRouter   from './wallet.js';
import zonesRouter    from './zones.js';
import supportRouter  from '../auth/support.official.js';
import adminRouter    from '../auth/admin.official.js';
import webhookRouter  from './webhook.js';

const router = Router();

// Webhook MUST come before any body-parser — it needs raw Buffer
router.use('/webhook',  webhookRouter);

router.use('/auth',     authRouter);
router.use('/orders',   ordersRouter);
router.use('/riders',   ridersRouter);
router.use('/wallet',   walletRouter);
router.use('/zones',    zonesRouter);
router.use('/support',  supportRouter);
router.use('/admin',    adminRouter);

export default router;