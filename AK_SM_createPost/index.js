var mongoose = require('mongoose');
var postModel = require('./PostData.js');
var socialModel = require('./SocialModel.js');
var scheduledPostModel = require('./ScheduledPost.js');
var notificationModel = require('./NotificationModel.js');
var userModel = require('./userModel.js');
var ObjectId = require('mongoose').Types.ObjectId;
//var AuthHelper = require('./AuthHelper.js');
var axios = require('axios');
var Twitter = require('twitter');
var aws = require("aws-sdk");
var async = require('async');
var draftPostModel = require('./DraftPost.js');
const { google } = require('googleapis');
const fs = require('fs');
const Joi = require('joi');
var subscriptionModel = require('./subscriptionModel.js');

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? err !== '200' ? '400' : '200' : '200',
        body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });

    var allPostSuccess = 0;
    var allPostFailure = 0;
    var notifArr = [];

    const asyncPostFacebook = (email, postData, socialPost, mediaData, postReq) => {
        socialPost = socialPost.replace(/#/g, '%23');
        console.log('Facebook Post called>>>' + socialPost);
        return new Promise((resolve, reject) => {
            let postSuccess = 0;
            let postFailure = 0;
            let postExecuted = 0;

            const fbRespData = []

            for (var i = 0; i < postData.length; i++) {
                const userId = postData[i].userId;
                let pageId = postData[i].pageId;
                let locationId = postData[i]?.locationId ?? null;
                let postId = null;
                let mediaType = postReq?.mediaType;

                if (postData[i].groupId) {
                    pageId = postData[i].groupId;
                }

                let request = {};

                if (locationId) {
                    request.place = locationId;
                }

                console.log("postReq?.fbTarget?.geo_locations.countries[0]", JSON.stringify(postReq?.fbTarget?.geo_locations.countries[0]));

                if (postReq?.fbTarget?.geo_locations?.countries && postReq?.fbTarget?.geo_locations.countries.length > 0 && postReq?.fbTarget?.geo_locations.countries[0] && postReq.fbTarget.geo_locations.countries[0] !== "") {
                    console.log(".............")
                    request.targeting = {};
                    request.targeting = postReq.fbTarget;
                }

                if (postData[i].postId) {
                    postId = postData[i].postId;
                }

                socialModel.aggregate(
                    [{ "$match": { email: email } },
                    { "$unwind": "$socialMedia" },
                    { "$match": { "socialMedia.name": "facebook", 'socialMedia.userId': userId } },
                    { "$unwind": "$socialMedia.fbpages" },
                    { "$match": { "socialMedia.fbpages.id": pageId } },
                    { "$project": { _id: 0, "pageToken": "$socialMedia.fbpages.access_token", "pageId": "$socialMedia.fbpages.id", "userId": "$socialMedia.userId", "pageName": "$socialMedia.fbpages.name", "type": "$socialMedia.fbpages.type" } }
                    ]
                ).exec(function (err, doc) {
                    if (doc) {
                        let fbUrl = `https://graph.facebook.com/${doc[0].pageId}/feed?message=${socialPost}&access_token=${doc[0].pageToken}`;
                        if (postId !== null) {
                            fbUrl = `https://graph.facebook.com/${postId}?message=${socialPost}&access_token=${doc[0].pageToken}`;
                        }

                        if (mediaData && mediaData.length > 0) {

                            let splitVal = mediaData[0].fileUrl.split('.')
                            let ext = splitVal[splitVal.length - 1]

                            if (ext == 'mp4' || ext == 'gif') {
                                mediaType = 'video'
                            } else {
                                mediaType = 'image'
                            }
                        }
                        console.log("mediaType..........", mediaType)
                        if (mediaType && (mediaType == 'video' || mediaType == 'gif') && !postId && mediaData && mediaData.length > 0) {
                            let params = ''
                            if (postReq?.videoObj?.title) {
                                params = `&title=${postReq.videoObj.title}`
                            }
                            fbUrl = `https://graph.facebook.com/${doc[0].pageId}/videos?description=${socialPost}&access_token=${doc[0].pageToken}&file_url=${mediaData[0].fileUrl}${params}`;
                        }

                        if (!postId && mediaData && mediaData.length > 0 && (!mediaType || mediaType == 'image')) {
                            const promiseFBArray = [];
                            for (var k = 0; k < mediaData.length; k++) {
                                promiseFBArray.push(axios.post(`https://graph.facebook.com/${pageId}/photos?url=${mediaData[k].fileUrl}&access_token=${doc[0].pageToken}&published=false`, null));
                            }

                            Promise.all(promiseFBArray).then(resArr => {
                                let attachmentString = "";
                                for (var k = 0; k < mediaData.length; k++) {
                                    if (attachmentString === "") {
                                        attachmentString = "attached_media[" + k + "]={\"media_fbid\":\"" + resArr[k].data.id + "\"}"
                                    } else {
                                        attachmentString = attachmentString + "&attached_media[" + k + "]={\"media_fbid\":\"" + resArr[k].data.id + "\"}"
                                    }
                                }
                                fbUrl = `https://graph.facebook.com/${doc[0].pageId}/feed?message=${socialPost}&access_token=${doc[0].pageToken}&${'' + attachmentString.toString()}`

                                console.log("request............", JSON.stringify(request))
                                axios.post(fbUrl, request).then((res) => {
                                    Promise.all([axios.get('https://graph.facebook.com/' + res.data.id + '?access_token=' + doc[0].pageToken + '&fields=message,created_time,attachments')]).then((convRes) => {
                                        const mediaUrl = [];
                                        if (convRes[0].data.attachments && convRes[0].data.attachments.data && convRes[0].data.attachments.data[0]) {
                                            for (var l = 0; l < convRes[0].data.attachments.data.length; l++) {
                                                mediaUrl.push(convRes[0].data.attachments.data[l].media.image.src)
                                            }
                                            if (convRes[0].data.attachments.data[0].subattachments && convRes[0].data.attachments.data[0].subattachments.data) {
                                                for (var q = 1; q < convRes[0].data.attachments.data[0].subattachments.data.length; q++) {
                                                    mediaUrl.push(convRes[0].data.attachments.data[0].subattachments.data[q].media.image.src)
                                                }
                                            }
                                        }

                                        postExecuted = postExecuted + 1;
                                        postSuccess = postSuccess + 1;
                                        allPostSuccess = allPostSuccess + 1;

                                        /* notifArr.push({
                                            notificationText: `Facebook Post for ${doc[0].pageName} posted successfully`,
                                            createdDate: new Date().toISOString(),
                                            status: 'unread'
                                        }); */

                                        fbRespData.push({
                                            userId: doc[0].userId,
                                            pageId: doc[0].pageId,
                                            userName: doc[0].pageName,
                                            postStatus: 'Success',
                                            postId: res.data.id,
                                            mediaUrl: mediaUrl,
                                            postDate: new Date()
                                        })

                                        if (postExecuted == postData.length) {
                                            resolve({
                                                // notifArr: notifArr,
                                                postData: fbRespData,
                                                facebookMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                            });
                                        }
                                    });

                                }).catch((error) => {
                                    postExecuted = postExecuted + 1;
                                    postFailure = postFailure + 1;
                                    allPostFailure = allPostFailure + 1;
                                    console.error(error);

                                    notifArr.push({
                                        notificationText: `Facebook Post for ${doc[0].pageName} failed`,
                                        createdDate: new Date().toISOString(),
                                        status: 'unread'
                                    });

                                    fbRespData.push({
                                        userId: doc[0].userId,
                                        pageId: doc[0].pageId,
                                        userName: doc[0].pageName,
                                        postStatus: 'Failure',
                                        postId: '',
                                        postDate: new Date()
                                    });
                                    if (postExecuted == postData.length) {
                                        resolve({
                                            notifArr: notifArr,
                                            postData: fbRespData,
                                            facebookMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                        });
                                    }

                                })

                            })
                        } else {
                            console.log("request", JSON.stringify(request))
                            if (postReq.linkObj && postReq.linkObj.url) {
                                request.link = postReq.linkObj.url;
                            }
                            axios.post(fbUrl, request).then((res) => {
                                postExecuted = postExecuted + 1;
                                postSuccess = postSuccess + 1;
                                allPostSuccess = allPostSuccess + 1;

                                /* notifArr.push({
                                    notificationText: `Facebook Post for ${doc[0].pageName} posted successfully`,
                                    createdDate: new Date().toISOString(),
                                    status: 'unread'
                                }); */

                                fbRespData.push({
                                    userId: doc[0].userId,
                                    pageId: doc[0].pageId,
                                    userName: doc[0].pageName,
                                    postStatus: 'Success',
                                    postId: res.data.id,
                                    postDate: new Date()
                                });

                                if (postExecuted == postData.length) {
                                    resolve({
                                        // notifArr: notifArr,
                                        postData: fbRespData,
                                        facebookMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                    });
                                }
                            }).catch((error) => {
                                postExecuted = postExecuted + 1;
                                postFailure = postFailure + 1;
                                allPostFailure = allPostFailure + 1;

                                notifArr.push({
                                    notificationText: `Facebook Post for ${doc[0].pageName} failed`,
                                    createdDate: new Date().toISOString(),
                                    status: 'unread'
                                });

                                fbRespData.push({
                                    userId: doc[0].userId,
                                    pageId: doc[0].pageId,
                                    userName: doc[0].pageName,
                                    postStatus: 'Failure',
                                    postId: '',
                                    postDate: new Date()
                                });
                                if (postExecuted == postData.length) {
                                    resolve({
                                        notifArr: notifArr,
                                        postData: fbRespData,
                                        facebookMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                    });
                                }

                            })
                        }

                    } else {
                        postExecuted = postExecuted + 1;
                        postFailure = postFailure + 1;
                        allPostFailure = allPostFailure + 1;
                        notifArr.push({
                            notificationText: `Facebook Post scheduled failed since the Profile is not linked anymore`,
                            createdDate: new Date().toISOString(),
                            status: 'unread'
                        });

                        fbRespData.push({
                            userId: userId,
                            pageId: pageId,
                            userName: '',
                            postStatus: 'Failure',
                            postId: '',
                            postDate: new Date()
                        })
                        if (postExecuted == postData.length) {
                            resolve({
                                notifArr: notifArr,
                                postData: fbRespData,
                                facebookMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                            });
                        }
                    }
                });
            }
            if (postData.length === 0) {
                resolve({
                    postData: postData,
                    facebookMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                });
            }
        });
    }

    const asyncPostLinkedIn = (email, linkedInDataLocal, socialPost, mediaData, postReq) => {
        console.log('LinkedIn Post called>>>');
        return new Promise((resolve, reject) => {
            let postSuccess = 0;
            let postFailure = 0;
            let postExecuted = 0;

            const linkedInRespData = []
            for (var i = 0; i < linkedInDataLocal.length; i++) {
                const userId = linkedInDataLocal[i].userId;
                const pageId = linkedInDataLocal[i].pageId;
                const userName = linkedInDataLocal[i]?.userName ?? '';
                const linkedMedia = [];
                const mediaType = postReq?.mediaType;
                if (linkedInDataLocal[i].mediaUrl) {
                    for (var j = 0; j < linkedInDataLocal[i].mediaUrl.length; j++) {
                        linkedMedia.push({
                            "media": linkedInDataLocal[i].mediaUrl[j],
                            "status": "READY",
                            "title": {
                                "attributes": [],
                                "text": ""
                            }
                        })
                    }
                }
                let lkUserId = "urn:li:person:" + userId;
                if (pageId && pageId != null && pageId != '') {
                    lkUserId = pageId
                }

                let shareContent = {
                    "shareCommentary": {
                        "text": socialPost
                    },
                    "shareMediaCategory": "NONE"
                };

                if (postReq.linkObj && postReq.linkObj.url) {
                    linkedMedia.push({
                        "originalUrl": postReq.linkObj.url,
                        "thumbnails": [{
                            "url": postReq.linkObj.thumbnail
                        }],
                        "status": "READY",
                        "title": {
                            "attributes": [],
                            "text": postReq.linkObj.title
                        },
                        "description": {
                            "text": postReq.linkObj.description
                        }
                    })
                }
                if (linkedMedia.length > 0) {
                    shareContent.media = linkedMedia;
                    if (mediaData.length < 1) {
                        shareContent.shareMediaCategory = "ARTICLE";
                    } else {
                        shareContent.shareMediaCategory = "IMAGE";
                    }
                    if (mediaType && mediaType == "video") {
                        shareContent.shareMediaCategory = "VIDEO"
                    }
                }

                let request = {
                    url: 'https://api.linkedin.com/v2/ugcPosts',
                    method: 'POST',
                    body: {
                        "author": lkUserId,
                        "lifecycleState": "PUBLISHED",
                        "specificContent": {
                            "com.linkedin.ugc.ShareContent": shareContent
                        },
                        "visibility": {
                            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                        }
                    }
                }
                if (linkedInDataLocal[i].postId) {
                    request = {
                        url: 'https://api.linkedin.com/v2/shares/' + linkedInDataLocal[i].postId,
                        method: 'POST',
                        body: {
                            "patch": {
                                "$set": {
                                    "text": {
                                        "annotations": [],
                                        "text": socialPost
                                    }
                                }
                            }
                        }
                    }
                }

                console.log("request", JSON.stringify(request));
                const mdQuery = { 'email': { $regex: new RegExp("^" + email, "i") }, 'socialMedia.name': 'linkedin', 'socialMedia.userId': userId };
                socialModel.findOne(mdQuery, { _id: 0, socialMedia: { $elemMatch: { name: "linkedin", userId: userId } } })
                    .exec(function (err, doc) {
                        if (doc) {
                            axios.post(request.url,
                                request.body, { headers: { 'Authorization': 'Bearer ' + doc.socialMedia[0].oauth_token } }).then((res) => {
                                    postExecuted = postExecuted + 1;
                                    postSuccess = postSuccess + 1;
                                    allPostSuccess = allPostSuccess + 1;

                                    /* notifArr.push({
                                        notificationText: `LinkedIn Post for ${userName} posted successfully`,
                                        createdDate: new Date().toISOString(),
                                        status: 'unread'
                                    }); */

                                    linkedInRespData.push({
                                        userId: doc.socialMedia[0].userId,
                                        userName: doc.socialMedia[0].screenName,
                                        postStatus: 'Success',
                                        postId: res.data.id,
                                        pageId: pageId,
                                        postDate: new Date()
                                    })

                                    if (postExecuted == linkedInDataLocal.length) {
                                        resolve({
                                            // notifArr: notifArr,
                                            postData: linkedInRespData,
                                            linkedInMessage: `${postSuccess} LinkedIn Post successfull.${postFailure} LinkedIn Post failed`
                                        });
                                    }
                                }).catch((error) => {

                                    postExecuted = postExecuted + 1;
                                    postFailure = postFailure + 1;
                                    allPostFailure = allPostFailure + 1;

                                    console.error(error);
                                    notifArr.push({
                                        notificationText: `LinkedIn Post for ${userName} failed`,
                                        createdDate: new Date().toISOString(),
                                        status: 'unread'
                                    });

                                    linkedInRespData.push({
                                        userId: doc.socialMedia[0].userId,
                                        userName: userName,
                                        postStatus: 'Failure',
                                        postId: '',
                                        pageId: pageId,
                                        postDate: new Date()
                                    })

                                    if (postExecuted == linkedInDataLocal.length) {
                                        resolve({
                                            notifArr: notifArr,
                                            postData: linkedInRespData,
                                            linkedInMessage: `${postSuccess} LinkedIn Post successfull.${postFailure} LinkedIn Post failed`
                                        });
                                    }
                                });
                        } else {
                            postExecuted = postExecuted + 1;
                            postFailure = postFailure + 1;
                            allPostFailure = allPostFailure + 1;

                            notifArr.push({
                                notificationText: `LinkedIn Post failed since the profile is not linked anymore`,
                                createdDate: new Date().toISOString(),
                                status: 'unread'
                            });

                            linkedInRespData.push({
                                userId: userId,
                                userName: '',
                                postStatus: 'Failure',
                                postId: '',
                                pageId: pageId,
                                postDate: new Date()
                            })

                            if (postExecuted == linkedInDataLocal.length) {
                                resolve({
                                    notifArr: notifArr,
                                    postData: linkedInRespData,
                                    linkedInMessage: `${postSuccess} LinkedIn Post successfull.${postFailure} LinkedIn Post failed`
                                });
                            }
                        }
                    });
            }
            if (linkedInDataLocal.length === 0) {
                resolve({
                    postData: linkedInDataLocal,
                    linkedInMessage: `${postSuccess} LinkedIn Post successfull.${postFailure} LinkedIn Post failed`
                });
            }
        });
    }

    const asyncPostTwitter = (email, tweetDataLocal, socialPost, mediaData, postReq) => {
        console.log('Twitter Post called>>>');
        return new Promise(async (resolve, reject) => {
            let postSuccess = 0;
            let postFailure = 0;
            let postExecuted = 0;

            const request = {
                url: 'https://api.twitter.com/1.1/statuses/update.json?status=' + socialPost,
                method: 'POST',
                body: {}
            }

            const tweetRespData = []
            const tweetDataPost = { status: socialPost }
            if (postReq.lat && postReq.lng) {
                tweetDataPost['lat'] = postReq.lat;
                tweetDataPost['long'] = postReq.lng;
                tweetDataPost['display_coordinates'] = true;
            }

            console.log("tweetDataLocal.....", JSON.stringify(tweetDataLocal));
            for (var i = 0; i < tweetDataLocal.length; i++) {
                const userId = tweetDataLocal[i].userId;

                if (!!tweetDataLocal[i].mediaUrl && tweetDataLocal[i].mediaUrl.length > 0) {
                    request.url = request.url + '&media_ids=' + tweetDataLocal[i].mediaUrl.toString();
                    tweetDataPost['media_ids'] = tweetDataLocal[i].mediaUrl.toString()
                }
                if (tweetDataLocal[i].postId) {
                    tweetDataPost['in_reply_to_status_id'] = tweetDataLocal[i].postId;
                }
                if (tweetDataLocal[i].place_id) {
                    tweetDataPost['place_id'] = tweetDataLocal[i].place_id;
                }
                const mdQuery = { 'email': { $regex: new RegExp("^" + email, "i") }, 'socialMedia.name': 'twitter', 'socialMedia.userId': userId };
                let doc = await socialModel.findOne(mdQuery, { _id: 0, socialMedia: { $elemMatch: { name: "twitter", userId: userId } } })
                //socialModel.findOne(mdQuery, { _id: 0, socialMedia: { $elemMatch: { name: "twitter", userId: userId } } }).exec(function (err, doc) {
                if (doc) {
                    //const authHeader = AuthHelper.getAuthHeaderForRequest(request, doc.socialMedia[0].oauth_token, doc.socialMedia[0].oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);

                    client = new Twitter({
                        consumer_key: CONSUMERKEY,
                        consumer_secret: CONSUMERSECRET,
                        access_token_key: doc.socialMedia[0].oauth_token,
                        access_token_secret: doc.socialMedia[0].oauth_token_secret
                    });
                    client.post('statuses/update', tweetDataPost, (error, tweet, res) => {
                        if (error) {
                            postExecuted = postExecuted + 1;
                            postFailure = postFailure + 1;
                            allPostFailure = allPostFailure + 1;

                            console.error("error case....", JSON.stringify(error));
                            notifArr.push({
                                notificationText: `Twitter Post for ${doc.socialMedia[0].screenName} failed`,
                                createdDate: new Date().toISOString(),
                                status: 'unread'
                            });
                            tweetRespData.push({
                                userId: doc.socialMedia[0].userId,
                                userName: doc.socialMedia[0].screenName,
                                postStatus: 'Failure',
                                postId: '',
                                postDate: new Date()
                            })

                            if (postExecuted == tweetDataLocal.length) {
                                resolve({
                                    notifArr: notifArr,
                                    postData: tweetRespData,
                                    twitterMessage: `${postSuccess} Tweets successfull.${postFailure} Tweets failed`
                                });
                            }
                        } else {
                            postExecuted = postExecuted + 1;
                            postSuccess = postSuccess + 1;
                            allPostSuccess = allPostSuccess + 1;
                            const mediaUrl = [];
                            if (tweet && tweet.extended_entities && tweet.extended_entities.media && tweet.extended_entities.media.length > 0) {
                                for (var k = 0; k < tweet.extended_entities.media.length; k++) {
                                    mediaUrl.push(tweet.extended_entities.media[k].media_url_https);
                                }
                            }
                            /* notifArr.push({
                                notificationText: `Twitter Post for ${doc.socialMedia[0].screenName} posted successfully`,
                                createdDate: new Date().toISOString(),
                                status: 'unread'
                            }); */

                            tweetRespData.push({
                                userId: doc.socialMedia[0].userId,
                                userName: doc.socialMedia[0].screenName,
                                postStatus: 'Success',
                                postId: tweet.id_str,
                                mediaUrl: mediaUrl,
                                postDate: new Date()
                            })

                            if (postExecuted == tweetDataLocal.length) {
                                resolve({
                                    //notifArr: notifArr,
                                    postData: tweetRespData,
                                    twitterMessage: `${postSuccess} Tweets successfull.${postFailure} Tweets failed`
                                });
                            }
                        }

                    })
                } else {
                    postExecuted = postExecuted + 1;
                    postFailure = postFailure + 1;
                    allPostFailure = allPostFailure + 1;

                    notifArr.push({
                        notificationText: `Twitter Post failed since the profile is not linked anymore`,
                        createdDate: new Date().toISOString(),
                        status: 'unread'
                    });

                    tweetRespData.push({
                        userId: userId,
                        userName: '',
                        postStatus: 'Failure',
                        postId: '',
                        postDate: new Date()
                    })

                    if (postExecuted == tweetDataLocal.length) {
                        resolve({
                            notifArr: notifArr,
                            postData: tweetRespData,
                            twitterMessage: `${postSuccess} Tweets successfull.${postFailure} Tweets failed`
                        });
                    }
                }
                //});
            }
            if (tweetDataLocal.length === 0) {
                resolve({
                    postData: tweetDataLocal,
                    twitterMessage: `${postSuccess} Tweets successfull.${postFailure} Tweets failed`
                });
            }
        });
    }

    const asyncPostInstagram = (email, postData, socialPost, mediaData, postReq) => {
        socialPost = socialPost.replace(/#/g, '%23');

        return new Promise((resolve, reject) => {
            let postSuccess = 0;
            let postFailure = 0;
            let postExecuted = 0;

            const igRespData = []
            const fbRespData = []

            for (var i = 0; i < postData.length; i++) {
                let userId = postData[i].userId;
                let pageId = postData[i].pageId;
                let location_id = postData[i]?.locationId ?? null;
                let mediaType = postReq.mediaType;
                console.log("mediaType", mediaType)

                socialModel.aggregate(
                    [{ "$match": { email: email } },
                    { "$unwind": "$socialMedia" },
                    { "$match": { "socialMedia.name": "instagram", 'socialMedia.userId': userId } }
                    ]
                ).exec(async (err, doc) => {

                    if (doc) {
                        if (mediaData && mediaData.length > 0) {
                            const promiseFBArray = [];

                            let uploadImage = async (mediaUrl, type, carousel) => {
                                return new Promise(async (resolve, reject) => {

                                    let mediaReq = `https://graph.facebook.com/v13.0/${userId}/media?image_url=${mediaUrl}&caption=${socialPost}&access_token=${doc[0].socialMedia.oauth_token}`
                                    if (type == 'video') {
                                        mediaReq = `https://graph.facebook.com/${userId}/media?media_type=VIDEO&caption=${socialPost}&video_url=${mediaUrl}&access_token=${doc[0].socialMedia.oauth_token}`
                                    }
                                    if (carousel == true) {
                                        let carousel_item = '&is_carousel_item=true'
                                        mediaReq = `https://graph.facebook.com/${userId}/media?image_url=${mediaUrl}&caption=${socialPost}${carousel_item}&access_token=${doc[0].socialMedia.oauth_token}`;
                                        if (type == 'video') {
                                            console.log("carousel video")
                                            mediaReq = `https://graph.facebook.com/${userId}/media?media_type=VIDEO&caption=${socialPost}&video_url=${mediaUrl}${carousel_item}&access_token=${doc[0].socialMedia.oauth_token}`
                                        }
                                    }
                                    if (location_id) {
                                        mediaReq = `${mediaReq}&location_id=${location_id}`
                                    }

                                    console.log("mediaReq..............", mediaReq)
                                    axios.post(mediaReq, null).then((resp) => {
                                        if (resp.data) {
                                            console.log("resp.data", JSON.stringify(resp.data));
                                            if (type == 'video') {
                                                function getMediaStatus(media_id) {
                                                    setTimeout(() => {
                                                        let statusUrl = `https://graph.facebook.com/${media_id}?fields=status_code&access_token=${doc[0].socialMedia.oauth_token}`
                                                        axios.get(statusUrl, null).then((getState) => {
                                                            switch (getState.data.status_code) {
                                                                case 'FINISHED':
                                                                    resolve({ status: true, data: resp.data })
                                                                    break;
                                                                case 'IN_PROGRESS':
                                                                    console.log("in_progress.......................")
                                                                    getMediaStatus(media_id)
                                                                    break;
                                                                case 'ERROR':
                                                                    console.log("ERROR.......................")
                                                                    resolve({ status: false })
                                                                case 'EXPIRED':
                                                                    console.log("EXPIRED.......................")

                                                                    resolve({ status: false })
                                                                case 'PUBLISHED':
                                                                    console.log("PUBLISHED.......................")

                                                                    resolve({ status: false })
                                                                default:
                                                                    console.log("default.......................")
                                                                    resolve({ status: false })
                                                                    break;
                                                            }
                                                        }).catch(err => {
                                                            console.log("err............................", JSON.stringify(err))
                                                            resolve({
                                                                status: false
                                                            })
                                                        })

                                                    }, 1000);
                                                }
                                                getMediaStatus(resp.data.id)

                                            } else {
                                                resolve({ status: true, data: resp.data })
                                            }
                                        } else {
                                            resolve({ status: false, data: {} })
                                        }
                                    }).catch(err => {
                                        console.log("...err......................", JSON.stringify(err))
                                        resolve({
                                            status: false,
                                            imgData: {}
                                        })
                                    })
                                })
                            }
                            if (mediaData.length > 1) {
                                let carousel = true
                                let type = '';
                                for (var k = 0; k < mediaData.length; k++) {
                                    let splitVal = mediaData[k].fileUrl.split('.')
                                    let ext = splitVal[splitVal.length - 1]
                                    console.log(" ext....if......", ext)
                                    if (ext == 'mp4' || ext == 'gif') {
                                        type = 'video'
                                    } else {
                                        type = 'image'
                                    }

                                    promiseFBArray.push(uploadImage(mediaData[k].fileUrl, type, carousel));
                                }

                            } else {
                                let type = '';
                                let carousel = false
                                let splitVal = mediaData[0].fileUrl.split('.')
                                let ext = splitVal[splitVal.length - 1]

                                if (ext == 'mp4' || ext == 'gif') {
                                    type = 'video'
                                } else {
                                    type = 'image'
                                }
                                promiseFBArray.push(uploadImage(mediaData[0].fileUrl, type, carousel));
                            }

                            //console.log("promiseFBArray", JSON.stringify(promiseFBArray))
                            await Promise.all(promiseFBArray).then(async (resArr) => {

                                let creation_id = '';
                                if (resArr && resArr[0] && resArr[0]?.status == true) {
                                    //console.log("resrr..................")
                                    creation_id = resArr[0].data.id;

                                    if (resArr.length > 0) {
                                        console.log("resArr.length.......iffffffff..........")
                                        let childIds = [];
                                        resArr.forEach(mediaFile => {
                                            if (mediaFile.status == true) {
                                                childIds.push(mediaFile.data.id)
                                            }
                                        });
                                        console.log("childIds.length..", childIds.length)
                                        if (childIds.length > 1) {
                                            console.log("childIds.")
                                            let igUrl = `https://graph.facebook.com/v13.0/${userId}/media?caption=${socialPost}&media_type=CAROUSEL&children=${childIds.toString()}&access_token=${doc[0].socialMedia.oauth_token}`
                                            console.log("igUrl", igUrl)
                                            try {
                                                let instadata = await axios.post(igUrl, null);
                                                console.log("instadata....", JSON.stringify(instadata.data))
                                                creation_id = instadata.data.id
                                            } catch (error) {
                                                console.log("error", JSON.stringify(error.message))
                                            }
                                        }
                                    }

                                    console.log("creation_id", creation_id);
                                    let params = '';
                                    params = `creation_id=${creation_id}`;
                                    // if (location_id) {
                                    //     params = `creation_id=${creation_id}&location_id=${location_id}`;
                                    // }
                                    let fbUrl = `https://graph.facebook.com/${userId}/media_publish?${params}&access_token=${doc[0].socialMedia.oauth_token}`

                                    console.log("fbUrl................", fbUrl);
                                    axios.post(fbUrl, null).then((res) => {

                                        console.log(".........res.data...........", JSON.stringify(res.data))
                                        const mediaUrl = [];

                                        postExecuted = postExecuted + 1;
                                        postSuccess = postSuccess + 1;
                                        allPostSuccess = allPostSuccess + 1;

                                        /* notifArr.push({
                                            notificationText: `Instagram Post for ${doc[0].socialMedia.screenName} posted successfully`,
                                            createdDate: new Date().toISOString(),
                                            status: 'unread'
                                        }); */

                                        igRespData.push({
                                            userId: userId,
                                            userName: doc[0].socialMedia.screenName,
                                            postStatus: 'Success',
                                            postId: res.data.id,
                                            mediaUrl: mediaUrl,
                                            postDate: new Date()
                                        })
                                        console.log(".....................2...............................")
                                        console.log("igRespData............", JSON.stringify(igRespData));

                                        if (postExecuted == postData.length) {
                                            resolve({
                                                // notifArr: notifArr,
                                                postData: igRespData,
                                                facebookMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                            });
                                        }
                                        console.log("........................3............................")


                                    }).catch((error) => {
                                        console.log("error", JSON.stringify(error));
                                        postExecuted = postExecuted + 1;
                                        postFailure = postFailure + 1;
                                        allPostFailure = allPostFailure + 1;

                                        notifArr.push({
                                            notificationText: `Instagram Post for ${doc[0].socialMedia.screenName} post failed`,
                                            createdDate: new Date().toISOString(),
                                            status: 'unread'
                                        });

                                        igRespData.push({
                                            userId: userId,
                                            userName: doc[0].socialMedia.screenName,
                                            postStatus: 'Failure',
                                            postId: '',
                                            postDate: new Date()
                                        });
                                        if (postExecuted == postData.length) {
                                            resolve({
                                                notifArr: notifArr,
                                                postData: igRespData,
                                                instagramMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                            });
                                        }
                                    })
                                } else {
                                    postExecuted = postExecuted + 1;
                                    postFailure = postFailure + 1;
                                    allPostFailure = allPostFailure + 1;
                                    notifArr.push({
                                        notificationText: `Instagram Post for ${doc[0].socialMedia.screenName} post failed`,
                                        createdDate: new Date().toISOString(),
                                        status: 'unread'
                                    });

                                    igRespData.push({
                                        userId: userId,
                                        userName: doc[0].socialMedia.screenName,
                                        postStatus: 'Failure',
                                        postId: '',
                                        postDate: new Date()
                                    });
                                    if (postExecuted == postData.length) {
                                        resolve({
                                            notifArr: notifArr,
                                            postData: igRespData,
                                            instagramMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                        });
                                    }
                                }

                            }).catch((error) => {
                                console.log("error", JSON.stringify(error));
                                postExecuted = postExecuted + 1;
                                postFailure = postFailure + 1;
                                allPostFailure = allPostFailure + 1;
                                notifArr.push({
                                    notificationText: `Instagram Post for ${doc[0].socialMedia.screenName} post failed`,
                                    createdDate: new Date().toISOString(),
                                    status: 'unread'
                                });

                                igRespData.push({
                                    userId: userId,
                                    userName: doc[0].socialMedia.screenName,
                                    postStatus: 'Failure',
                                    postId: '',
                                    postDate: new Date()
                                });
                                if (postExecuted == postData.length) {
                                    resolve({
                                        postData: igRespData,
                                        notifArr: notifArr,
                                        instagramMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                                    });
                                }
                            })
                        }

                    } else {
                        postExecuted = postExecuted + 1;
                        postFailure = postFailure + 1;
                        allPostFailure = allPostFailure + 1;
                        notifArr.push({
                            notificationText: `Instagram Post failed since the Profile is not linked anymore`,
                            createdDate: new Date().toISOString(),
                            status: 'unread'
                        });

                        igRespData.push({
                            userId: userId,
                            pageId: pageId,
                            userName: '',
                            postStatus: 'Failure',
                            postId: '',
                            postDate: new Date()
                        })
                        if (postExecuted == postData.length) {
                            resolve({
                                notifArr: notifArr,
                                postData: igRespData,
                                instagramMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                            });
                        }
                    }
                });
            }
            if (postData.length === 0) {
                resolve({
                    postData: postData,
                    instagramMessage: `${postSuccess} Post Updated successfully.${postFailure} Post Update failed`
                });
            }
        });
    }

    const asyncPostYoutube = (email, ytData, socialPost, mediaData, postReq) => {
        console.log('Youtube Post called>>>');
        return new Promise(async (resolve, reject) => {
            if (ytData.length === 0) {
                resolve({
                    postData: ytData,
                    youtubeMessage: `0 videos successfull.0 videos failed`
                });
                return;
            }
            if (mediaData && mediaData[0] && mediaData[0].fileKey) {
                const oauth2Client = new google.auth.OAuth2(
                    /* client_id = '781834412445-ggdcsq1tuvsvsg99uh3pg6iqc6jqi4ug.apps.googleusercontent.com',
                    client_secrets = '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',
                    redirct_url = 'http://localhost:4200/dashboard/user/manageuseraccount',
                    grant_type = 'refresh_token' */
                    client_id = `${event.stageVariables['Google_ClientId']}`,
                    client_secrets = `${event.stageVariables['Google_ClientSecret']}`,
                    redirct_url = `${event.stageVariables['Google_redirctUrl']}`,
                    grant_type = 'refresh_token'
                );

                let postSuccess = 0;
                let postFailure = 0;
                let postExecuted = 0;
                const ytRespData = []

                const getAwsFile = async (filePath) => {
                    return new Promise(async (resolve, reject) => {
                        try {
                            let fileStream = await s3.getObject({ Bucket: bucketName, Key: filePath }).createReadStream();
                            resolve(fileStream);
                        } catch (error) {
                            reject(null)
                        }
                    });
                }
                getAwsFile(mediaData[0].fileKey).then(async (videoFile) => {
                    for (var i = 0; i < ytData.length; i++) {
                        let userId = ytData[i].userId;
                        let userName = ytData[i].name ? ytData[i].name : "";

                        let mdQuery = { 'email': { $regex: new RegExp("^" + email, "i") }, 'socialMedia.name': 'youtube', 'socialMedia.userId': userId };
                        let doc = await socialModel.findOne(mdQuery, { _id: 0, socialMedia: { $elemMatch: { name: "youtube", userId: userId } } })
                        if (doc) {

                            let refreshtoken = doc.socialMedia[0].refresh_token;
                            userName = '' ? doc.socialMedia[0].channel_name ? doc.socialMedia[0].channel_name : '' : '';

                            oauth2Client.setCredentials({
                                refresh_token: refreshtoken
                            });
                            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

                            let status = {};
                            status.license = postReq.youtubeObj.license ? postReq.youtubeObj.license : undefined;
                            status.privacyStatus = postReq.youtubeObj.privacyStatus ? postReq.youtubeObj.privacyStatus : undefined;
                            status.publicStatsViewable = postReq.youtubeObj.publicStatsViewable ? postReq.youtubeObj.publicStatsViewable : true;
                            status.madeForKids = postReq.youtubeObj.madeForKids ? postReq.youtubeObj.madeForKids : false;
                            status.selfDeclaredMadeForKids = postReq.youtubeObj.selfDeclaredMadeForKids ? postReq.youtubeObj.selfDeclaredMadeForKids : false;

                            let snippet = {};
                            snippet.title = postReq.youtubeObj.title ? postReq.youtubeObj.title : undefined;
                            snippet.description = socialPost ? socialPost : undefined;
                            snippet.tag = postReq.youtubeObj.tag ? postReq.youtubeObj.tag : undefined;
                            snippet.categoryId = postReq.youtubeObj.categoryId ? postReq.youtubeObj.categoryId : undefined;
                            snippet.defaultLanguage = postReq.youtubeObj.defaultLanguage ? postReq.youtubeObj.defaultLanguage : undefined;

                            let reqBody = {
                                resource: {
                                    snippet: snippet,
                                    status: status,
                                },
                                part: "snippet,status",
                                // Create the readable stream to upload the video
                                media: {
                                    //mimeType: 'video/*',
                                    body: videoFile
                                }
                            };

                            youtube.videos.insert(reqBody, (err, data) => {
                                console.log("err", JSON.stringify(err))
                                console.log("data", JSON.stringify(data))
                                if (data) {
                                    postExecuted = postExecuted + 1;
                                    postSuccess = postSuccess + 1;
                                    allPostSuccess = allPostSuccess + 1;
                                    // notifArr.push({
                                    //     notificationText: `youtube Post for ${doc.socialMedia[0].channel_name} posted successfully`,
                                    //     createdDate: new Date().toISOString(),
                                    //     status: 'unread'
                                    // });
                                    ytRespData.push({
                                        userId: doc.socialMedia[0].userId,
                                        userName: userName,
                                        postStatus: 'Success',
                                        postId: data.data.id,
                                        postDate: new Date()
                                    })

                                    if (postExecuted == ytData.length) {
                                        resolve({
                                            // notifArr: notifArr,
                                            postData: ytRespData,
                                            youtubeMessage: `${postSuccess} video successfull.${postFailure} video failed`
                                        });
                                    }
                                } else {

                                    postExecuted = postExecuted + 1;
                                    postSuccess = postSuccess + 1;
                                    allPostFailure = allPostFailure + 1;
                                    notifArr.push({
                                        notificationText: `youtube Post for ${doc.socialMedia[0].channel_name} video post failed`,
                                        createdDate: new Date().toISOString(),
                                        status: 'unread'
                                    });
                                    ytRespData.push({
                                        userId: doc.socialMedia[0].userId,
                                        userName: userName,
                                        postStatus: 'Failure',
                                        postId: '',
                                        postDate: new Date()
                                    })

                                    if (postExecuted == ytData.length) {
                                        resolve({
                                            notifArr: notifArr,
                                            postData: ytRespData,
                                            youtubeMessage: `${postSuccess} video successfull.${postFailure} video failed`
                                        });
                                    }
                                }
                            });

                        } else {
                            postExecuted = postExecuted + 1;
                            postFailure = postFailure + 1;
                            allPostFailure = allPostFailure + 1;
                            notifArr.push({
                                notificationText: `Youtube Post failed since the profile is not linked anymore`,
                                createdDate: new Date().toISOString(),
                                status: 'unread'
                            });

                            ytRespData.push({
                                userId: userId,
                                userName: userName,
                                userName: '',
                                postStatus: 'Failure',
                                postId: '',
                                postDate: new Date()
                            })

                            if (postExecuted == ytData.length) {
                                resolve({
                                    notifArr: notifArr,
                                    postData: ytRespData,
                                    youtubeMessage: `${postSuccess} video successfull.${postFailure} video failed`
                                });
                            }
                        }
                        //});
                    }
                }).catch(err => {
                    postExecuted = postExecuted + 1;
                    postFailure = postFailure + 1;
                    allPostFailure = allPostFailure + 1;
                    notifArr.push({
                        notificationText: `Media file not supported`,
                        createdDate: new Date().toISOString(),
                        status: 'unread'
                    });
                    ytRespData.push({
                        userId: '',
                        userName: '',
                        postStatus: 'Failure',
                        postId: '',
                        postDate: new Date()
                    })
                    if (postExecuted == ytData.length) {
                        resolve({
                            notifArr: notifArr,
                            postData: ytRespData,
                            youtubeMessage: `${postSuccess} video successfull.${postFailure} video failed`
                        });
                    }
                })
            } else {
                resolve({
                    postData: ytData,
                    youtubeMessage: `Media file not available`
                });
            }
        });
    }

    const asyncPostGMB = (email, gmbData, socialPost, mediaData, postReq) => {
        console.log('GMB Post called>>>');
        return new Promise(async (resolve, reject) => {
            /* const getAwsFile = async (filePath) => {
                return new Promise(async (resolve, reject) => {
                    try {
                        let fileStream = await s3.getObject({ Bucket: bucketName, Key: filePath }).createReadStream();
                        resolve(fileStream);
                    } catch (error) {
                        reject(null)
                    }
                });
            } */

            let postSuccess = 0;
            let postFailure = 0;
            let postExecuted = 0;
            const gmbRespData = [];
            let mediaType = postReq.mediaType;

            if (gmbData.length === 0) {
                resolve({
                    postData: gmbData,
                    gmbMessage: `${postSuccess} GMB post successfull.${postFailure} GMB post failed`
                });
                return
            }

            let locationIds = gmbData.map(location => location.locationId);
            let query = [];
            query.push({ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } })
            query.push({ $unwind: "$socialMedia" })
            query.push({ $match: { "socialMedia.name": 'googlemybusiness', 'socialMedia.locationId': { "$in": locationIds } } })
            query.push({
                $project: {
                    email: "$email", locationName: "$socialMedia.channel_name", locationId: "$socialMedia.locationId", userId: "$socialMedia.userId",
                    refresh_token: "$socialMedia.refresh_token", userProfileImage: "$socialMedia.userProfileImage"
                }
            })

            let gmbDoc = [];
            gmbDoc = await socialModel.aggregate(query);

            if (gmbDoc.length > 0) {

                const reconnectGoogle = (refreshtoken) => {
                    return new Promise(async (resolve, reject) => {
                        const requestBody = `client_secret=${googleClientSecret}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${googleClientId}&redirect_uri=${googleRedirctUrl}`;
                        //const requestBody = `client_secret=${googleClientSecret}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${googleClientId}&redirect_uri=${googleRedirctUrl}`;
                        const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                        try {
                            let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            resolve(result.data.access_token)
                        }
                        catch (error) {
                            console.log("error", JSON.stringify(error.message))
                            reject({ 'token': 'Failed' })
                        }
                    })
                };
                let request = {};

                request.summary = socialPost;
                request.topicType = postReq?.gmbObj?.topicType ?? 'STANDARD';
                if (postReq?.gmbObj && postReq?.gmbObj?.actionType && postReq?.gmbObj?.url) {
                    request.callToAction = {};
                    request.callToAction.actionType = postReq.gmbObj.actionType;
                    request.callToAction.url = postReq.gmbObj.url;
                }

                if (mediaData.length > 0) {
                    let mediaFormat = mediaType == 'image' ? "PHOTO" : "VIDEO";
                    request.media = [];
                    mediaData.forEach(mediaFile => {
                        request.media.push({
                            "mediaFormat": mediaFormat,
                            "sourceUrl": mediaFile.fileUrl
                        })
                    });
                }

                for (let i = 0; i < gmbDoc.length; i++) {
                    const gmbProfile = gmbDoc[i];

                    reconnectGoogle(gmbProfile.refresh_token).then(token => {

                        console.log("token", JSON.stringify(token))

                        let url = `https://mybusiness.googleapis.com/v4/accounts/${gmbProfile.userId}/locations/${gmbProfile.locationId}/localPosts`;

                        axios.post(url, request, { headers: { 'Authorization': 'Bearer ' + token } }).then((res) => {
                            console.log("res.data.......................", JSON.stringify(res.data))
                            postExecuted = postExecuted + 1;
                            postSuccess = postSuccess + 1;
                            allPostSuccess = allPostSuccess + 1;

                            // notifArr.push({
                            //     notificationText: `GMB Post for ${gmbProfile.locationName} posted successfully`,
                            //     createdDate: new Date().toISOString(),
                            //     status: 'unread'
                            // });

                            gmbRespData.push({
                                userId: gmbProfile.userId,
                                locationId: gmbProfile.locationId,
                                userName: gmbProfile.locationName,
                                postStatus: 'Success',
                                postId: res.data.id,
                                postDate: new Date()
                            })

                            if (postExecuted == gmbDoc.length) {
                                resolve({
                                    notifArr: notifArr,
                                    postData: gmbRespData,
                                    gmbMessage: `${postSuccess} GMB Post successfull.${postFailure} GMB Post failed`
                                });
                            }
                        }).catch((error) => {

                            postExecuted = postExecuted + 1;
                            postFailure = postFailure + 1;
                            allPostFailure = allPostFailure + 1;

                            notifArr.push({
                                notificationText: `GMB for ${gmbProfile.locationName} post failed`,
                                createdDate: new Date().toISOString(),
                                status: 'unread'
                            });

                            console.error(error);

                            gmbRespData.push({
                                userId: gmbProfile.userId,
                                locationId: gmbProfile.locationId,
                                userName: gmbProfile.locationName,
                                postStatus: 'Failure',
                                postDate: new Date()
                            })

                            if (postExecuted == gmbDoc.length) {
                                resolve({
                                    notifArr: notifArr,
                                    postData: gmbRespData,
                                    gmbMessage: `${postSuccess} GMB Post successfull.${postFailure} GMB Post failed`
                                });
                            }
                        });

                    }).catch(error => {
                        postExecuted = postExecuted + 1;
                        postFailure = postFailure + 1;
                        allPostFailure = allPostFailure + 1;

                        notifArr.push({
                            notificationText: `GMB for ${gmbProfile.locationName} post failed for token invalid`,
                            createdDate: new Date().toISOString(),
                            status: 'unread'
                        });

                        console.error(error);

                        gmbRespData.push({
                            userId: gmbProfile.userId,
                            locationId: gmbProfile.locationId,
                            userName: gmbProfile.locationName,
                            postStatus: 'Failure',
                            postDate: new Date()
                        })

                        if (postExecuted == gmbDoc.length) {
                            resolve({
                                notifArr: notifArr,
                                postData: gmbRespData,
                                gmbMessage: `${postSuccess} GMB Post successfull.${postFailure} GMB Post failed`
                            });
                        }
                    });
                }
            } else {
                resolve({
                    postData: gmbData,
                    gmbMessage: `GMB profile not available`
                });
            }
        });
    }

    const savePostData = async (email, postData) => {

        var failTweetData = [];
        var failLinkedInData = [];
        var failFbData = [];
        var failYoutubeData = [];
        var failInstagramData = [];
        var failGmbData = [];
        let successPostCount = 0;
        let responseObj = {};
        responseObj.status = `Posts sent successfully`;
        let finalPostStatus = `${allPostSuccess} Post successfull,${allPostFailure} Post failed`;
        if (allPostFailure === 0) {
            finalPostStatus = `${allPostSuccess} Post successfull.`
        }
        //responseObj.status = finalPostStatus;
        responseObj.fbpost = postData.fbpost;
        responseObj.tweetData = postData.tweetData;
        responseObj.linkedInData = postData.linkedInData;
        if (postData.youtubeData) {
            responseObj.youtubeData = postData.youtubeData;
        }
        if (postData.instagramData) {
            responseObj.instagramData = postData.instagramData;
        }
        responseObj.gmbData = postData.gmbData;
        if (postData.tweetData.length > 0) {
            failTweetData = postData.tweetData.filter(tData => {
                if (tData.postStatus == 'Failure') {
                    return tData;
                }
                if (tData.postStatus == 'Success') {
                    successPostCount += 1
                }
            })
        }
        if (postData.linkedInData.length > 0) {
            failLinkedInData = postData.linkedInData.filter(tData => {
                if (tData.postStatus == 'Failure') {
                    return tData;
                }
                if (tData.postStatus == 'Success') {
                    successPostCount += 1
                }
            })
        }
        if (postData.fbpost.length > 0) {
            failFbData = postData.fbpost.filter(tData => {
                if (tData.postStatus == 'Failure') {
                    return tData;
                }
                if (tData.postStatus == 'Success') {
                    successPostCount += 1
                }
            })
        }
        if (postData?.youtubeData?.length > 0) {
            failYoutubeData = postData.youtubeData.filter(tData => {
                if (tData.postStatus == 'Failure') {
                    return tData;
                }
                if (tData.postStatus == 'Success') {
                    successPostCount += 1
                }
            })
        }
        if (postData?.instagramData?.length > 0) {
            failInstagramData = postData.instagramData.filter(tData => {
                if (tData.postStatus == 'Failure') {
                    return tData;
                }
                if (tData.postStatus == 'Success') {
                    successPostCount += 1
                }
            })
        }
        if (postData?.gmbData?.length > 0) {
            failGmbData = postData.gmbData.filter(tData => {
                if (tData.postStatus == 'Failure') {
                    return tData;
                }
                if (tData.postStatus == 'Success') {
                    successPostCount += 1
                }
            })
        }
        if ((successPostCount > 0) && (postData.postRequest.postStatus == "Posted")) {
            userModel.updateOne({ 'email': { $regex: new RegExp("^" + email, "i") } }, { $inc: { 'features.currentPostCount': successPostCount } }).exec();
        }

        let status = ""

        let updateObj = {};
        updateObj.tweetData = failTweetData;
        updateObj.linkedInData = failLinkedInData;
        updateObj.fbpost = failFbData;
        updateObj.youtubeData = failYoutubeData;
        updateObj.instagramData = failInstagramData;
        updateObj.gmbData = failGmbData;
        updateObj.postStatus = 'Failure';
        updateObj.postData = postData.postData;
        updateObj.scheduleTime = '';
        updateObj.mediaData = postData.mediaData;
        updateObj.postTime = new Date();

        if (failTweetData.length > 0 || failLinkedInData.length > 0 || failFbData.length > 0 || failYoutubeData.length > 0 || failInstagramData.length > 0 || failGmbData.length > 0) {
            postModel.findOne({ 'userId': email }, async (err, doc) => {
                if (doc) {
                    doc.postData.push(updateObj);
                    doc.save();
                } else {
                    let post = new postModel();
                    post.userId = email;
                    post.postData = [updateObj];
                    post.save();
                }
            })
        } else {
            if (postData.mediaData && postData.mediaData.length > 0) {
                let params = {
                    Bucket: bucketName
                };
                params = { Bucket: bucketName };
                params.Delete = { Objects: [] };
                params.Delete.Objects = postData.mediaData.flatMap(tData => {
                    let splitKey = tData.fileKey.split("/")
                    if (splitKey[1] !== "clib") {
                        return { Key: tData.fileKey }
                    } else {
                        return []
                    }
                })
                if (params.Delete.Objects.length > 0) {
                    s3.deleteObjects(params, (err, data) => { })
                }
            }
        }

        if (postData.postRequest && postData.postRequest.postStatus && postData.postRequest.postStatus.trim() == "Scheduled") {

        } else if (postData.postRequest && postData.postRequest.postStatus.trim() == "Draft" && postData.postRequest._id) {
            //draftPostModel.update({ 'userId': email }, { $pull: { draftPost: { _id: new ObjectId(postData.postRequest._id) } } }).exec(function (err, doc) { });

        }

        const createNotification = (userId, notificationArray) => {
            return new Promise(async (resolve, reject) => {
                console.log("createNotification called");
                notificationModel.findOne({ 'userId': userId }, function (err, doc) {
                    if (doc) {
                        if (doc.notification) {
                            console.log("notificationArray   doc", JSON.stringify(notificationArray))
                            for (let i = 0; i < notificationArray.length; i++) {
                                if (notificationArray[i] && notificationArray[i] !== null && notificationArray[i] !== undefined) {
                                    console.log("notificationArray[i]", notificationArray[i])
                                    doc.notification.push(notificationArray[i]);
                                }
                            }
                            doc.save(function (err, doc) {
                                resolve(true);
                            });
                        } else {
                            if (notificationArray && notificationArray.length > 0) {
                                let notifyArr = notificationArray.flatMap(x => {
                                    if (x && x.status) {
                                        return x;
                                    } else {
                                        return [];
                                    }
                                })
                                console.log("notificationArray   doc else", JSON.stringify(notifyArr))
                                doc.notification = notifyArr;
                            }
                            doc.save(function (err, doc) {
                                resolve({ 'notification': 'sent' });
                            });
                        }
                    } else {
                        var notification = new notificationModel();
                        notification.userId = userId;
                        console.log("notificationArray else", JSON.stringify(notificationArray))
                        if (notificationArray && notificationArray.length > 0) {
                            let notifyArr = notificationArray.flatMap(x => {
                                if (x && x.status) {
                                    return x;
                                } else {
                                    return [];
                                }
                            })
                            console.log("notifyArr..............", JSON.stringify(notifyArr))
                            notification.notification = notifyArr;
                            notification.save(function (err, doc) {
                                resolve({ 'notification': 'sent' });
                            });
                        } else {
                            resolve({ 'notification': 'sent' });
                        }
                    }
                });
            })
        }

        const scheduleUpdate = () => {
            return new Promise(async (resolve, reject) => {
                let query = {}
                let pullQuery = {}
                if (postData.tweetData.length > 0) {
                    query = { 'scheduledPost.tweetData._id': new ObjectId(postData.postRequest.tweetData[0]._id) }
                    pullQuery = { 'scheduledPost.$.tweetData': { '_id': new ObjectId(postData.postRequest.tweetData[0]._id) } }
                } else if (postData.linkedInData.length > 0) {
                    query = { 'scheduledPost.linkedInData._id': new ObjectId(postData.postRequest.linkedInData[0]._id) }
                    pullQuery = { 'scheduledPost.$.linkedInData': { '_id': new ObjectId(postData.postRequest.linkedInData[0]._id) } }

                } else if (postData.fbpost.length > 0) {
                    query = { 'scheduledPost.fbpost._id': new ObjectId(postData.postRequest.fbpost[0]._id) }
                    pullQuery = { 'scheduledPost.$.fbpost': { '_id': new ObjectId(postData.postRequest.fbpost[0]._id) } }
                } else if (postData?.youtubeData?.length > 0) {
                    query = { 'scheduledPost.youtubeData._id': new ObjectId(postData.postRequest.youtubeData[0]._id) }
                    pullQuery = { 'scheduledPost.$.youtubeData': { '_id': new ObjectId(postData.postRequest.youtubeData[0]._id) } }
                } else if (postData?.instagramData?.length > 0) {
                    query = { 'scheduledPost.instagramData._id': new ObjectId(postData.postRequest.instagramData[0]._id) }
                    pullQuery = { 'scheduledPost.$.instagramData': { '_id': new ObjectId(postData.postRequest.instagramData[0]._id) } }
                } else if (postData?.gmbData?.length > 0) {
                    query = { 'scheduledPost.gmbData._id': new ObjectId(postData.postRequest.gmbData[0]._id) }
                    pullQuery = { 'scheduledPost.$.gmbData': { '_id': new ObjectId(postData.postRequest.gmbData[0]._id) } }
                }
                if (postData.postRequest.socialId || postData.postRequest._id) {
                    let scheduleId = postData.postRequest.socialId ? postData.postRequest.socialId : postData.postRequest._id;
                    console.log("scheduleId", scheduleId)
                    query = { 'userId': email };
                    pullQuery = { scheduledPost: { _id: new ObjectId(scheduleId) } };
                }
                scheduledPostModel.update(query, { $pull: pullQuery }).exec(async (err, scheduleUpdate) => {
                    // if (scheduleUpdate.nModified == 1) {
                    //     await userModel.updateOne({ 'email': { $regex: new RegExp("^" + email, "i") } }, { $inc: { 'features.currentSchedulePostCount': -1 } }).exec();
                    // }
                    //done('200', responseObj);
                    resolve(true);
                });
            })
        }
        const draftUpdate = () => {
            return new Promise(async (resolve, reject) => {
                draftPostModel.findOneAndUpdate({ 'userId': email }, { $pull: { draftPost: { _id: new ObjectId(postData.postRequest._id) } } }).exec(function (err, doc) {
                    draftPostModel.aggregate([{ $match: { 'userId': email } }, { $unwind: "$draftPost" }, {
                        $project: {
                            '_id': '$draftPost._id',
                            postStatus: '$draftPost.postStatus',
                            createdTime: '$draftPost.createdTime',
                            postData: '$draftPost.postData',
                            scheduleTime: '$draftPost.scheduleTime',
                            mediaData: '$draftPost.mediaData',
                            twitterCount: { $cond: { if: { $isArray: "$draftPost.tweetData" }, then: { $size: "$draftPost.tweetData" }, else: 0 } },
                            facebookCount: { $cond: { if: { $isArray: "$draftPost.fbpost" }, then: { $size: "$draftPost.fbpost" }, else: 0 } },
                            linkedinCount: { $cond: { if: { $isArray: "$draftPost.linkedInData" }, then: { $size: "$draftPost.linkedInData" }, else: 0 } },
                            youtubeCount: { $cond: { if: { $isArray: "$draftPost.youtubeData" }, then: { $size: "$draftPost.youtubeData" }, else: 0 } },
                            instagramCount: { $cond: { if: { $isArray: "$draftPost.instagramData" }, then: { $size: "$draftPost.instagramData" }, else: 0 } },
                            gmbCount: { $cond: { if: { $isArray: "$draftPost.gmbData" }, then: { $size: "$draftPost.gmbData" }, else: 0 } }
                        }
                    }]).exec(function (err, docs) {
                        let draftCount = 0
                        if (docs.length > 0) {
                            docs.forEach(draftPost => {
                                draftCount = draftPost.twitterCount + draftPost.facebookCount + draftPost.linkedinCount + draftPost.youtubeCount + draftPost.instagramCount + draftPost.gmbCount;
                            })
                        }
                        userModel.updateOne({ 'email': { $regex: new RegExp("^" + email, "i") } }, { $set: { 'features.currentDraftPostCount': draftCount } }).exec((err, result) => {
                            // done('200', responseObj);
                            resolve(true)
                        });
                    });
                });
            })
        }


        let promiseArr = [];

        if (postData.postRequest && postData.postRequest.postStatus && postData.postRequest.postStatus.trim() == "Scheduled") {
            promiseArr.push(scheduleUpdate());
        }

        if (postData.postRequest && postData.postRequest.postStatus.trim() == "Draft" && postData.postRequest._id) {
            promiseArr.push(draftUpdate());
        }

        if (notifArr.length > 0) {
            promiseArr.push(createNotification(email, notifArr));
        }

        await Promise.all(promiseArr).then(reuslt => {
            done('200', responseObj);
        }).catch(err => {
            console.log("err.......savePostresolve..........", JSON.stringify(err))
            done('200', responseObj);
        })
    }

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
    const CONSUMERKEY = event.stageVariables['Twitter_ConsumerKey'];
    const CONSUMERSECRET = event.stageVariables['Twitter_ConsumerSecret'];
    const googleClientId = event.stageVariables['Google_ClientId'];
    const googleClientSecret = event.stageVariables['Google_ClientSecret'];
    const googleRedirctUrl = event.stageVariables['Manage_ProfilePage'];
    const bucketName = `${event.stageVariables['s3_bucket_name']}`
    aws.config.update({ region: event.stageVariables['aws_region'] })


    // var connectorMongodb = mongoose.connect('mongodb+srv://storefries:CH8U1ZXGyeILqFWy@storefries.76ocf.mongodb.net/SocialMediaPublisher?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
    // const CONSUMERKEY = 'eLD1dQVA2Sz4rN166vyJnF8m8';
    // const CONSUMERSECRET = 'qtO5wIc479drT3YqmiNYzRSTsc6hrpVR7paj8ZgMAAoDdSW50H';
    // const googleClientId = '781834412445-ggdcsq1tuvsvsg99uh3pg6iqc6jqi4ug.apps.googleusercontent.com';
    // const googleClientSecret = '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';
    // const googleRedirctUrl = 'https://test.storefries.com/dashboard/connect/new/gmb';
    // const bucketName = 'aikyne-mediafiles';
    // aws.config.update({ region: 'ap-south-1' });

    // Set the region 
    //set s3 bucket
    const s3 = new aws.S3()



    async function validation(request) {
        try {
            const schema = Joi.object({
                title: Joi.string().required(),
                tag: Joi.array().optional(),
                categoryId: Joi.string().optional(),
                defaultLanguage: Joi.string().optional(),
                privacyStatus: Joi.string().valid('public', 'private', 'unlisted').required(),
                publicStatsViewable: Joi.boolean().valid(true, false).optional(),
                madeForKids: Joi.boolean().valid(true, false).optional(),
                selfDeclaredMadeForKids: Joi.boolean().valid(true, false).optional(),
                embeddable: Joi.boolean().valid(true, false).optional(),
                license: Joi.string().valid('creativeCommon', 'youtube').optional()
            });
            const value = await schema.validateAsync(request);
        } catch (err) {
            if (err.details && err.details[0] && err.details[0].message) {
                done('200', {
                    status: false,
                    message: err.details[0].message.replace(/\r?\"|\r/g, "")
                });
            } else {
                done('200', {
                    status: false,
                    err: err
                });
            }
            return;
        }
    }

    switch (event.httpMethod) {
        case 'POST':
            console.log('POST Now Called')
            var body = JSON.parse(event.body);

            context.callbackWaitsForEmptyEventLoop = false;
            if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
                event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
                if (email && email !== '') {

                    let postData = body.postData;
                    connectorMongodb.then(async () => {
                        let subscriptionData = await subscriptionModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } });
                        if (subscriptionData && subscriptionData.status == 'cancelled') {
                            done('200', {
                                message: `Your Subscription has been cancelled, Please active your Subscription`,
                                status: false,
                                data: {}
                            });
                            return;
                        }
                        let users = await userModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } });
                        if (users) {

                            postData.youtubeData = postData?.youtubeData?.length ? postData.youtubeData : [];
                            postData.instagramData = postData?.instagramData?.length ? postData.instagramData : [];
                            postData.gmbData = postData?.gmbData?.length ? postData.gmbData : [];

                            let sociallength = postData.tweetData.length + postData.fbpost.length + postData.linkedInData.length + postData.youtubeData.length + postData.instagramData.length + postData.gmbData.length;

                            console.log("postData", JSON.stringify(postData))
                            if (sociallength <= 0) {
                                done('422', {
                                    message: "Atleast one social media need to be selected."
                                });
                                return;
                            }

                            if (((users.features.currentPostCount + sociallength) <= users.features.totalPostCount && users.features.totalPostCount != null) || users.features.totalPostCount == null) {
                                if (postData.fbTarget) {
                                    if ((!postData.fbTarget.geo_locations) ||
                                        (postData.fbTarget.geo_locations && !postData.fbTarget.geo_locations.countries) ||
                                        (postData.fbTarget.geo_locations && postData.fbTarget.geo_locations.countries && postData.fbTarget.geo_locations.countries.length < 1)) {
                                        done('422', {
                                            message: "Targeting country is required."
                                        });
                                        return;
                                    }
                                }
                                if (postData?.youtubeData?.length > 0) {
                                    if (postData.mediaData.length < 1) {
                                        done('422', {
                                            message: "Video File required."
                                        });
                                        return;
                                    }
                                    validation(postData.youtubeObj);
                                }

                                const promiseArray = [];
                                promiseArray.push(asyncPostTwitter(email, postData.tweetData, postData.postData, postData.mediaData, postData));
                                promiseArray.push(asyncPostFacebook(email, postData.fbpost, encodeURI(postData.postData), postData.mediaData, postData));
                                promiseArray.push(asyncPostLinkedIn(email, postData.linkedInData, postData.postData, postData.mediaData, postData));
                                promiseArray.push(asyncPostYoutube(email, postData.youtubeData, postData.postData, postData.mediaData, postData));
                                promiseArray.push(asyncPostInstagram(email, postData.instagramData, encodeURI(postData.postData), postData.mediaData, postData));
                                promiseArray.push(asyncPostGMB(email, postData.gmbData, postData.postData, postData.mediaData, postData));

                                Promise.all(promiseArray).then(resArr => {
                                    //console.log("...resArr....", JSON.stringify(resArr))
                                    /* let notificationArray = [];
                                    resArr.forEach(resp => {
                                        if (resp.notifArr?.[0]) {
                                            notificationArray = [...notificationArray, ...resp.notifArr];                                            
                                        }
                                    });
                                    console.log(".......notificationArray......",JSON.stringify(notificationArray)) */
                                    let finalData = {};
                                    finalData.tweetData = resArr[0].postData;
                                    finalData.fbpost = resArr[1].postData;
                                    finalData.linkedInData = resArr[2].postData;
                                    finalData.youtubeData = resArr[3].postData;
                                    finalData.instagramData = resArr[4].postData;
                                    finalData.gmbData = resArr[5].postData;
                                    finalData.postData = postData.postData;
                                    finalData.postRequest = postData;
                                    finalData.mediaData = postData.mediaData;
                                    savePostData(email, finalData);
                                })

                            } else {
                                var remainpost = users.features.totalPostCount - users.features.currentPostCount;
                                if (remainpost > 0) {
                                    done('405', {
                                        message: `You have remaining ${remainpost} post Only, If you need more Please upgrade your plan`
                                    });
                                } else {
                                    done('405', {
                                        message: `You can post ${users.features.totalPostCount} post Only, If you want to add more Please upgrade your plan`
                                    });
                                }
                            }
                        }
                    },
                        (err) => { console.log('Connection Error'); });
                }

            } else {
                done('403', {
                    status: "Unauthorized"
                });
            }

            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
