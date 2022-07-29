var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String, 
    lastName: String,
    email: String,
    password: String,
    phone: String,
    workspaceId:String
});

var Users = module.exports = mongoose.model('users', userSchema);