// src/models/Zone.js — Geographic zones for pickman-order matching.
// Each zone is a GeoJSON Polygon. MongoDB's 2dsphere index on the boundary
// field powers the $geoIntersects query that resolves any coordinate pair
// to its containing zone in a single fast indexed lookup.
import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },   // e.g. "Bodija"
  slug:    { type: String, required: true, lowercase: true, trim: true }, // e.g. "bodija"
  city:    { type: String, enum: ['lagos','ibadan'], required: true },
  boundary: {
    type:        { type: String, default: 'Polygon', enum: ['Polygon'] },
    coordinates: { type: [[[Number]]], required: true }, // [[[lng, lat], ...]]
  },
  centroid: {   // precomputed center point for distance calculations
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  isActive: { type: Boolean, default: true },
  pickmansOnline: { type: Number, default: 0 }, // denormalized counter updated by cron
}, { timestamps: true });

// 2dsphere index enables geo queries like $geoIntersects and $near
zoneSchema.index({ boundary: '2dsphere' });
zoneSchema.index({ city: 1, isActive: 1 });
zoneSchema.index({ slug: 1, city: 1 }, { unique: true });

export default mongoose.model('Zone', zoneSchema);