var mongoose = require('mongoose');

var linkedinSchema = new mongoose.Schema({
    userId: String,
    userName: String,
    userImage: String
})

var socialDetail = new mongoose.Schema({
    name: String,
    oauth_token: String,
    oauth_token_secret: String,
    token_expiry: Number,
    token_validity: Boolean,
    userId: String,
    type: String,
    fbpages:Array,
    linkedinPages:Array,
    linkedinProfile:linkedinSchema
});

var socialSchema = new mongoose.Schema({
    userId: String,
    email: String,
    socialMedia: [socialDetail]
})

var SocialSchema = module.exports = mongoose.model('socialmedia', socialSchema);