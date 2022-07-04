var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var userSchema = new Schema({
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
    role: String,
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
        is_UrlShortnerAllowed: Number,
        is_CalendarViewAllowed: Number,
        is_CanvaAllowed: Number,
        is_EngagementViewAllowed: Number,
        is_DashboardViewAllowed: Number,
    },
    //workspaceIds: [],
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
    defaultWorkspace: String,
    suspended_status: { type: String, default: 'inactive' }
});

userSchema.set('timestamps', true)

var Users = module.exports = mongoose.model('users', userSchema);