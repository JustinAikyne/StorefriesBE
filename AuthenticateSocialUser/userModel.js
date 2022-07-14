var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String,
    lastName: String,
    email: String,
    password: String,
    userType: String,
    socialLogin: String,
    status: String,
    lastLogin: Date,
    features: {
        totalSocialChannel: Number,
        totalUploadSize: Number,
        totalSchedulePostCount: Number,
        totalPostCount: Number,
        totalRssFeedCount: Number,
        totalDraftPostCount: Number,
        currentDraftPostCount: Number,
        currentSocialChannel: Number,
        currentUploadSize: Number,
        currentSchedulePostCount: Number,
        currentRssFeedCount: Number,
        currentPostCount: Number,
        is_UrlShortnerAllowed: Boolean,
        is_CalendarViewAllowed: Boolean,
        is_CanvaAllowed: Boolean,
        is_EngagementViewAllowed: Boolean,
        is_DashboardViewAllowed: Boolean,
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
    lastLoginIpInfo: {
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
    }

});

userSchema.set('timestamps', true)

var Users = module.exports = mongoose.model('users', userSchema);