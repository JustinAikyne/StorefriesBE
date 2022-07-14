var mongoose = require('mongoose');

var notificationDetail = new mongoose.Schema({
    notificationText: String,
    createdDate: String,
    status: String
});

var usernotificationSchema = new mongoose.Schema({
    userId: String,
    notification: [notificationDetail]
});


var UsernotificationSchema = module.exports = mongoose.model('usernotification', usernotificationSchema);