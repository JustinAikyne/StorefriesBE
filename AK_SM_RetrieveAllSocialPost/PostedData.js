var mongoose = require('mongoose');

var postMessageData = new mongoose.Schema({
    userId: String,
    pageId: String,
    userName: String,
    pageName: String,
    postStatus: String,
    postId: String,
    postDate: String,
    mediaUrl: [String]
});

var postedPost = new mongoose.Schema({
    tweetData: [postMessageData],
    fbpost: [postMessageData],
    linkedInData: [postMessageData],
    postStatus: String,
    postData: String,
    scheduleTime: String,
    mediaData: [{
        fileDisplayName: String,
        progressStatus: String,
        fileKey: String,
        fileUrl: String
    }]
});

var postedData = new mongoose.Schema({
    userId: String,
    email: String,
    postData: [postedPost]
});


var TwitterTweet = module.exports = mongoose.model('socialpost', postedData);