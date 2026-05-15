OffScape Logistics — Business Logic Documentation
Preface: What This System Actually Is
Before diving into mechanics, it helps to understand the philosophical foundation. OffScape is not a delivery company. It is a trust infrastructure — a marketplace that connects people who need things moved with people who can move them, in an environment where trust between strangers is historically low, addresses are unreliable, and disputes are common. Every feature in this system exists to answer one question: how do we make honesty the cheapest option for everyone involved?
The system borrows two mental models from existing platforms. From Uber, it takes the idea of real-time dispatch, GPS accountability, and automatic matching. From Fiverr, it takes the idea of a bidding marketplace where service providers compete on price and quality. What makes OffScape different is that it layers these models over a zone-based geographic intelligence system built specifically for how people in Nigerian cities actually navigate and communicate location.
Version 1 is deliberately scoped. Customers cannot buy products through the platform — they are only shipping things they already own or have already purchased elsewhere. Merchants are purely logistics clients, not storefront operators. This keeps the system focused and avoids the complexity of e-commerce inventory management before the logistics core is proven.

Part One: The Three Actors and Their Relationships
Understanding who each actor is, what they want, and what they fear is the foundation of every business rule in this system.
The Customer is an individual who needs something moved from one place to another. Their primary emotion is anxiety — they worry the rider won't show up, that their item will be damaged, that they'll be overcharged, or that something will go wrong and no one will help them. The system must eliminate this anxiety through visibility and accountability. A customer who can see their rider approaching on a map and knows exactly what they were charged and why will trust the platform and return.
The Rider is an independent contractor who earns income by completing deliveries. Their primary concern is fairness — they fear wasting fuel on wrong addresses, being cheated out of earnings by dishonest customers, or being assigned jobs in unfamiliar areas where they'll get lost. The system must protect riders from absorbing costs caused by other people's mistakes, which is why zone matching, location-change fees, and the compensation pool exist.
The Merchant in Version 1 is a business owner — a shop, a small supplier, a market trader — who ships goods on behalf of their offline customers. They don't sell through OffScape; they use OffScape the same way a business uses DHL. Their primary need is reliability and visibility so they can handle customer inquiries confidently.
Support and Admin form the human and AI backbone of the platform's dispute and operations layer. Support is an AI agent embedded in the live chat — it handles FAQs, order status queries, refund status checks, and policy questions automatically. When a query requires human judgment (an active dispute, a fraud allegation, a KYC escalation), the AI agent recognises its limits and escalates the conversation to a human admin via WhatsApp, keeping the conversation context intact so the customer doesn't have to repeat themselves. The admin is a real person with access to the full operational dashboard — they can approve KYC, suspend accounts, manage the compensation pool, and resolve disputes with GPS evidence.

Part Two: How Orders Are Created and Assigned
The Customer Flow
When a customer creates a shipment, they provide a pickup address, a delivery address, a description of the package, and the package type (document, small parcel, large parcel, fragile item, etc.). The system immediately calculates a fee breakdown using the following formula:
The base fee covers the minimum cost of any delivery, regardless of distance — think of it as the "I'm coming to get it" charge. The distance fee is calculated from the actual road distance between pickup and drop-off, multiplied by a per-kilometre rate that varies by vehicle type. The platform fee is OffScape's commission, charged as a percentage of the combined base and distance fees. Insurance is an optional but recommended add-on, and we'll cover its mechanics in detail shortly. The total is the sum of all applicable components.
Once the fee is confirmed, the customer pays either upfront via wallet or card, or selects pay-on-delivery (where the rider collects cash). The system then runs the zone-detection algorithm, which takes the customer's pickup address, identifies which operating zone it falls within, and queries the database for online riders whose registered operating zone matches. From that filtered pool, it selects the three nearest available riders based on real-time GPS coordinates and sends each of them a simultaneous job notification with a 90-second acceptance window. The first rider to tap "Accept" claims the job. The other two notifications are automatically dismissed.
This simultaneity is important. It means customers aren't waiting in a queue — the system is racing riders against each other in the background, invisibly, so the customer gets matched quickly.
The Merchant Flow
When a merchant posts a shipment, the experience is intentionally more deliberate because merchants are shipping on behalf of their own customers and want some control over who handles their goods and at what price. The merchant has three assignment modes to choose from.
In auto-match mode, the system behaves exactly as it does for customer orders — it finds the nearest suitable rider and dispatches automatically. This is ideal for time-sensitive shipments where price is less important than speed.
In set-budget mode, the merchant declares the maximum they're willing to pay for the delivery. Riders in the matching zone see the job posted with that budget cap and can accept it if they find the rate acceptable. The first rider to accept wins the job.
In open-bidding mode, the system opens a short competitive window (typically five minutes) during which multiple riders can submit bids. Riders who are closer, less busy, or simply more willing to take the job at a lower rate will bid competitively. The merchant reviews the bids — each showing the rider's rating, vehicle type, estimated distance, and bid amount — and selects their preferred option. This is the Fiverr-like mechanic in action: service providers compete, quality and price are visible, and the client chooses.
From the rider's perspective, both customer auto-assignments and merchant bids appear in the same environment but in different ways. Auto-assigned customer jobs arrive as a direct modal overlay on the rider's screen — "New job assigned, accept within 90 seconds" — because the customer's experience depends on a fast response. Merchant bids appear in the Available Jobs feed as cards the rider can browse and choose to bid on proactively. The rider sees the same information either way: pickup location, delivery location, distance from their current position, package type, estimated pay, and whether it's a customer order or a merchant post.

