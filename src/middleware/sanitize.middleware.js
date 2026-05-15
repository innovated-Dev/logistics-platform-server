// middleware/sanitize.middleware.js
import expressMongoSanitize from '@exortek/express-mongo-sanitize';

/**
 * MODERN APPROACH (2025): @exortek/express-mongo-sanitize
 * 
 * Purpose: Prevents NoSQL injection attacks by sanitizing user input
 * 
 * What it does:
 * - Removes keys starting with '$' (MongoDB operators like $gt, $ne, $where)
 * - Removes keys containing '.' (prevents prototype pollution)
 * - Works with req.body, req.query, and req.params
 * - Supports nested objects and arrays
 * - TypeScript ready
 * 
 * Installation:
 * npm install @exortek/express-mongo-sanitize
 * 
 * Example Attack it Prevents:
 * Input:  { "email": {"$gt": ""}, "password": {"$gt": ""} }
 * Output: { "email": "", "password": "" }
 */

/**
 * OPTION 1: Automatic Sanitization (Recommended)
 * 
 * Sanitizes ALL incoming requests automatically
 * Works with req.body and req.query out of the box
 */
export const sanitizeInput = expressMongoSanitize({
  replaceWith: '_',  // Replace $ and . with underscore
  
  // Skip sanitization for specific routes (optional)
  skipRoutes: ['/webhook', '/api/raw-data'],
  
  // String sanitization options
  stringOptions: {
    trim: true,        // Remove whitespace
    maxLength: 10000,  // Prevent huge strings
  },
  
  // Array sanitization options
  arrayOptions: {
    filterNull: true,  // Remove null/undefined
    distinct: false,   // Keep duplicates (set true to remove)
  },
  
  // Log sanitized requests (useful for debugging)
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️ Malicious input detected in ${req.path}:`, key);
  },
});

/**
 * OPTION 2: Manual Sanitization
 * 
 * Gives you control over WHEN to sanitize
 * Useful if you need to inspect data before cleaning it
 */
export const sanitizeManual = expressMongoSanitize({
  mode: 'manual',  // Don't auto-sanitize
  replaceWith: '_',
});

// Usage in route:
// router.post('/data', sanitizeManual, (req, res) => {
//   req.sanitize({ replaceWith: '_' });  // Sanitize when ready
//   // ... your logic
// });

/**
 * OPTION 3: Route Params Sanitization
 * 
 * For sanitizing URL parameters like /user/:userId
 * Apply this to specific params that might contain user input
 */
export const paramSanitizeHandler = expressMongoSanitize.paramSanitizeHandler;

// Usage in app.js or routes:
// app.param('userId', paramSanitizeHandler());
// app.param('postId', paramSanitizeHandler());

/**
 * OPTION 4: Strict Mode (Remove Data Completely)
 * 
 * Instead of replacing with '_', completely removes malicious keys
 */
export const sanitizeStrict = expressMongoSanitize({
  removeData: true,  // Remove instead of replace
  onSanitize: ({ req, key }) => {
    console.error(`🚨 Malicious input REMOVED from ${req.path}:`, key);
  },
});

/**
 * OPTION 5: Development Mode (Dry Run)
 * 
 * Test what would be sanitized without actually sanitizing
 * Great for debugging and testing
 */
export const sanitizeDryRun = expressMongoSanitize({
  dryRun: true,  // Log but don't modify
  onSanitize: ({ req, key }) => {
    console.log(`[DRY RUN] Would sanitize ${req.path}:`, key);
  },
});

/**
 * RECOMMENDED CONFIGURATION FOR PRODUCTION
 */
export const sanitizeProduction = expressMongoSanitize({
  replaceWith: '_',
  stringOptions: {
    trim: true,
    maxLength: 5000,
  },
  arrayOptions: {
    filterNull: true,
    distinct: false,
  },
  // Only log in development
  ...(process.env.NODE_ENV === 'development' && {
    onSanitize: ({ req, key }) => {
      console.warn(`⚠️ Sanitized: ${req.path}[${key}]`);
    },
  }),
});

/**
 * COMPARISON: Old vs New
 * 
 * OLD (express-mongo-sanitize - 2021):
 * ❌ Not updated in 4 years
 * ❌ No TypeScript support
 * ❌ Limited options
 * ❌ Express 4.x only
 * 
 * NEW (@exortek/express-mongo-sanitize - 2025):
 * ✅ Updated 10 days ago
 * ✅ TypeScript included
 * ✅ Manual mode, skip routes, custom sanitizers
 * ✅ Works with latest Express
 * ✅ String/array options
 * ✅ Route params handler
 */