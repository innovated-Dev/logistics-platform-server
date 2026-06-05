// src/services/feeCalculator.js
// ALL fee calculations happen here — never in the frontend.
// The frontend calculator is display-only; the backend recalculates
// independently before creating any order. A user manipulating the
// frontend values cannot change what the backend charges.

import env   from '../config/env.js';
import axios     from 'axios';
import Config    from '../models/Config.js';
import { cacheGet, cacheSet } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// ── Get platform config (cached 5 min) ──
async function getConfig() {
  const cached = await cacheGet('platform:config');
  if (cached) return cached;
  let cfg = await Config.findOne({ singleton: 'main' }).lean();
  if (!cfg) {
    // First run — create default config
    cfg = await Config.create({ singleton: 'main' });
    cfg = cfg.toObject();
  }
  await cacheSet('platform:config', cfg, 300);
  return cfg;
}

// ── Road distance via OpenRouteService ──
// Falls back to Haversine straight-line distance if ORS unavailable.
export async function getRouteDistanceKm(pickupCoords, deliveryCoords) {
  if (!env.ORS_KEY) {
    return haversineKm(pickupCoords, deliveryCoords) * 1.3; // add 30% for roads
  }
  try {
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const { data } = await axios.get(url, {
      params: {
        api_key: env.ORS_KEY,
        start: `${pickupCoords.lng},${pickupCoords.lat}`,
        end:   `${deliveryCoords.lng},${deliveryCoords.lat}`,
      },
      timeout: 5000,
    });
    const metres = data.features[0].properties.segments[0].distance;
    return +(metres / 1000).toFixed(2);
  } catch(err) {
    logger.warn(`ORS routing failed — using Haversine: ${err.message}`);
    return haversineKm(pickupCoords, deliveryCoords) * 1.3;
  }
}

// ── Haversine formula ──
function haversineKm(a, b) {
  const R = 6371;
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 +
            Math.cos(deg2rad(a.lat)) * Math.cos(deg2rad(b.lat)) *
            Math.sin(dLng/2)**2;
  return +(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))).toFixed(2);
}
function deg2rad(d) { return d * (Math.PI / 180); }

// ── Main fee calculator ──
// Returns the full breakdown: every line item and the total.
// All amounts in Nigerian Naira (integers rounded to nearest naira).
export async function calculateFees({
  pickupCoords,
  deliveryCoords,
  packageCategory,
  weight        = 1,
  speed         = 'express',
  declaredValue = 0,
  insurePackage = false,
  paymentMethod = 'paystack',
  vehicleType   = 'motorcycle',
}) {
  const cfg        = await getConfig();
  const distanceKm = await getRouteDistanceKm(pickupCoords, deliveryCoords);

  // 1. Base fee by category
  const baseFee = cfg.baseFees?.[packageCategory] ?? 1000;

  // 2. Distance fee by vehicle type
  const ratePerKm = cfg.distanceRates?.[vehicleType] ?? 300;
  const distanceFee = Math.round(distanceKm * ratePerKm);

  // 3. Speed multiplier
  const speedMult = speed === 'express' ? (cfg.fees?.expressMultiplier ?? 1.5) : speed === 'economy' ? (cfg.fees?.expressMultiplier ?? 0.7) : 1.0;
  const subtotal  = Math.round((baseFee + distanceFee) * speedMult);

  // 4. Weight surcharge above threshold
  const weightThreshold = cfg.weightSurchargeThreshold ?? 2;
  const surchargePerKg  = cfg.weightSurchargePerKg ?? 150;
  const weightSurcharge = weight > weightThreshold
    ? Math.round((weight - weightThreshold) * surchargePerKg)
    : 0;

  // 5. Platform fee (on subtotal + weight surcharge)
  const platformFeeRate = (cfg.fees?.platformFeePercent ?? 5) / 100;
  const platformFee     = Math.round((subtotal + weightSurcharge) * platformFeeRate);

  // 6. Insurance (on declared value, minimum floor)
  const insuranceRate = (cfg.fees?.insuranceRate ?? 0.5) / 100;
  const minInsurance  = cfg.fees?.minInsuranceFee ?? 50;
  const insurance     = insurePackage && declaredValue > 0
    ? Math.max(minInsurance, Math.round(declaredValue * insuranceRate))
    : 0;

  // 7. COD handling fee
  const codHandlingFee = paymentMethod === 'cod' ? (cfg.fees?.codHandlingFee ?? 100) : 0;

  // 8. Grand total
  const total = subtotal + weightSurcharge + platformFee + insurance + codHandlingFee;

  return {
    baseFee,
    distanceFee,
    platformFee,
    insurance,
    codHandlingFee,
    weightSurcharge,
    total,
    distanceKm,
    speedMultiplier: speedMult,
  };
}

// ── Quote endpoint helper (no DB write) ──
// Geocodes two addresses and returns a fee breakdown for display.
export async function getQuote(params) {
  return calculateFees(params);
}