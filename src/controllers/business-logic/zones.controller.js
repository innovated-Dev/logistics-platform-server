// src/controllers/zones.controller.js
import {
  geocodeAddress,
  resolveZone,
  getZonesByCity,
} from '../../services/zoneEngine.js';
import { ok }             from '../../utils/response.js';
import { ValidationError } from '../../utils/errors.js';

// ── GET /api/zones?city=ibadan ──
// Public — called by pickman signup and customer order form
// Returns only _id, name, slug — never sends boundary polygon to frontend
export async function getZones(req, res, next) {
  try {
    const city = (req.query.city || '').toLowerCase().trim();
    if (!city)
      throw new ValidationError('city query param required');
    if (!['ibadan', 'lagos'].includes(city))
      throw new ValidationError('City must be ibadan or lagos');

    const zones = await getZonesByCity(city);

    const payload = zones.map(z => ({
      _id:  z._id,
      name: z.name,
      slug: z.slug,
    }));

    res.json({ success: true, zones: payload });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/zones/resolve?lat=7.38&lng=3.95 ──
// Resolves a coordinate pair to the zone document it falls within
// Used by order creation to auto-detect pickup zone
export async function resolveZoneByCoords(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng))
      throw new ValidationError('lat and lng must be valid numbers');

    const zone = await resolveZone(lat, lng);
    ok(res, { zone });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/zones/geocode ──
// Converts a text address to coordinates + detects its zone
// Used by customer dashboard when entering pickup/dropoff address
export async function geocodeAndResolve(req, res, next) {
  try {
    const { address } = req.body;
    const city = (req.body.city || 'ibadan').toLowerCase().trim();

    if (!address?.trim())
      throw new ValidationError('address is required');

    const coords = await geocodeAddress(address, city);

    // City-centre fallback means ORS + fuzzy match both failed
    // Tell the frontend so they can ask the user for a better address
    if (coords._resolvedBy === 'city_centre') {
      return res.status(422).json({
        success:     false,
        message:     'Could not locate this address. Try adding a nearby landmark.',
        _resolvedBy: coords._resolvedBy,
      });
    }

    const zone = await resolveZone(coords.lat, coords.lng);
    ok(res, {
      coordinates: { lat: coords.lat, lng: coords.lng },
      zone,
      _resolvedBy: coords._resolvedBy,
    });
  } catch (err) {
    next(err);
  }
}