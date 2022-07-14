var mongoose = require('mongoose');

var postMessageData = new mongoose.Schema({
    userId: String,
    pageId: String
});

var scheduledPost = new mongoose.Schema({
    tweetData: [postMessageData],
    fbpost: [postMessageData],
    linkedInData: [postMessageData],
    postStatus: String,
    postData: String,
    scheduleTime: String,
    mediaUrl: String
});

var twitterTweet = new mongoose.Schema({
    userId: String,
    email: String,
    scheduledPost: [scheduledPost]
});


var TwitterTweet = module.exports = mongoose.model('userScheduledPost', twitterTweet);