var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String,
    lastName: String,
    email: String,
    password: String,
    phone: String,
    userType: String,
    socialLogin: String,
    changePassword: String,
    status: String,
    lastLogin: Date,
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