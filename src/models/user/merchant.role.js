import mongoose from 'mongoose';
import User from '../base/user.base.js';

const IsmerchantSchema =  new mongoose.Schema({
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

    businessName: {
        type: String,
        trim: true,
    },

    businessType:    String,
    businessAddress: String,
    cacNumber:       String,

    totalOrders: {
        type: Number,
        default: 0,
    },

    // This for Version 2 
    // store: {
    //     storeName: {
    //         type: String,
    //         default: none
    //     },
    //     zone: {
    //         type: mongoose.Schema.Types.ObjectId, 
    //         ref: 'Zone',
    //         default: none
    //     },
    //     isActive: {
    //         type:Boolean,
    //         default: false
    //     },
    //     subscription: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: 'Subscription'
    //     }
    //     default: none 
    // },

    totalSpent: {
        type: Number,
        default: 0,
    },
    verifiedBusiness: { 
        type: Boolean, 
        default: false 
    },
    verifiedBusinessAt: Date,
});


//=== index query ===
IsmerchantSchema.index({ totalOrders: -1});
const Merchant = User.discriminator('merchant', IsmerchantSchema);

export default Merchant;