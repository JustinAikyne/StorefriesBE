var mongoose = require('mongoose');

var postMessageData = new mongoose.Schema({
    userId: String,
    locationId: String,
    pageId: String
});

var scheduledPost = new mongoose.Schema({
    tweetData: [postMessageData],
    fbpost: [postMessageData],
    linkedInData: [postMessageData],
    instagramData: [postMessageData],
    youtubeData: [postMessageData],
    gmbData: [postMessageData],
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