var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String, 
    lastName: String,
    email: String,
    password: String,
    invitedBy: String,
    phone: String,
    status: String,
    tempPlan: String,
    activationString: String
});

userSchema.set('timestamps', true)

var Users = module.exports = mongoose.model('users', userSchema);