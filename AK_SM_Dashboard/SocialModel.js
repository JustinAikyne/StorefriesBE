var mongoose = require('mongoose');

var socialSchema = new mongoose.Schema({
    userId: String,
    email: String,
    socialMedia: Array,
    // start_time:Number,
    // end_time:Number
});

var SocialSchema = module.exports = mongoose.model('socialmedia', socialSchema);