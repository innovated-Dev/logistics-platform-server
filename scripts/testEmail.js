// scripts/testEmail.js  — run once, then delete
import { send } from '../src/services/emailService.js';

await send(
  'your-real-email@gmail.com',
  'OffScape Email Test',
  'This is the plain text version.',
  '<h1>This is the HTML version</h1><p>Brevo is working!</p>'
);
console.log('Done — check your inbox');