var mongoose = require('mongoose');

var postMessageData = new mongoose.Schema({
    userId: String,
    userName: String,
    pageName: String,
    pageId: String,
    groupId:String,
    groupName:String,
    place_id: String,
    mediaUrl: [String]
    
});

var draftPostData = new mongoose.Schema({
    tweetData: [postMessageData],
    fbpost: [postMessageData],
    linkedInData: [postMessageData],
    youtubeData: [],
    instagramData: [],
    postStatus: String,
    postData: String,
    scheduleTime: String,
    mediaType: String,
    linkObj: {
        url: String,
        title: String,
        description: String,
        thumbnail: String
    },
    fbTarget : {},
    createdTime: String,
    updatedTime: String,
    mediaData: [{
        fileDisplayName: String,
        progressStatus: String,
        fileKey: String,
        fileUrl: String
    }],
    youtubeObj: {
        title: String,
        tag: [
            String,
            String
        ],
        privacyStatus: String,
        publicStatsViewable: Boolean,
        madeForKids: Boolean,
        selfDeclaredMadeForKids: Boolean
    }
});

var twitterTweet = new mongoose.Schema({
    userId: String,
    email: String,
    draftPost: [draftPostData]
});


var TwitterTweet = module.exports = mongoose.model('userDraftPost', twitterTweet);