Part Three: Zone-Based Matching — How It Actually Works
The zone system is arguably the most Nigeria-specific and competitively defensible feature in the platform. Here is the real-world problem it solves.
In a city like Ibadan, a rider based in Bodija has intimate knowledge of that area's layout, the shortcuts, the market days that block certain roads, and the landmarks customers will actually describe ("opposite the blue mosque" or "beside First Bank Bodija branch"). That same rider sent to Ojoo or Iwo Road is operating blind — they'll call the customer multiple times, get frustrated, burn extra fuel, and take twice as long. This makes them unhappy, makes the customer unhappy, and reduces the number of jobs they can complete in a day.
The zone system prevents this by requiring every rider to declare their operating zone or zones during profile setup. When an order comes in, the system only considers riders whose declared zones overlap with either the pickup or delivery location. This means a Bodija rider gets Bodija jobs. A Mokola rider gets Mokola jobs. Over time, as the platform accumulates delivery data, zone boundaries can be refined based on actual rider performance and completion rates — this is the competitive data moat that grows stronger with usage.
For customers, the zone system is invisible. They enter their address, the system handles the matching, and they get a local rider who knows the area. The transparency is in the outcome — faster pickups, fewer "I'm lost" calls — not in the mechanics.

Part Four: Real-Time Tracking and Its Role in Every Business Rule
Real-time GPS tracking is not just a user-experience feature — it is the enforcement mechanism for almost every business rule in the platform. Understanding this is critical to understanding why so many seemingly separate features are actually connected.
When a rider accepts a job, their app begins broadcasting their GPS coordinates via Socket.IO at regular intervals. The customer's tracking screen receives these broadcasts and updates a live map. Both parties can see each other. This creates what you might call mutual accountability — neither side can claim ignorance of where the other was.
This GPS trail is also persisted to the database continuously. It is not just a live stream that disappears — it is a timestamped record of where the rider was at every moment during the delivery. This record becomes evidence in disputes, the basis for fee calculations when locations change, and the proof of delivery when a customer claims the rider never arrived.
Location Change Fees — Why They Are Necessary and How They Work
When a customer books a delivery, they commit to a pickup and drop-off address. The fee they paid was calculated based on that distance. If they call the rider mid-journey and ask them to go somewhere else, they are unilaterally changing the economic terms of the transaction. Without a fee adjustment, the rider absorbs that cost silently — more fuel, more time, a route they didn't budget for. This is how platforms lose riders.
When a customer attempts to change the drop-off location after the rider has been dispatched, the system intercepts this change, calculates the new distance using the rider's current GPS position as the starting point and the new destination as the endpoint, computes the additional distance fee, and presents the customer with a transparent breakdown: "Your delivery has changed from X to Y. Additional distance: Z km. Additional fee: ₦[amount]." The customer can accept and pay the difference, or they can leave the original address unchanged.
This is behavioural design, not punishment. Customers who know a fee exists for changes will give accurate addresses upfront, which is exactly what the platform needs to function efficiently.

Part Five: Cancellation Policies and the Compensation Pool
Two distinct cancellation scenarios require different handling because they have different moral structures.
Early cancellation happens when a customer books a delivery but cancels within five minutes of placing the order, before the rider has moved meaningfully toward the pickup. In this window, the rider hasn't yet invested significant time or fuel. However, they did accept the job and may have declined other available jobs in the same window. The platform compensates the rider a fixed amount from the compensation pool — a reserve fund maintained from a portion of platform fees. This keeps riders from feeling that accepting a job and then losing it to a quick cancellation is a net loss. The customer may receive a partial or full refund depending on how early they cancelled.
Late cancellation happens after the rider has already begun moving toward the pickup — the GPS trail confirms they were en route. In this scenario, the rider has already spent real fuel and real time. The cost of that cannot be absorbed by the platform alone, so the customer is charged 50% of the delivery fee, which goes directly to the rider as compensation. This is the correct moral framing: the customer who caused the late cancellation bears the cost of it.

Part Six: The Insurance Logic and How It Fits the Fee Structure
This is worth unpacking carefully because the fee structure you've described — baseFee, distanceFee, platformFee, insurance, total — actually contains a very elegant insurance model if you implement it correctly.
The core insight is that insurance in a delivery context is not a flat subscription fee. It is a per-shipment risk premium calculated against the declared value of the item being shipped. This aligns incentives correctly: a customer shipping a ₦500 envelope pays almost nothing for insurance, while a customer shipping a ₦50,000 phone pays a proportionally meaningful premium that actually reflects the risk.
Here is how I would recommend structuring it. When the customer describes their package, they declare its approximate value — not a full inventory assessment, just a good-faith figure. The insurance fee in the breakdown is then calculated as a small percentage of that declared value, something in the range of 0.5% to 1%. So a ₦10,000 item would generate an insurance fee of ₦50 to ₦100, which is genuinely negligible from the customer's perspective but collectively creates a meaningful insurance reserve across thousands of deliveries.
This insurance fee flows into a separate insurance reserve account managed by the admin, distinct from the compensation pool (which handles cancellation scenarios) and distinct from platform revenue. When a legitimate damage or loss claim is filed, the payout comes from this reserve.
The natural question is: what happens if a customer under-declares the value to save on the insurance premium and then files a claim for the full actual value? The system handles this by capping the claim payout at the declared value plus a small reasonable buffer. If a customer declared ₦5,000 and files a claim for ₦45,000, the policy only covers up to the declared amount. This creates an incentive for honest declaration without requiring the platform to audit every package.
For very high-value items — say anything above ₦50,000 — it would be reasonable in Version 2 to make insurance mandatory rather than optional, since the platform's liability exposure becomes significant. In Version 1, making it prominently recommended with a clear explanation of what it covers is sufficient.
The insurance also integrates naturally with the pay-on-delivery flow. Since COD means no upfront payment, insurance for COD orders should either be collected from the rider's share upon delivery or pre-authorized on the customer's account if they have one. This prevents customers from using COD to avoid paying insurance premiums on high-value items.

