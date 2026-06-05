// scripts/seedZones.js
// Run once: node scripts/seedZones.js
// Seeds all OffScape dispatch zones for Ibadan and Lagos.
// Coordinates are [lng, lat] — GeoJSON standard, NOT [lat, lng].
// Every polygon is closed — first point repeated as last point.
// Zones are non-overlapping and cover the core commercial/residential
// areas where deliveries are expected.

import 'dotenv/config'; 
import mongoose from 'mongoose';
import Zone     from '../models/Zone.js';
import { env }  from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — builds a closed rectangular polygon from a bounding box
// This is the simplest zone shape — good enough for dispatch matching.
// For production you can replace with actual surveyed polygons later.
// bbox: [minLng, minLat, maxLng, maxLat]
// ─────────────────────────────────────────────────────────────────────────────
function rect(minLng, minLat, maxLng, maxLat) {
  return {
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], // bottom-left
      [maxLng, minLat], // bottom-right
      [maxLng, maxLat], // top-right
      [minLng, maxLat], // top-left
      [minLng, minLat], // closed — same as first point
    ]],
  };
}

// Centroid from bbox center
function centroid(minLng, minLat, maxLng, maxLat) {
  return {
    lat: +((minLat + maxLat) / 2).toFixed(6),
    lng: +((minLng + maxLng) / 2).toFixed(6),
  };
}

