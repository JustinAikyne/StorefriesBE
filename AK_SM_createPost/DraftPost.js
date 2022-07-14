var mongoose = require('mongoose');

var postMessageData = new mongoose.Schema({
    userId: String,
    userName: String,
    pageName: String,
    pageId: String,
    groupId:String,
    groupName:String
});

var draftPostData = new mongoose.Schema({
    tweetData: [postMessageData],
    fbpost: [postMessageData],
    linkedInData: [postMessageData],
    postStatus: String,
    postData: String,
    createdTime: String,
    updatedTime: String,
    scheduleTime: String,
    mediaData: [{
        fileDisplayName: String,
        progressStatus: String,
        fileKey: String,
        fileUrl: String
    }]
});

var twitterTweet = new mongoose.Schema({
    userId: String,
    email: String,
    draftPost: [draftPostData]
});


var TwitterTweet = module.exports = mongoose.model('userDraftPost', twitterTweet);