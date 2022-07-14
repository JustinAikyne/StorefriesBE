var mongoose = require('mongoose');

var facebookPages = new mongoose.Schema({
    name: String,
    access_token:String,
    category: String,
    selected: { type: Boolean, select: false },
    id: String
});

var socialDetail = new mongoose.Schema({
    name: String,
    oauth_token: { type: String, select: false },
    oauth_token_secret: { type: String, select: false },
    userId: String,
    locationId: String,
    refresh_token: String,
    userProfileImage: String,
    channel_name: String,
    linkedinPages: [],
    fbpages: [facebookPages]
});

var socialSchema = new mongoose.Schema({
    userId: String,
    email: String,
    socialMedia: [socialDetail]
});



var SocialSchema = module.exports = mongoose.model('socialmedia', socialSchema);