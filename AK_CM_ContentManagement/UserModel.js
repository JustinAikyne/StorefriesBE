var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String, 
    lastName: String,
    email: String,
    password: String,
    phone: String,
    features: { 
        totalSocialChannel: { type: Number, default: 0 },
        totalUploadSize: { type: Number, default: 0 },
        totalSchedulePostCount: { type: Number, default: 0 },
        totalDraftPostCount: { type: Number, default: 0 },
        totalPostCount: { type: Number, default: 0 },
        totalRssFeedCount: { type: Number, default: 0 },
        currentSocialChannel: { type: Number, default: 0 },
        currentUploadSize: { type: Number, default: 0 },
        currentSchedulePostCount: { type: Number, default: 0 },
        currentDraftPostCount: { type: Number, default: 0 },
        currentRssFeedCount: { type: Number, default: 0 },
        currentPostCount: { type: Number, default: 0 },
        is_UrlShortnerAllowed: { type: Boolean, default: false },
        is_CalendarViewAllowed: { type: Boolean, default: false },
        is_CanvaAllowed: { type: Boolean, default: false },
        is_EngagementViewAllowed: { type: Boolean, default: false },
        is_DashboardViewAllowed: { type: Boolean, default: false },
    }
});

var Users = module.exports = mongoose.model('users', userSchema);