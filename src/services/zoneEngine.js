// src/services/zoneEngine.js
// The zone system is the most Nigeria-specific feature on the platform.
// It translates between text addresses and geographic zone polygons,
// and powers the rider-order matching algorithm.
import axios   from 'axios';
import Zone    from '../models/Zone.js';
import User    from '../models/base/user.base.js';
import { env } from '../config/env.js';
import { cacheGet, cacheSet } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// ── Geocode a Nigerian address to {lat, lng _resolvedBy} ──
//Resolution Order:
// 1. Redis cache hit
// 2. OpenRouteServicegeocoding API
// 3. Fuzzy zone name match (e.g. "Bodija" matches zone.name "Bodija")
// 4. City centre fallback

// Returns: {lat, lng, _resolvedBy }
//Throws: Never - always return a coord pair at minimum


export async function geocodeAddress(address, city = 'ibadan') {
  const normalizedCity = city.toLowerCase().trim();
  const normalizedAddr = address.toLowerCase().trim();

  // ── 1. Cache ─────────────────────────────────────────────────────────────
  const cacheKey = `geocode:${normalizedAddr}:${normalizedCity}`;
  const cached   = await cacheGet(cacheKey);
  if (cached) return cached;

   // ── 2. OpenRouteService ───────────────────────────────────────────────────
  if (env.ORS_KEY) {
    try {
      const { data } = await axios.get('https://api.openrouteservice.org/geocode/search', {
        params: {
          api_key:            env.ORS_KEY,
          text:               `${address}, ${city}, Nigeria`,
          size:               1,
          'boundary.country': 'NG',
        },
        timeout: 6000,
      });
 
      const [lng, lat] = data.features[0].geometry.coordinates;
      const coords = {
        lat: +lat.toFixed(6),
        lng: +lng.toFixed(6),
        _resolvedBy: 'ors',
      };
 
      await cacheSet(cacheKey, coords, 86400); // addresses don't move — 24h TTL
      return coords;
 
    } catch (err) {
      // ORS failed — fall through to fuzzy match
      logger.warn(`ORS geocoding failed for "${address}" in ${city}: ${err.message}`);
    }
  } else {
    logger.warn('ORS key not set — skipping geocoding, trying fuzzy match');
  }


  // ── 3. Fuzzy zone name match ──────────────────────────────────────────────
    // If the customer typed something like "Bodija" or "Dugbe Market",
    // match case-insensitively against zone names and slugs in the city.
    try {
      const zones = await Zone.find({ city: normalizedCity, isActive: true }).lean();
  
      const matched = zones.find(z =>
        normalizedAddr.includes(z.name?.toLowerCase() || '') ||
        normalizedAddr.includes(z.slug?.toLowerCase() || '')
      );
  
      if (matched) {
        // Prefer .lat/.lng, fall back to GeoJSON .coordinates array
        const lat = matched.centroid?.lat  ?? matched.centroid?.coordinates?.[1];
        const lng = matched.centroid?.lng  ?? matched.centroid?.coordinates?.[0];
  
        if (lat != null && lng != null) {
          const coords = {
            lat: +lat.toFixed(6),
            lng: +lng.toFixed(6),
            _resolvedBy: 'fuzzy_name_match',
          };
          await cacheSet(cacheKey, coords, 3600); // shorter TTL — less precise
          return coords;
        }
      }
    } catch (err) {
      logger.warn(`Fuzzy zone match failed for "${address}": ${err.message}`);
    }
  
    // ── 4. City-centre hardcoded fallback ─────────────────────────────────────
    // Last resort so callers always get usable coordinates.
    // Callers that care about precision should check _resolvedBy === 'city_centre'.
    logger.warn(`All geocoding strategies failed for "${address}" — using city centre`);
    const centres = {
      ibadan: { lat: 7.3775, lng: 3.9470 },
      lagos:  { lat: 6.5244, lng: 3.3792 },
    };
    return {
      ...(centres[normalizedCity] || centres.ibadan),
      _resolvedBy: 'city_centre',
    };
}

// ── Resolve {lat, lng} to the Zone document it falls within ──
// Uses MongoDB's $geoIntersects against 2dsphere-indexed Zone.boundary.
export async function resolveZone(lat, lng) {
  const cacheKey = `zone:${lat.toFixed(3)}:${lng.toFixed(3)}`; // 3dp = ~111m precision
  const cached   = await cacheGet(cacheKey);
  if (cached) return cached;

  const zone = await Zone.findOne({
    isActive: true,
    boundary: {
      $geoIntersects: {
        $geometry: { type: 'Point', coordinates: [lng, lat] }, // GeoJSON is [lng, lat]
      },
    },
  }).lean();

  // FIXED
  if (zone) {
    await cacheSet(cacheKey, zone, 3600);
    return zone;
  }
  return null;
}

// ── Find available riders for a pickup zone ──
// Returns the N nearest online, verified riders in the zone.
// This is the inner loop of the dispatch algorithm — it runs fast
// because of compound indexes on (isOnline, role, city).
export async function findNearestRiders(pickupZoneId, pickupCoords, limit = 3) {
  // 1. Get all online, active riders whose zones include the pickup zone
  const candidates = await User.find({
    role:           'rider',
    status:         'active',
    isOnline:       true,
    operatingZones: pickupZoneId,
    'currentLocation.lat': { $exists: true },
    'currentLocation.lng': { $exists: true },
  })
  .select('_id firstName lastName phone currentLocation vehicleType rating')
  .lean();

  if (!candidates.length) return [];

  // 2. Filter out riders currently on an active delivery
  const { default: Order } = await import('../models/Order.js');
  const busyRiderIds = await Order.distinct('rider', {
    status: { $in: ['assigned','pickup_in_progress','picked_up','in_transit'] },
  });
  const busySet = new Set(busyRiderIds.map(id => id.toString()));

  const available = candidates.filter(r => !busySet.has(r._id.toString()));

  // 3. Sort by distance from pickup coordinates (server-side Haversine)
  const withDistance = available.map(r => ({
    ...r,
    distanceKm: haversineKm(pickupCoords, r.currentLocation),
  }));
  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistance.slice(0, limit);
}

function haversineKm(a, b) {
  if (!a?.lat || !b?.lat) return 9999;
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
            Math.sin(dLng/2)**2;
  return +(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))).toFixed(2);
}

// ── Get all zones for a city (cached) ──
export async function getZonesByCity(city) {
  const key = `zones:${city}`;
  const cached = await cacheGet(key);
  if (cached) return cached;
  const zones = await Zone.find({ city, isActive: true }).lean();
  await cacheSet(key, zones, 3600);
  return zones;
}