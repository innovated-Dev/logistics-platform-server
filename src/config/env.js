// src/config/env.js — Environment validation & typed config
// The app exits at startup rather than failing at runtime on a missing key.
// NOTE: Environment is loaded in server.js (import 'dotenv/config')
// This file only validates and exports the typed env config

const REQUIRED = [
  'MONGODB_URI','JWT_SECRET', 'JWT_EXPIRE', 'REFRESH_TOKEN_SECRET', 'REFRESH_TOKEN_EXPIRE',
  'JWT_RESET_SECRET', 
  'JWT_RESET_EXPIRE',
  'PAYSTACK_SECRET_KEY',
  'CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET',
  'TERMII_API_KEY','SMTP_HOST','SMTP_USER','BREVO_APIKEY', 'EMAIL_FROM',
  'REDIS_URL','FRONTEND_URL', 'FIELD_ENCRYPTION_KEY',
  'SMILE_PARTNER_ID',
  'SMILE_API_KEY',
  'B2_ENDPOINT','B2_REGION','B2_APPLICATION_KEY_ID','B2_APPLICATION_KEY','B2_BUCKET_NAME',
  'B2_BUCKET_ID'
];

export function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  
  // LEARNING DOCS 
  /**
   * What filter function does here is that, it check in every strings of array anyone of this that passes the test and create new array of those that pass the test.
   * 
   * Here's the test: process.env already contained all the keys that are available in env files, so the REQUIRED ARRAY run the filter function to check if any of this of child array is available with the same thing in process.env so if is not available in the process.env create a new array of the strings of an array that are not are not in the process.env but available in required array called MISSING
   * 
   * SUMMARY THE FILTER JUST CHECK IF THE STRINGS IN THE REQUIRED ARRAY CORRELATE WITH THE PROCESS.ENV  
   */

  if (missing.length) {
    console.error('❌  Missing required env vars:\n' + missing.map(k=>`   • ${k}`).join('\n'));
    

    // (' CLAT_API, SURT')
    process.exit(1);
  }

  /* NOW, we got a new array created earlier from the filter function named MISSING, so now the length of this array for example ["CLAT_API", "SURT"] there length is automatically 2, then return console.error message that missing required env concatenated with a new array mapped, as this array is mapped out into a new array with a dot in front of them, the join make the array string with a new line, so we have this output, "Missing required env vars:
     • CLAT_API
     • SURT" 
  */

  if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
    console.error('❌  JWT_SECRET must be ≥ 32 chars.');
    process.exit(1);
  }
  /**
   * Here the if statement has to check the process.env files especially the JWT_SECRET length so ?? a nullish coalesing operator is a perform on this particular env files which checks if the left hand value is null or undefined it return the right hand values or otherwise it return, it return the left hand values, that is the JWT SECRET first undergo the first it is there or not if it is not there it return the value 0 and the value 0 is less 32 character so we have an error secondly if it is abut the value is not up to 32 chracter it shows error message except the jwt is 32 chars
   */

  ['ORS_API_KEY','ANTHROPIC_API_KEY','ADMIN_WHATSAPP'].forEach(k => {
    if (!process.env[k]) console.warn(`⚠️   Optional env not set: ${k}`);
  });

  //THE LAST CHECK PERFORM HERE let's look into it
  /**
   * we have an array that contains ors_api_key, antropic_api_key, and admin_whatsapp, so in this array, the foreach loop is run on the array so now if statement check is perform if in the array each of the strings of an array represented with k parameter is not present in process.env file, return an error message to the console which says "Optional env not: ${k}";
   */
}
/**
 * so this overall check is run on in validateenv function so ifm so it check it properfly in any file where the env files will  be needed example server.js, cluster.js file and others
 * 
 * 
 * 1. i have a question concerning the cluster.js especilay it uses for multi core, i  want to know why is needed in this project, and when im going the ruht the code written in cluster.js i found the cluster.js say something about node instance i don't really get want instance really means
 * 2. my second question is that does the the node is single thread but there's also an event loop that handles request with async await
 * 
 * 3. what is difference between async await and promise and when are the uses
 * 
 * PLEASE IN BOTH TEACHNICAL AND PRACTICAL ASPECT THAT WE MAKE ACTAULLY UNDERSTAND WHAT IS HAPPENING AND ALSO CHECK MY EXPLAINATION ON VALIDATE ENV FUNCTION IF THERE;S ERROR IN MY EXPLANATION 
 */


