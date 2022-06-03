var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String,
    lastName: String,
    email: String,
    password: String,
    //phone: String,
    status: String,
    activationString: String,
    location: {
        lng: Number,
        lat: Number
    },
    formatted_address: String,
    tempPlan: String,
    features: {
        totalSocialChannel: { type: Number, default: 0 },
        totalUploadSize: { type: Number, default: 0 },
        totalSchedulePostCount: { type: Number, default: 0 },
        totalPostCount: { type: Number, default: 0 },
        totalRssFeedCount: { type: Number, default: 0 },
        totalDraftPostCount: { type: Number, default: 0 },
        currentDraftPostCount: { type: Number, default: 0 },
        currentSocialChannel: { type: Number, default: 0 },
        currentUploadSize: { type: Number, default: 0 },
        currentSchedulePostCount: { type: Number, default: 0 },
        currentRssFeedCount: { type: Number, default: 0 },
        currentPostCount: { type: Number, default: 0 },
        is_UrlShortnerAllowed: { type: Boolean, default: false },
        is_CalendarViewAllowed: { type: Boolean, default: false },
        is_CanvaAllowed: { type: Boolean, default: false },
        is_EngagementViewAllowed: { type: Boolean, default: false },
        is_DashboardViewAllowed: { type: Boolean, default: false },
    },
    ipInfo: {
        ip_address: String,
        city: String,
        country: String,
        countryCode: String,
        currency: String,
        lat: Number,
        lon: Number,
        mobile: Boolean,
        regionName: String,
        timezone: String,
        zip: String
    },
    suspended_status: { type: String, default: 'inactive' }
});

userSchema.set('timestamps', true)

var Users = module.exports = mongoose.model('users', userSchema);