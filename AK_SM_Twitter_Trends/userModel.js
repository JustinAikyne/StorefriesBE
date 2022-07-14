var mongoose = require('mongoose');

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
    tempPlan: String,
    suspended_status: { type: String, default: 'inactive' }
});

userSchema.set('timestamps', true)

var Users = module.exports = mongoose.model('users', userSchema);