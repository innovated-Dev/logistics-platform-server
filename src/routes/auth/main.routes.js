// src/routes/auth/main.routes.js
// Mounts role-specific auth sub-routers + shared auth routes.
// /api/auth/customer/...
// /api/auth/merchant/...
// /api/auth/rider/...
// /api/auth/...  (common: refresh, logout, me, etc.)
import { Router } from 'express';

import customerAuthRoutes from './customer.routes.js';
import merchantAuthRoutes from './merchant.routes.js';
import riderAuthRoutes    from './rider.routes.js';
import commonAuthRoutes   from './common.routes.js';
import sseRouter from '../../sse/sseRoute.js';

const router = Router();

router.use('/customer', customerAuthRoutes);
router.use('/merchant', merchantAuthRoutes);
router.use('/rider',    riderAuthRoutes);
router.use('/',         commonAuthRoutes);   // refresh, logout, me, verify-email, etc.
router.use('/sse', sseRouter)

export default router;