const env = {
  NODE_ENV:    process.env.NODE_ENV || 'development',
  PORT:        parseInt(process.env.PORT || '4000'),
  WORKERS:     parseInt(process.env.CLUSTER_WORKERS || '0'), // 0 = auto (CPU count)
  MONGODB_URI: process.env.MONGODB_URI,
  REDIS_URL:   process.env.REDIS_URL,

 JWT_SECRET:           process.env.JWT_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,     
  JWT_RESET_SECRET:     process.env.JWT_RESET_SECRET,           
  JWT_EXPIRE:           process.env.JWT_EXPIRE || '15m',        
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || '7d', 
  JWT_RESET_EXPIRE:     process.env.JWT_RESET_EXPIRE || '15m',   
  FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,

  PAYSTACK_SECRET: process.env.PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC: process.env.PAYSTACK_PUBLIC_KEY,

  CLOUDINARY_NAME:   process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_KEY:    process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_SECRET: process.env.CLOUDINARY_API_SECRET,

  TERMII_KEY:    process.env.TERMII_API_KEY,
  TERMII_SENDER: process.env.TERMII_SENDER_ID || 'OffScape',

  SMTP_HOST:  process.env.SMTP_HOST,
  SMTP_PORT:  parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER:  process.env.SMTP_USER,
  BREVO_APIKEY:  process.env.BREVO_APIKEY,
  EMAIL_FROM: process.env.EMAIL_FROM || 'OffScape <noreply@cabinetoffscape.com>',

  ORS_KEY:         process.env.ORS_API_KEY,
  ANTHROPIC_KEY:   process.env.ANTHROPIC_API_KEY,
  ADMIN_WHATSAPP:  process.env.ADMIN_WHATSAPP,
  FRONTEND_URL:    process.env.FRONTEND_URL || 'http://localhost:3000',

  // Business rules — single source of truth
  PLATFORM_FEE:      parseFloat(process.env.PLATFORM_FEE_PERCENT || '5') / 100,  // 0.05
  COD_FEE:           parseInt(process.env.COD_HANDLING_FEE || '100'),            // ₦100
  INSURANCE_RATE:    parseFloat(process.env.INSURANCE_RATE || '0.005'),           // 0.5%
  MIN_INSURANCE:     50,                                                           // ₦50 floor
  CANCEL_WINDOW_MIN: parseInt(process.env.CANCELLATION_WINDOW_MINUTES || '5'),
  ASSIGN_TIMEOUT_S:  parseInt(process.env.RIDER_ASSIGNMENT_TIMEOUT_SECONDS || '90'),
  LATE_CANCEL_RATE:  0.5,   // customer charged 50% of fee on late cancel
  COMP_POOL_FIXED:   300,   // ₦ paid from pool to rider on early cancel

  SMILE_PARTNER_ID:    process.env.SMILE_PARTNER_ID,
  SMILE_API_KEY:       process.env.SMILE_API_KEY,
  B2_ENDPOINT:         process.env.B2_ENDPOINT,
  B2_REGION:           process.env.B2_REGION,
  B2_APPLICATION_KEY_ID:    process.env.B2_APPLICATION_KEY_ID,
  B2_APPLICATION_KEY:       process.env.B2_APPLICATION_KEY,
  B2_BUCKET_NAME:           process.env.B2_BUCKET_NAME,
  B2_BUCKET_ID:             process.env.B2_BUCKET_ID,

  isProd: () => process.env.NODE_ENV === 'production',
  isDev:  () => process.env.NODE_ENV !== 'production',
};


export default env ;