Part Seven: Pay-on-Delivery — How the Platform Still Earns
Pay-on-delivery is essential for the Nigerian market because a significant portion of potential customers either don't have cards, don't trust online payment, or both. Excluding COD would be excluding a major user segment.
The mechanics work through the rider's wallet. When a COD delivery is completed, the rider collects the full delivery fee in cash from the customer. The system records the platform's commission portion — typically the platform fee percentage — as a pending debit on the rider's OffScape wallet. The rider keeps the remainder immediately but cannot withdraw their accumulated earnings until the pending COD debits are cleared. This self-enforcing mechanism means the platform doesn't need to chase riders for its fee — riders clear their debits proactively because it unblocks their withdrawals.
The OTP verification step strengthens this considerably. When a rider taps "Confirm Delivery" on a COD order, the system sends a one-time PIN to the customer's phone. The rider must enter this PIN to complete the delivery on their side. This creates cryptographic proof that the rider physically met the customer — something the GPS trail shows approximately, but the OTP confirms definitively.

Part Eight: Security, KYC, and What Happens When Things Go Wrong
Rider onboarding is the first line of defence. Before a rider can receive any job, they must submit their National Identification Number, a valid driver's licence, vehicle details, and a guarantor form with the guarantor's contact information and address. The admin's KYC dashboard is where a human reviews and approves or rejects these submissions. Only after approval does the rider's status change to active.
The guarantor mechanism is culturally significant in the Nigerian context. It creates social accountability that transcends the digital platform — a rider who knows that a family member or community member co-signed their application has a reputational stake in behaving honestly that goes beyond fear of account suspension.
When something does go wrong — a disputed delivery, a damaged item, a case of potential theft — the resolution process draws on three layers of evidence. First, the GPS trail shows exactly where the rider was, when they arrived, and when they left. Second, the OTP record (for COD) or payment confirmation (for prepaid) shows whether the delivery exchange actually occurred. Third, the KYC record provides the personal information needed if the case escalates beyond the platform to formal authorities. The AI support agent handles the initial dispute intake, asks for photos or descriptions of the damage, and logs the case. If the evidence is ambiguous or the claim is high-value, it escalates to the human admin via WhatsApp with the full case context attached.

Part Nine: The Admin Dashboard in Plain English
The admin dashboard is the nerve centre for the human oversight layer. Rather than just listing API calls, here is what each capability means operationally.
Admin.getStats() gives the admin a real-time picture of platform health — how many orders are active right now, how much has flowed through the wallet today, how many riders are online, and whether there are any anomalies worth investigating.
Admin.getOrders({ city, status, page }) lets the admin filter the full order history by geography, order state (pending, active, delivered, disputed), and page through the results. This is the tool for investigating a specific complaint — "Customer ID 2247 says their order was never delivered" — by pulling up the exact order and reviewing its GPS trail and status history.
Admin.getUsers({ role, status, search }) covers the full user base across customers, riders, and merchants. The admin can search by name or phone number, filter by role, and filter by status (active, suspended, pending KYC). This is how the admin finds a specific rider to review their KYC documents or a specific customer to investigate unusual behaviour.
Admin.approveKYC(riderId) is the gate that controls who can work on the platform. The admin reviews the submitted documents in the KYC queue and either approves (activating the rider) or rejects with a note explaining what's missing.
Admin.suspendUser(userId) is the emergency lever — it immediately deactivates any account on the platform, stopping them from placing orders, accepting jobs, or accessing their wallet pending investigation.

A Final Note on Version Scoping
Version 1 is a deliberate act of restraint. By keeping customers as pure shippers (not buyers), and merchants as pure logistics clients (not storefronts), the platform can focus entirely on making the delivery experience trustworthy and reliable. The bidding system, zone algorithm, real-time tracking, compensation mechanics, and dispute resolution layer are all substantial engineering and operational challenges on their own. Adding e-commerce in Version 3 becomes dramatically easier once the logistics core is proven, the rider network is established, and the trust reputation of the platform is built. The foundation you're laying in Version 1 isn't a stepping stone — it's the moat.# OffScape Logistics — Complete Frontend Documentation

**Version:** 1.0  
**Architecture:** Vanilla JS Single-Page Application (SPA)  
**Total files:** 17  
**Total lines of code:** ~5,900  
**Cities served:** Ibadan & Lagos, Nigeria  

---

## Table of Contents


From Frontend to Production-Ready Application

Preliminary Alignment Check: Frontend vs Business Logic
Before diving into execution, let me flag what aligns and what needs attention.
What aligns well:
The five-role architecture, the fee breakdown structure (baseFee, distanceFee, platformFee, insurance, total), the GPS simulation ready for Socket.IO replacement, the Paystack integration hooks, the Support AI with Claude already wired, the KYC document table in the Rider profile panel, the wallet and payout system, and the bidding mode selector on the Merchant Post Shipment panel all map cleanly to the business logic.
What needs adjustment or addition:
The zone-detection system has no frontend representation yet — rider profile needs an explicit zone selector, and customer address entry needs a zone resolver. The guarantor verification flow exists as a form field but has no backend confirmation loop designed. The OTP confirmation on pay-on-delivery delivery is missing from the Confirm Delivery button flow. The compensation pool has no admin UI panel. Early vs late cancellation logic needs a timer-aware cancel button rather than a simple cancel. The COD pending debit display on the rider earnings panel is absent. These are backend-and-frontend additions to plan for, not bugs — the frontend is a strong foundation.

Phase 0 — Project Architecture Decision
Before writing a single line of backend code, decide the stack. Based on the frontend being vanilla JS with Socket.IO and Paystack, this stack is the natural fit:
Frontend:     Vanilla JS SPA (already built)
Backend:      Node.js + Express
Database:     MongoDB + Mongoose
Realtime:     Socket.IO
Payments:     Paystack
SMS/OTP:      Termii (Nigerian) or Twilio
File Storage: Cloudinary (KYC documents)
Email:        Nodemailer + Gmail SMTP or Resend
Maps:         Leaflet (already in frontend) + OpenRouteService API (free routing)
Hosting:      Railway or Render (backend) + Cloudflare Pages (frontend)

