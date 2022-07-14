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

var scheduledPost = new mongoose.Schema({
    tweetData: [postMessageData],
    fbpost: [postMessageData],
    linkedInData: [postMessageData],
    youtubeData: [],
    instagraData: [],
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
    lat: Number,
    lng: Number,
    fbTarget : {},
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
    scheduledPost: [scheduledPost]
});


var TwitterTweet = module.exports = mongoose.model('userScheduledPost', twitterTweet);