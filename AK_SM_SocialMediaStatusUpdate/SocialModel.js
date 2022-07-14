var mongoose = require('mongoose');

var socialSchema = new mongoose.Schema({
    userId: String,
    email: String,
    socialMedia: Array
});

var SocialSchema = module.exports = mongoose.model('socialmedia', socialSchema);