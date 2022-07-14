var mongoose = require('mongoose');

var postMessageData = new mongoose.Schema({
    userId: String,
    userName: String,
    pageId: String,
    pageName: String,
    postStatus: String,
    postId: String,
    postDate: String,
    mediaUrl: [String]
});

var postData = new mongoose.Schema({
    tweetData: [postMessageData],
    fbpost: [postMessageData],
    linkedInData: [postMessageData],
    youtubeData: [postMessageData],
    postStatus: String,
    postData: String,
    scheduleTime: String,
    postTime: String,
    refresh_token: String,
    channel_name: String,
    mediaData: [{
        fileDisplayName: String,
        progressStatus: String,
        fileKey: String,
        fileUrl: String
    }],
    linkObj: {
        url: String,
        title: String,
        description: String,
        thumbnail: String
    }
});

var twitterTweet = new mongoose.Schema({
    userId: String,
    email: String,
    postData: [postData]
});


var TwitterTweet = module.exports = mongoose.model('socialpost', twitterTweet);