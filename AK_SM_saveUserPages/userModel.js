var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String, 
    lastName: String,
    email: String,
    phone: String,
    status: String,
    activationString: String,
    location: {
        lng: Number,
        lat: Number
    },
    formatted_address: String,
    suspended_status: { type: String, default: 'inactive' },
    features: { 
        totalSocialChannel: { type: Number, default: 0 },
        totalImageCount: { type: Number, default: 0 },
        totalSchedulePostCount: { type: Number, default: 0 },
        totalDraftPostCount: { type: Number, default: 0 },
        totalPostCount: { type: Number, default: 0 },
        totalRssFeedCount: { type: Number, default: 0 },
        currentSocialChannel: { type: Number, default: 0 },
        currentImageCount: { type: Number, default: 0 },
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