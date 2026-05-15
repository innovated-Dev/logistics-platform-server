// src/seeds/admin.js — Create the initial admin user.
// Run once: node src/seeds/admin.js
// Set ADMIN_EMAIL and ADMIN_PASSWORD env vars or use the defaults below.
import 'dotenv/config';
import mongoose from 'mongoose';
import User     from '../models/User.js';
import Wallet   from '../models/Wallet.js';
import Config   from '../models/Config.js';
import { env }  from '../config/env.js';

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cabinetoffscape.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'ChangeMe@2025!';

  const existing = await User.findOne({ email: adminEmail, role: 'admin' });
  if (existing) {
    console.log('Admin user already exists.');
  } else {
    const admin = await User.create({
      firstName: 'OffScape',
      lastName:  'Admin',
      email:     adminEmail,
      phone:     '+2348000000000',
      password:  adminPass,
      role:      'admin',
      city:      'lagos',
      status:    'active',
      emailVerified: true,
    });
    const wallet = await Wallet.create({
      owner:            admin._id,
      compensationPool: 50000,  // Seed ₦50,000 into compensation pool
      insuranceReserve: 0,
    });
    admin.wallet = wallet._id;
    await admin.save();
    console.log(`✅  Admin created: ${adminEmail}`);
    console.log(`    Wallet: ${wallet._id} | Pool: ₦50,000`);
  }

  // Ensure platform config exists
  const cfg = await Config.findOneAndUpdate(
    { singleton: 'main' },
    {
      $set: {
        'baseFees.fragile':    1000,
        'baseFees.groceries':  600,
        'baseFees.large_items':1500,
        'fees.economyMultiplier': 0.7,
      },
  }
  );

  if (!cfg) {
    await Config.create({ singleton: 'main' });
    console.log('✅  Default platform config created');
  } else {
    console.log('Platform config already exists');
  }

  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });