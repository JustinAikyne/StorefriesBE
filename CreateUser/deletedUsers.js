var mongoose = require('mongoose');

var deletedUserSchema = new mongoose.Schema({
    email: String,
    status: String,
    suspended_status: String,
    lastLogin: Date
});

deletedUserSchema.set('timestamps', true)

var deletedUsers = module.exports = mongoose.model('deletedUsers', deletedUserSchema);