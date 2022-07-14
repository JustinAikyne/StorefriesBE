var mongoose = require('mongoose');

var plansSchema = new mongoose.Schema({
    planId: String,
    planName: String,
    externalName: String,
    status: { type: String, default: 'active' },
    type: { type: String, default: 'subscription' },
    itemId: String,
    price: Number,
    trial_period: Number,
    trial_period_unit: String,
    period: { type: Number, default: 1 },
    description: String,
    periodUnit: String,
    freeQuantity: { type: Number, default: 0 },
    currency_code: { type: String, default: 'USD' },
    features: { 
        totalSocialChannel: { type: Number, default: 0 },
        totalUploadSize: { type: Number, default: 0 },
        totalSchedulePostCount: { type: Number, default: 0 },
        totalPostCount: { type: Number, default: 0 },
        totalRssFeedCount: { type: Number, default: 0 },
        totalDraftPostCount: { type: Number, default: 0 },
        is_UrlShortnerAllowed: { type: Boolean, default: false },
        is_CalendarViewAllowed: { type: Boolean, default: false },
        is_CanvaAllowed: { type: Boolean, default: false },
        is_EngagementViewAllowed: { type: Boolean, default: false },
        is_DashboardViewAllowed: { type: Boolean, default: false }
    }
});

plansSchema.set({ timestamps: true, versionKey: false })

var plans = module.exports = mongoose.model('plans', plansSchema);