Phase 1 — Backend Project Setup
Step 1.1 — Initialize the Repository
offscape-backend/
├── src/
│   ├── config/          ← Environment, DB connection, Paystack, Cloudinary
│   ├── models/          ← Mongoose schemas
│   ├── routes/          ← Express route files per role
│   ├── controllers/     ← Business logic per route
│   ├── middleware/       ← Auth, role guard, rate limiter, validator
│   ├── services/        ← Zone engine, fee calculator, OTP, SMS, socket events
│   ├── jobs/            ← Cron jobs (weekly payouts, COD debit reminders)
│   └── utils/           ← Helpers, error classes, response formatter
├── .env
├── server.js
└── package.json
Install core dependencies:
bashnpm init -y
npm install express mongoose socket.io jsonwebtoken bcryptjs 
npm install axios cloudinary multer nodemailer
npm install express-rate-limit helmet cors express-validator
npm install node-cron dotenv
npm install --save-dev nodemon
```

### Step 1.2 — Environment Variables

Your `.env` must contain the following before anything else runs:
```
PORT=4000
MONGO_URI=mongodb+srv://...
JWT_SECRET=a-long-random-secret-minimum-64-characters
JWT_EXPIRES_IN=7d

PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

TERMII_API_KEY=...
TERMII_SENDER_ID=OffScape

ANTHROPIC_API_KEY=sk-ant-...

ADMIN_WHATSAPP=+2348000000000
FRONTEND_URL=https://offscape.co
Never commit this file. Add it to .gitignore immediately.

Phase 2 — Database Models
Step 2.1 — User Model
This is the single most important schema because every role shares it with conditional fields.
javascript// src/models/User.js

const userSchema = new mongoose.Schema({
  // Core identity — every role
  firstName:    { type: String, required: true, trim: true },
  lastName:     { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  phone:        { type: String, required: true, unique: true },
  password:     { type: String, required: true, minlength: 8 },
  role:         { type: String, enum: ['customer','merchant','rider','admin','support'], required: true },
  city:         { type: String, enum: ['lagos','ibadan'], required: true },
  status:       { type: String, enum: ['active','suspended','pending_kyc'], default: 'active' },
  
  // Address — customer and merchant
  primaryAddress: {
    street:     String,
    landmark:   String,
    zone:       { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },

  // Merchant-specific
  businessName: String,
  businessType: String,
  cacNumber:    String,

  // Rider-specific
  vehicleType:  { type: String, enum: ['motorcycle','bicycle','car','van'] },
  vehicleModel: String,
  plateNumber:  String,
  nin:          String,
  operatingZones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],
  
  // KYC — rider only
  kyc: {
    ninDocument:        { url: String, publicId: String, verified: Boolean },
    driversLicence:     { url: String, publicId: String, verified: Boolean },
    vehicleInsurance:   { url: String, publicId: String, verified: Boolean },
    platePhoto:         { url: String, publicId: String, verified: Boolean },
    guarantorForm:      { url: String, publicId: String, verified: Boolean },
    status:             { type: String, enum: ['not_submitted','pending','approved','rejected'], default: 'not_submitted' },
    rejectionReason:    String,
    verifiedAt:         Date,
    verifiedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // Guarantor — rider only
  guarantor: {
    fullName:   String,
    phone:      String,
    address:    String,
    relationship: String,
    // Verification record of the admin's call
    callVerified:    { type: Boolean, default: false },
    callVerifiedAt:  Date,
    callVerifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    callNotes:       String
  },

  // Online state — rider only
  isOnline:   { type: Boolean, default: false },
  lastSeen:   Date,
  currentLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },

  // Rating — rider only
  rating:         { type: Number, default: 5.0, min: 1, max: 5 },
  totalRatings:   { type: Number, default: 0 },

  // Wallet reference
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },

  createdAt: { type: Date, default: Date.now }
});
Step 2.2 — Zone Model
javascript// src/models/Zone.js

const zoneSchema = new mongoose.Schema({
  name:     { type: String, required: true },  // e.g. "Bodija", "Mokola", "Dugbe"
  city:     { type: String, enum: ['lagos','ibadan'], required: true },
  // GeoJSON polygon defining the zone boundary
  boundary: {
    type: { type: String, default: 'Polygon' },
    coordinates: [[[ Number ]]]  // Array of [lng, lat] pairs
  },
  // Central point for distance calculations
  centroid: {
    lat: Number,
    lng: Number
  },
  isActive: { type: Boolean, default: true }
});

zoneSchema.index({ boundary: '2dsphere' });
Step 2.3 — Order Model
javascript// src/models/Order.js

