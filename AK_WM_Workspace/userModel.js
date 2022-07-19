var mongoose = require('mongoose');
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String, 
    lastName: String,
    email: String,
    password: String,
    phone: String,
    status: String,
    activationString: String,
    location: {
        lng: Number,
        lat: Number
    },
    formatted_address: String,
    default_workspace: ObjectId,
    suspended_status: { type: String, default: 'inactive' },
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
        is_DashboardViewAllowed: Boolean
    }
});

userSchema.set('timestamps', true)

var Users = module.exports = mongoose.model('users', userSchema);