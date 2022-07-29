var mongoose = require('mongoose');

var socialDetail = new mongoose.Schema({
    name: String,
    oauth_token: String,
    oauth_token_secret: String,
    userId: String,
    locationId: String,
    channel_name: String,
    userProfileImage: String,
    token_expiry: Number,
    token_validity: Boolean,
    screenName: String,
    refresh_token: String,
    connected_date: Date,
    type: String
});

var socialSchema = new mongoose.Schema({
    userId: String,
    email: String,
    socialMedia: [socialDetail]
})

var SocialSchema = module.exports = mongoose.model('socialmedia', socialSchema);