const orderSchema = new mongoose.Schema({
  orderRef:     { type: String, unique: true },  // e.g. "OS-2025-00842"
  customer:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  merchant:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // null for direct customer orders
  rider:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  pickup: {
    address:    String,
    landmark:   String,
    zone:       { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    coordinates: { lat: Number, lng: Number },
    senderName: String,
    senderPhone: String
  },

  delivery: {
    address:    String,
    landmark:   String,
    zone:       { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    coordinates: { lat: Number, lng: Number },
    recipientName: String,
    recipientPhone: String
  },

  package: {
    category:   String,
    description: String,
    weight:     Number,
    quantity:   Number,
    declaredValue: Number,
    fragile:    Boolean,
    speed:      { type: String, enum: ['standard','express'] }
  },

  fees: {
    baseFee:      Number,
    distanceFee:  Number,
    platformFee:  Number,
    insurance:    Number,
    total:        Number,
    codHandlingFee: Number  // Extra charge for pay-on-delivery orders
  },

  payment: {
    method:        { type: String, enum: ['paystack','wallet','cod'] },
    status:        { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' },
    paystackRef:   String,
    paidAt:        Date
  },

  // COD-specific
  cod: {
    collectedByRider:   Boolean,
    platformFeeDebited: Boolean,
    otpCode:            String,
    otpVerified:        Boolean,
    otpVerifiedAt:      Date
  },

  status: {
    type: String,
    enum: ['pending','assigned','pickup_in_progress','picked_up','in_transit','delivered','cancelled','disputed'],
    default: 'pending'
  },

  // Full GPS trail — every rider location broadcast saved
  gpsTrail: [{
    lat:       Number,
    lng:       Number,
    timestamp: Date
  }],

  // Cancellation
  cancellation: {
    cancelledBy:    { type: String, enum: ['customer','merchant','rider','system'] },
    reason:         String,
    cancelledAt:    Date,
    // Was it early (within 5 min) or late (rider en route)?
    type:           { type: String, enum: ['early','late'] },
    compensationPaid: Boolean,
    compensationAmount: Number
  },

  // Location change log
  locationChanges: [{
    changedAt:        Date,
    originalAddress:  String,
    newAddress:       String,
    additionalFee:    Number,
    feePaid:          Boolean
  }],

  // Dispute
  dispute: {
    openedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason:     String,
    evidence:   [String],  // Cloudinary URLs of photos
    status:     { type: String, enum: ['open','under_review','resolved'] },
    resolution: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date
  },

  // Assignment tracking — records which riders were offered before acceptance
  assignmentLog: [{
    rider:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    offeredAt:  Date,
    response:   { type: String, enum: ['accepted','declined','timeout'] },
    respondedAt: Date
  }],

  // Bidding — for merchant open-bid orders
  bids: [{
    rider:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount:     Number,
    note:       String,
    submittedAt: Date,
    status:     { type: String, enum: ['pending','accepted','rejected'], default: 'pending' }
  }],

  assignmentMode: { type: String, enum: ['auto','budget','open_bid'], default: 'auto' },
  
  deliveredAt:    Date,
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      Date
});
Step 2.4 — Wallet Model
javascript// src/models/Wallet.js

const walletSchema = new mongoose.Schema({
  owner:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  balance: { type: Number, default: 0, min: 0 },
  
  // For riders: COD fees they owe the platform
  codPendingDebit: { type: Number, default: 0 },
  
  // Insurance reserve — platform-level, only one record
  insuranceReserve: { type: Number, default: 0 },
  
  // Compensation pool — platform-level, only one record
  compensationPool: { type: Number, default: 0 },

  transactions: [{
    type:        { type: String, enum: ['credit','debit'] },
    amount:      Number,
    description: String,
    reference:   String,
    orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    createdAt:   { type: Date, default: Date.now }
  }],

  // Bank details for rider withdrawals
  bankDetails: {
    bankCode:      String,
    bankName:      String,
    accountNumber: String,
    accountName:   String
  },

  createdAt: { type: Date, default: Date.now }
});
```

---

## Phase 3 — Authentication System

### Step 3.1 — Registration Endpoint
```
POST /api/auth/signup
```

The registration flow has three stages depending on the role.

For **customers and merchants**: validate all fields, hash the password with bcrypt (salt rounds: 12), create the User document, create a Wallet document simultaneously, link the wallet ObjectId back to the user, generate a JWT, return `{ token, user }`.

For **riders**: do the same but set `status: 'pending_kyc'` and `kyc.status: 'not_submitted'`. The rider receives a JWT and can log in, but the frontend should detect `pending_kyc` status and show a KYC upload screen rather than the normal dashboard. They cannot accept jobs until KYC is approved.

Password hashing middleware goes on the User schema `pre('save')` hook — never hash in the controller directly, because if you ever update a user's non-password fields and call `.save()`, the hook needs to be smart enough to only re-hash when the password field was actually modified. The check is `if (!this.isModified('password')) return next()`.

### Step 3.2 — Login Endpoint
```
POST /api/auth/login
```

Accept `email`, `password`, and `role`. Find the user by email AND role — this is important because the same email could technically register as both a customer and a merchant. Compare the password with `bcrypt.compare`. If it matches, generate a JWT containing `{ id, role, city }` as the payload. Return `{ token, user }` where the user object matches the `OS.currentUser` shape the frontend expects.

### Step 3.3 — JWT Middleware

Every protected route runs this middleware first:
```
src/middleware/auth.js
```

It reads the `Authorization: Bearer <token>` header, verifies the JWT with your secret, attaches `req.user = decoded` to the request, and calls `next()`. If the token is missing, expired, or tampered with, it returns a 401 immediately.

### Step 3.4 — Role Guard Middleware

After the auth middleware, role-sensitive routes run a role guard:
```
src/middleware/roleGuard.js
```

It accepts a list of allowed roles: `roleGuard(['admin'])` or `roleGuard(['customer','merchant'])`. It checks `req.user.role` against the list and either calls `next()` or returns a 403. This is the server-side enforcement that the frontend cannot bypass.

---

## Phase 4 — KYC and Guarantor Verification

This is one of the most operationally important flows in the entire platform. A weak KYC system creates security risk; a bureaucratic one will drive riders away before they start.

### Step 4.1 — Document Upload Flow

The rider's profile panel already shows a KYC table with five document types. The backend endpoint for uploading is:
```
POST /api/rider/kyc/upload
Content-Type: multipart/form-data
Field: documentType (one of: nin_document, drivers_licence, vehicle_insurance, plate_photo, guarantor_form)
Field: file (the actual document image or PDF)
```

The backend uses **Multer** to handle the file in memory, then pipes it directly to **Cloudinary** with a folder structure like `offscape/kyc/{riderId}/{documentType}`. Cloudinary returns a secure URL and a public ID. Both are stored on the user's `kyc` subdocument. The individual document `verified` field stays `false` until admin reviews it.

Once all five documents are uploaded, the system automatically sets `kyc.status: 'pending'` and the rider appears in the admin KYC queue.

### Step 4.2 — Admin KYC Review Flow

The admin's Riders panel shows the KYC queue. When the admin clicks a rider's name, they see:

- Each document rendered as a clickable image link (opens Cloudinary URL in a new tab)
- A thumbs-up / thumbs-down action per document
- The guarantor's name, phone, address, and relationship

The admin KYC approval is not just a checkbox — it is a **two-part process**:

**Part A — Document review**: Admin visually inspects each uploaded document. They can approve each individually or reject the entire application with a reason. The rejection reason is stored in `kyc.rejectionReason` and sent to the rider via SMS: "Your OffScape KYC was not approved. Reason: [reason]. Please resubmit via your profile."

**Part B — Guarantor call verification**: This is the part most platforms skip and it is the platform's strongest fraud deterrent. The admin's KYC panel shows the guarantor's phone number as a **clickable `tel:` link**. The admin physically calls the guarantor to confirm: that they know the rider, that they understand they are a guarantor for a delivery platform, and that they confirm the rider's identity. After the call, the admin marks `guarantor.callVerified: true`, records the date, and adds brief notes in `guarantor.callNotes`. This record is immutable — it becomes legal evidence if a fraud case ever escalates.

The endpoint for admin approval is:
```
PATCH /api/admin/kyc/:riderId/approve
Body: { guarantorCallVerified: true, callNotes: "Spoke with Mrs. Adewale, confirmed identity" }
This sets kyc.status: 'approved', kyc.verifiedAt, kyc.verifiedBy, changes the rider's status from pending_kyc to active, and sends an SMS: "Congratulations! Your OffScape account is verified. You can now go online and start accepting jobs."
Step 4.3 — The tel: Protocol for Direct Calling
This is the answer to your question about an alternative when GPS network fails. The tel: protocol makes any phone number on the page become a native phone dialler trigger on mobile devices — no app, no internet required, just the device's call function.
In the order tracking screen for the customer, next to the rider's profile card, the "Call" button should be:
html<a href="tel:+2348031234567" class="btn-outline">
  📞 Call Rider
</a>
In the rider's active delivery screen, the "Call" button for the customer should be:
html<a href="tel:+2348097654321" class="btn-outline">
  📞 Call Customer
</a>
```

These `tel:` links work completely offline — the phone number is stored on the device the moment the order card loads. Even if GPS drops, even if the socket disconnects, even if mobile data is gone, the rider and customer can still reach each other with one tap. This is your GPS network failure fallback, and it requires zero infrastructure.

For the merchant, add the rider's phone number to the active delivery card the same way. The admin panel should show both the customer and rider phone numbers on every order detail view, also as `tel:` links, so admin can intervene in a dispute by calling either party directly.

The phone numbers must be stored in E.164 format in the database (`+234XXXXXXXXXX`) so the `tel:` link works consistently across all devices.

---

## Phase 5 — The Zone Detection Engine

### Step 5.1 — Seeding Zones

Before any order can be matched, the zones must exist in the database. Create a seed script at `src/seeds/zones.js` that inserts the Ibadan and Lagos zone polygons. For Ibadan's initial launch, start with eight to ten zones: Bodija, Dugbe, Mokola, Agodi, UI (University of Ibadan area), Ojoo, Iwo Road, Challenge, Ring Road, and Agbowo. Each zone is a GeoJSON Polygon with coordinates you can draw using geojson.io and export directly.

### Step 5.2 — Resolving an Address to a Zone

When a customer or rider submits an address, the backend needs to determine which zone it falls within. The flow is:
```
Customer enters address text
  ↓
Backend calls OpenRouteService Geocoding API with the address text
  ↓
Returns { lat, lng } coordinates
  ↓
Backend runs a MongoDB $geoIntersects query:
  Zone.findOne({ boundary: { $geoIntersects: { $geometry: { type: 'Point', coordinates: [lng, lat] } } } })
  ↓
Returns the matching Zone document
  ↓
Store zone ObjectId on the order's pickup or delivery subdocument
```

This zone resolution runs automatically on every order creation. The customer never sees it — they just type an address normally.

### Step 5.3 — The Matching Algorithm

When an order's zones are resolved, the matching service runs:
```
1. Get pickup zone ID from order
2. Find riders where:
   - isOnline: true
   - status: 'active'
   - operatingZones contains pickup zone ID
   - not currently assigned to another active order
3. Sort by distance from rider's currentLocation to pickup coordinates
4. Take the top three results
5. For each of the three riders:
   - Create an assignmentLog entry { rider, offeredAt: now, response: 'pending' }
   - Emit socket event 'new:job:offer' to that rider's socket room
   - Start a 90-second server-side timeout
6. The first rider to call POST /api/orders/:id/accept:
   - Sets order.rider = riderId
   - Sets order.status = 'assigned'
   - Cancels the other two timeouts
   - Emits 'job:assigned' to customer socket room
   - Updates the other two assignmentLog entries to 'timeout'
7. If no rider accepts within 90 seconds:
   - Retry with the next three nearest riders
   - If no riders available after two retry cycles, notify customer

Phase 6 — Real-Time System with Socket.IO
Step 6.1 — Socket Room Architecture
Every connected user joins a personal room identified by their user ID. This allows targeted events without broadcasting to everyone.
javascript// On connection
socket.on('connect', () => {
  socket.join(`user:${userId}`)
  // Riders also join their city room for broadcast availability updates
  if (role === 'rider') socket.join(`riders:${city}`)
})
```

### Step 6.2 — GPS Trail Persistence

Every location broadcast from the rider is saved to the order's `gpsTrail` array. This is the evidence record. The socket event from the rider app:
```
Event: 'rider:location'
Payload: { orderId, lat, lng }
The server handler finds the order, pushes { lat, lng, timestamp: new Date() } to gpsTrail, and re-emits 'rider:moved' to the customer's room. The customer's Leaflet map listener receives this and moves the marker. This creates the live tracking experience while simultaneously building the evidence trail.
Step 6.3 — Fallback When GPS Network Fails
GPS and socket tracking requires internet. When it fails, the tel: links described in Phase 4.3 are the fallback. Additionally, the last known GPS position is always saved — when the socket reconnects, the marker jumps to the last known position before resuming live updates. The frontend already has the Leaflet map structure for this; the backend just needs to return the last gpsTrail entry when the customer first loads the tracking panel so the marker doesn't start at zero.

Phase 7 — Fee Calculation Service
The fee calculation must live on the backend, not the frontend. The frontend calculator is for display only — the backend recalculates independently before creating any order. A user could manipulate the frontend values; they cannot manipulate a server-side calculation.
javascript// src/services/feeCalculator.js

function calculateFees({ pickupCoords, deliveryCoords, packageCategory, speed, weight, declaredValue, paymentMethod, insurePackage }) {
  
  // 1. Calculate road distance using OpenRouteService
  const distanceKm = await getRouteDistance(pickupCoords, deliveryCoords)

  // 2. Base fee by category
  const BASE_FEES = { document: 300, small_parcel: 500, large_parcel: 800, fragile: 1000 }
  const baseFee = BASE_FEES[packageCategory]

  // 3. Distance fee: ₦80 per km for motorcycle, ₦120 for car
  const ratePerKm = vehicleType === 'motorcycle' ? 80 : 120
  const distanceFee = Math.round(distanceKm * ratePerKm)

  // 4. Speed multiplier for express
  const speedMultiplier = speed === 'express' ? 1.5 : 1.0
  const subtotal = (baseFee + distanceFee) * speedMultiplier

  // 5. Weight surcharge above 2kg
  const weightSurcharge = weight > 2 ? (weight - 2) * 150 : 0

  // 6. Platform fee: 5% of subtotal + weight surcharge
  const platformFee = Math.round((subtotal + weightSurcharge) * 0.05)

  // 7. Insurance: 0.5% of declared item value, minimum ₦50
  const insurance = insurePackage ? Math.max(50, Math.round(declaredValue * 0.005)) : 0

  // 8. COD handling fee
  const codHandlingFee = paymentMethod === 'cod' ? 100 : 0

  // 9. Total
  const total = Math.round(subtotal + weightSurcharge + platformFee + insurance + codHandlingFee)

  return { baseFee, distanceFee, platformFee, insurance, codHandlingFee, total, distanceKm }
}
```

---

## Phase 8 — Payment System

### Step 8.1 — Paystack Integration

For wallet top-ups and direct order payments:
```
POST /api/payments/initiate
Body: { amount, orderId (optional), type: 'topup' | 'order' }

Response: { authorization_url, reference }
```

The backend calls Paystack's Initialize Transaction endpoint, stores the reference in the order or a pending transaction record, and returns the `authorization_url`. The frontend redirects the user to this URL. After payment, Paystack redirects back to your `callback_url` (e.g., `https://offscape.co/payment/verify?ref=xxx`).
```
GET /api/payments/verify?ref=xxx
```

This endpoint calls Paystack's Verify Transaction endpoint. If status is `success`, it credits the wallet or marks the order as paid. Always verify on the backend — never trust a frontend success callback alone.

**Paystack Webhook** is the safety net:
```
POST /api/payments/webhook
```

Paystack sends a webhook even if the user closes the browser. Verify the webhook signature using `x-paystack-signature` header hashed against your secret key. If the event is `charge.success`, run the same credit logic as the verify endpoint. This prevents any payment from being lost.

### Step 8.2 — Wallet Payments

When a customer pays with their OffScape wallet:
```
1. Check wallet.balance >= order.fees.total
2. If yes: debit wallet, mark order as paid, proceed to assignment
3. If no: return 400 with { error: 'Insufficient wallet balance', shortfall: amount }
Step 8.3 — COD Flow
On order creation with COD:

Generate a 6-digit OTP
Store it hashed in order.cod.otpCode
Do NOT send the OTP yet — send it only when the rider taps "I've arrived at delivery location"

When rider taps "Arrived at Delivery":

System sends OTP to customer's phone via Termii SMS: "Your OffScape delivery OTP is 847291. Give this to your rider to confirm delivery."

When rider enters OTP on their Confirm Delivery screen:

Backend compares the input against the stored hash
If match: set cod.otpVerified: true, mark order delivered, record platform fee as codPendingDebit on rider's wallet
If no match: return error, rider tries again


Phase 9 — Cancellation and Compensation Logic
Step 9.1 — The 5-Minute Window
When an order is created, store createdAt. The cancel endpoint checks:
javascriptconst minutesSinceCreation = (Date.now() - order.createdAt) / 60000
const riderEnRoute = order.status === 'pickup_in_progress'

if (minutesSinceCreation <= 5 && !riderEnRoute) {
  // Early cancellation
  cancellationType = 'early'
  // Pay rider from compensation pool
  compensationAmount = 300  // fixed amount, configurable by admin
  await creditFromCompensationPool(order.rider, compensationAmount)
  // Full refund to customer
  await refundCustomer(order)
} else if (riderEnRoute) {
  // Late cancellation
  cancellationType = 'late'
  lateFee = order.fees.total * 0.5
  // Charge customer 50%, pay rider
  await chargeLateCancellationFee(order.customer, lateFee, order.rider)
}
The compensation pool is a special wallet record owned by a platform admin user. The admin's Finance panel needs a field showing the current pool balance and a top-up mechanism.

Phase 10 — Security Architecture
Step 10.1 — API Security Layers
Apply these middleware in order in server.js:
Helmet sets security headers automatically — it prevents clickjacking, disables MIME sniffing, sets a strict Content Security Policy, and removes the X-Powered-By: Express header that tells attackers your stack.
CORS must be configured to only allow your frontend domain, not *. In development, allow localhost:3000. In production, allow only https://offscape.co.
Rate limiting using express-rate-limit must be aggressive on auth endpoints. Login and signup should be limited to 10 requests per 15-minute window per IP. General API endpoints can be more permissive at 100 requests per minute.
Input validation using express-validator runs on every endpoint that accepts body data. Validate types, lengths, formats. Reject anything unexpected. Never pass raw req.body directly to a database query.
MongoDB injection prevention: Use Mongoose's typed schemas — they reject anything that isn't the declared type. Never use string interpolation in queries. Always use parameterized Mongoose methods.
Step 10.2 — Authentication Security
JWT secrets must be a minimum of 64 random characters. Generate one with:
bashnode -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Set token expiry to 7 days. Implement token refresh for users who stay active. On the logout endpoint, since JWTs are stateless, add the token's JTI (JWT ID) to a Redis or MongoDB blocklist until it expires — this makes logout truly effective rather than just clearing localStorage.

Never return the password field in any response. Add `.select('-password')` to every user query.

### Step 10.3 — File Upload Security

KYC document uploads must validate:
- File type: only `image/jpeg`, `image/png`, `application/pdf`
- File size: maximum 5MB per file
- Use Multer's `fileFilter` to reject anything else before it reaches your controller

Never store uploaded files on your server's filesystem. Always pipe directly to Cloudinary. This prevents a server compromise from also compromising user documents.

### Step 10.4 — Penetration Testing Checklist

These are the attack vectors you must test before going live:

**SQL/NoSQL Injection** — Send payloads like `{ "email": { "$gt": "" } }` to your login endpoint. Mongoose typed schemas and input validation should reject these. Test every endpoint that accepts user input.

**JWT Tampering** — Try changing the `role` field in a decoded token and re-signing it with `none` algorithm. Your middleware must explicitly reject `none` as an algorithm. Also test using an expired token and a token signed with the wrong secret.

**Broken Object Level Authorization (BOLA)** — Log in as Customer A, then try to call `GET /api/orders/:id` with Customer B's order ID. The backend must verify `order.customer === req.user.id` before returning data. Test this on every endpoint that returns a specific record.

**Broken Function Level Authorization** — Log in as a customer and try calling `POST /api/admin/kyc/approve`. The role guard should return 403. Test every admin and rider-only endpoint with a customer JWT.

**Rate Limit Bypass** — Try the login endpoint 20 times rapidly with the same IP. Confirm you get blocked after 10 attempts. Then try with an `X-Forwarded-For` header spoofed to a different IP. Configure your rate limiter to use `req.ip` via Express's `trust proxy` setting rather than blindly trusting the forwarded header.

**File Upload Attack** — Try uploading a `.php` file renamed as `.jpg`, an SVG file containing XSS JavaScript, and a file that is exactly 5MB + 1 byte. All three should be rejected.

**Paystack Webhook Replay** — Try sending the same webhook payload twice. Your webhook handler should check if that `reference` has already been processed before applying a second credit.

**Mass Assignment** — Try registering as a customer but including `{ role: 'admin' }` in the signup body. The controller must explicitly pick only the allowed fields from `req.body` and never spread the entire object into the Mongoose constructor.

**Socket.IO Authorization** — Try connecting to the Socket.IO server without a valid JWT. The `io.use()` middleware handshake should reject unauthenticated socket connections before they can join any room or emit any event.

**Clickjacking** — Try embedding your site in an `<iframe>` on an external domain. Helmet's `X-Frame-Options: DENY` should prevent this.

---

## Phase 11 — Support System: AI Agent to Human Escalation

The frontend already has the Claude API wired in the Support dashboard. The escalation to human admin via WhatsApp needs one additional piece.

When the AI agent determines that a query requires human intervention — either by keyword detection (words like "fraud", "missing", "abscond", "police", "legal") or by explicit user request ("I want to speak to a human") — the system:
```
1. AI response: "I'm escalating this to our human support team. 
   They will contact you on WhatsApp within 15 minutes."

2. Backend call: POST /api/support/escalate
   Body: { ticketId, userId, conversationHistory, reason }

3. Backend formats a WhatsApp message via the Twilio WhatsApp API 
   or a direct wa.me link opened server-side:
   
   "🚨 OffScape Support Escalation
   User: Amaka Osei (Customer)
   Order: OS-2025-00842
   Reason: User reports rider did not deliver
   Conversation: [summary]
   User's WhatsApp: +234XXXXXXXXX"

4. This message is sent to the admin's WhatsApp number stored in .env
```

The admin sees the message on WhatsApp, clicks the user's number to open a chat, and resolves the issue directly. The ticket in the Support dashboard gets updated to `escalated` status with a timestamp.

---

## Phase 12 — Deployment Sequence

Deploy in this exact order to avoid environment dependency issues:
```
1. MongoDB Atlas — create cluster, get connection string, whitelist all IPs (0.0.0.0/0)
2. Cloudinary — create account, get credentials, create 'offscape' folder
3. Termii — create account, get API key, register 'OffScape' sender ID (takes 24-48hrs in Nigeria)
4. Paystack — create account, get live keys, add callback URL and webhook URL
5. Railway or Render — deploy backend, set all .env variables in dashboard
6. Run zone seed script against production DB
7. Create one admin user directly in MongoDB Atlas (set role: 'admin', status: 'active' manually)
8. Cloudflare Pages — deploy frontend folder, set 404 redirect to /index.html
9. Update BASE_URL in api.js to production backend URL
10. Test the full end-to-end flow: signup → KYC upload → admin approve → go online → customer order → match → track → deliver → wallet credit

Final Alignment Summary
The frontend is architecturally sound and aligns with the business logic at the data flow level. The additions you need to make to the frontend before backend connection are: a zone selector in the rider profile form, an OTP input field on the Confirm Delivery screen for COD orders, a cancellation timer display on active orders (showing "Cancel free for X more minutes"), a compensation pool balance card in the admin Finance panel, and tel: links on every phone number shown in order cards across all dashboards.
The backend work is substantial but well-defined. Every plug point in the frontend documentation maps to a clear, buildable endpoint. The business logic has no fundamental contradictions — it is a coherent system. Build it in the phase order above: auth first, then orders, then real-time, then payments, then the edge cases of cancellation and COD.2 