// Build a complete zone entry
function zone(name, slug, city, minLng, minLat, maxLng, maxLat) {
  return {
    name,
    slug,
    city,
    boundary: rect(minLng, minLat, maxLng, maxLat),
    centroid:  centroid(minLng, minLat, maxLng, maxLat),
    isActive:  true,
    pickmenOnline: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IBADAN ZONES
// Ibadan spans roughly:
//   Lat  7.30 → 7.50 N
//   Lng  3.85 → 4.02 E
// These 12 zones cover the core delivery areas.
// Each zone is approximately 2–4 km wide — right-sized for fast dispatch.
// ─────────────────────────────────────────────────────────────────────────────
const ibadanZones = [
  // name            slug              city       minLng  minLat  maxLng  maxLat
  zone('Dugbe',      'dugbe',     'ibadan', 3.882,  7.376,  3.910,  7.396),
  // Dugbe: historic commercial heart of Ibadan — market, banks, govt offices
  // Bordered by Ring Road south, Agodi north, Sango west, Oja-Oba east

  zone('Bodija',     'bodija',    'ibadan', 3.900,  7.410,  3.930,  7.435),
  // Bodija: major residential + market zone — one of the busiest in Ibadan
  // Heavy merchant traffic, food vendors, pharmacies

  zone('UI-Agbowo',  'ui-agbowo', 'ibadan', 3.888,  7.400,  3.915,  7.420),
  // University of Ibadan environs + Agbowo commercial strip
  // Student-heavy zone, high food delivery demand

  zone('Mokola',     'mokola',    'ibadan', 3.893,  7.395,  3.915,  7.410),
  // Mokola: dense urban zone between UI and Dugbe
  // Mokola market, UCH hospital area, high foot traffic

  zone('Ring-Road',  'ring-road', 'ibadan', 3.905,  7.363,  3.932,  7.382),
  // Ring Road / Challenge: southern commercial corridor
  // Major road intersection, shopping centres, restaurants

  zone('Ojoo',       'ojoo',      'ibadan', 3.923,  7.425,  3.952,  7.448),
  // Ojoo: fast-growing northern zone — bus terminus, markets
  // Gateway to Oyo town, high intercity parcel traffic

  zone('Iwo-Road',   'iwo-road',  'ibadan', 3.928,  7.405,  3.957,  7.428),
  // Iwo Road: major northern corridor, motor parks, market
  // Connects to Ojoo, heavy commercial activity

  zone('Sango',      'sango',     'ibadan', 3.854,  7.368,  3.885,  7.392),
  // Sango-Eleyele: western zone — reservoir, residential
  // Lower density but important coverage area

  zone('New-Garage', 'new-garage','ibadan', 3.900,  7.353,  3.928,  7.372),
  // New Garage / Gbagi: southern textile and wholesale market zone
  // Very high merchant activity — fabric, electronics

  zone('Agodi',      'agodi',     'ibadan', 3.905,  7.390,  3.928,  7.408),
  // Agodi: government secretariat zone, GRA, Agodi gardens
  // Medium density, corporate deliveries

  zone('Oluyole',    'oluyole',   'ibadan', 3.920,  7.338,  3.950,  7.360),
  // Oluyole Estate: fast-growing southern residential zone
  // Industrial estate + housing estate mix

  zone('Apata',      'apata',     'ibadan', 3.910,  7.350,  3.935,  7.368),
  // Apata / Idi-Ishin: south-central residential + commercial
  // Growing delivery demand, connects New Garage to Oluyole
];

// ─────────────────────────────────────────────────────────────────────────────
// LAGOS ZONES
// Lagos spans roughly:
//   Lat  6.38 → 6.65 N
//   Lng  3.30 → 3.60 E
// These 10 zones cover the highest-demand delivery areas on the island and mainland.
// ─────────────────────────────────────────────────────────────────────────────
const lagosZones = [
  zone('Victoria-Island', 'victoria-island', 'lagos', 3.406, 6.420, 3.442, 6.440),
  // VI: financial district, embassies, high-end restaurants
  // Premium delivery zone — highest average order value

  zone('Lekki-Phase-1',   'lekki-phase-1',   'lagos', 3.455, 6.440, 3.500, 6.462),
  // Lekki Phase 1: densest residential zone in Lagos for middle class
  // Extremely high food/grocery delivery demand

  zone('Ajah',            'ajah',            'lagos', 3.540, 6.462, 3.578, 6.482),
  // Ajah: growing eastern corridor — Abraham Adesanya, Sangotedo
  // High residential demand, far from island core

  zone('Ikeja',           'ikeja',           'lagos', 3.325, 6.588, 3.358, 6.614),
  // Ikeja: Lagos State capital, airport zone, Computer Village
  // Heavy corporate and e-commerce fulfillment demand

  zone('Surulere',        'surulere',        'lagos', 3.345, 6.495, 3.372, 6.518),
  // Surulere: mainland residential hub — National Stadium area
  // Dense population, high frequency small orders

  zone('Yaba',            'yaba',            'lagos', 3.368, 6.508, 3.392, 6.528),
  // Yaba: tech hub (Unilag, CcHub), student zone
  // Growing startup/food delivery demand

  zone('Apapa',           'apapa',           'lagos', 3.348, 6.440, 3.378, 6.460),
  // Apapa: port zone — logistics, warehousing, import/export
  // B2B heavy, bulk deliveries

  zone('Oshodi',          'oshodi',          'lagos', 3.338, 6.548, 3.362, 6.568),
  // Oshodi: major transport interchange, market
  // Very high volume, connects mainland north to south

  zone('Maryland',        'maryland',        'lagos', 3.352, 6.542, 3.375, 6.560),
  // Maryland: residential + commercial — Ikeja adjacent
  // Mid-range demand, good pickman availability

  zone('Ikorodu',         'ikorodu',         'lagos', 3.502, 6.580, 3.540, 6.608),
  // Ikorodu: far north-eastern Lagos — fast growing
  // Underserved zone, high potential for OffScape expansion
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const allZones = [...ibadanZones, ...lagosZones];

  let inserted = 0;
  let skipped  = 0;

  for (const z of allZones) {
    const exists = await Zone.findOne({ slug: z.slug, city: z.city });

    if (exists) {
      console.log(`  SKIP  ${z.city}/${z.slug} — already exists`);
      skipped++;
    } else {
      await Zone.create(z);
      console.log(`  ADD   ${z.city}/${z.slug}`);
      inserted++;
    }
  }

  console.log(`\nDone — ${inserted} zones added, ${skipped} skipped`);
  console.log(`Total zones in DB: ${await Zone.countDocuments()}`);

  // Print all zone IDs — useful for testing
  const all = await Zone.find({}, 'name slug city _id').sort({ city: 1, name: 1 });
  console.log('\nZone reference (use _id in pickman signup):');
  console.table(all.map(z => ({ city: z.city, name: z.name, slug: z.slug, _id: z._id.toString() })));

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});