import mongoose from 'mongoose';
import User from '../base/user.base.js';

 // ── Primary address (customer and merchant + Rider(optionally)) ──

const IscustomerSchema = new mongoose.Schema({
    primaryAddress: {
        street:      String,
        landmark:    String,
        zone:        { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
        coordinates: {
            lat: {
                type: Number
            },
            lng: {
                type: Number
            }
        },
    },
    permissions: [{ type: String }], // Array of permissions (e.g., ['place_orders', 'view_history']);

    // Track customer stats
    totalOrders: {
        type: Number,
        default: 0,
    },
    totalSpent: {
        type: Number,
        default: 0,
    },
});
//== Index Query===
IscustomerSchema.index({ totalOrders: -1});

const Customer = User.discriminator('customer', IscustomerSchema);

export default Customer;