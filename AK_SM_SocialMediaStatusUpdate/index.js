var mongoose = require('mongoose');
var axios = require('axios');
var AuthHelper = require('./AuthHelper.js');
var socialModel = require('./SocialModel.js');
var async = require('async');
let Twit = require("twit");

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

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
    // const client_id = '974606527895-and2oc6u02n7q84g0ut2pu6letqb05eb.apps.googleusercontent.com';
    // const client_secrets = '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';
    var youtubeClientId = event.stageVariables['Google_ClientId'];
    var youtubeClientSecret = event.stageVariables['Google_ClientSecret']

    /* var connectorMongodb = mongoose.connect('mongodb+srv://storefries:CH8U1ZXGyeILqFWy@storefries.76ocf.mongodb.net/SocialMediaPublisher', { useNewUrlParser: true, useUnifiedTopology: true });
    const CONSUMERKEY = 'eLD1dQVA2Sz4rN166vyJnF8m8';
    const CONSUMERSECRET = 'qtO5wIc479drT3YqmiNYzRSTsc6hrpVR7paj8ZgMAAoDdSW50H';
    const twitter_token = 'AAAAAAAAAAAAAAAAAAAAABJRMAEAAAAAZCgIiNjUIBEmshoYJVkZsYV6Nc0%3DJtWFMmKy7Bz0CqFZI0xU9reKrJqYuHzpxW0fNgf9ptWDEskYRH';

    const client_id = '781834412445-ggdcsq1tuvsvsg99uh3pg6iqc6jqi4ug.apps.googleusercontent.com';
    const client_secrets = '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'; */

    const updateTwitterStatus = (socialDoc, reqObj) => {
        console.log('Twitter Post called>>>');

        let T = new Twit({
            consumer_key: event.stageVariables['Twitter_ConsumerKey'],
            consumer_secret: event.stageVariables['Twitter_ConsumerSecret'],
            access_token: socialDoc.socialMedia[0].oauth_token,
            access_token_secret: socialDoc.socialMedia[0].oauth_token_secret,
        });

        let url = ''

        let postAction = async (url) => {
            console.log("postAction");
            T.post(url, { id: reqObj.postId }, function (err, data) {
                if (err) {
                    done(err.statusCode, {
                        message: err.message
                    });
                } else {
                    console.log("else");
                    let request = {
                        url: 'https://api.twitter.com/2/tweets?ids=' + reqObj.postId + '&expansions=attachments.poll_ids&tweet.fields=attachments,conversation_id,created_at,public_metrics,in_reply_to_user_id,source',
                        method: 'GET',
                        body: {}
                    }
                    let authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia[0].oauth_token, socialDoc.socialMedia[0].oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
                    //let authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia[0].oauth_token, socialDoc.socialMedia[0].oauth_token_secret, CONSUMERKEY, CONSUMERSECRET);
                    axios.get(request.url, { headers: authHeader }).then((resp) => {

                        let postInfo = {};
                        let tweetText = data.text;
                        postInfo.mediaUrl = []
                        postInfo.userId = reqObj.userId
                        postInfo.postStatus = "Success";
                        postInfo.postId = reqObj.postId;
                        postInfo.mediaType = "text";
                        postInfo.thumbnail = '';
                        postInfo.postDate = data.created_at;
                        postInfo.in_reply_to_user_id_str = data.in_reply_to_user_id_str || "";
                        postInfo.in_reply_to_status_id_str = data.in_reply_to_status_id_str || "";
                        if (resp.data && resp.data.data[0] && resp.data.data[0].source) {
                            postInfo.source = resp.data.data[0].source;
                        }
                        if (data.text.includes('https://t.co')) {
                            var textIndex = data.text.lastIndexOf(" ");
                            tweetText = data.text.substring(0, textIndex)
                        }
                        postInfo.mediaUrl = []
                        if (data.extended_entities && data.extended_entities.media && data.extended_entities.media.length > 0) {
                            //postInfo.mediaUrl = data.extended_entities.media.map(mediaImg => { return mediaImg.media_url })
                            //postInfo['mediaType'] = data.extended_entities.media[0].type;

                            if (data.extended_entities.media[0]?.video_info?.variants[0]?.content_type == "video/mp4") {
                                postInfo['mediaType'] = "video";
                                postInfo["mediaUrl"] = [data.extended_entities.media[0].video_info.variants[0].url];
                                postInfo["thumbnail"] = data.extended_entities.media[0].media_url
                            } else if (data.extended_entities.media?.video_info?.variants[1]?.content_type == "video/mp4") {
                                postInfo['mediaType'] = "video";
                                postInfo["mediaUrl"] = [data.extended_entities.media[0].video_info.variants[1].url]
                                postInfo["thumbnail"] = data.extended_entities.media[0].media_url;
                            }

                            if (data.extended_entities.media[0].type == 'photo') {
                                postInfo['mediaType'] = 'images'
                                postInfo["mediaUrl"] = [data.extended_entities.media[0].media_url]
                                //tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url;
                            }
                        }
                        postInfo.linkObj = []
                        if (data.entities.urls && data.entities.urls.length > 0) {
                            postInfo.mediaType = "link";
                            postInfo.linkObj = data.entities.urls.map(urlsData => {
                                delete urlsData["indices"];
                                return urlsData
                            })
                        }


                        let retweetStatus = false;
                        if (tweetText.includes(":")) {
                            let splitText = tweetText.split(":");
                            if (splitText[0] && splitText[0].includes('RT')) {
                                tweetText = tweetText.split(/:(.+)/)[1].trim()
                                retweetStatus = true
                            }
                        }
                        let public_metrics = {}
                        public_metrics.retweet_count = resp.data.data[0].public_metrics.retweet_count
                        public_metrics.reply_count = resp.data.data[0].public_metrics.reply_count
                        public_metrics.quote_count = resp.data.data[0].public_metrics.quote_count
                        public_metrics.like_count = resp.data.data[0].public_metrics.like_count;
                        //public_metrics.like_count = data.favorite_count;
                        /* if (data.retweeted_status && data.retweeted_status.favorite_count) {
                            public_metrics.like_count = data.retweeted_status.favorite_count;
                        } */

                        done('200', {
                            status: "Tweet Retrieved",
                            //data: data,
                            data: {
                                postStatus: "Posted",
                                postData: tweetText,
                                postInfo: postInfo,
                                public_metrics: public_metrics,
                                "favorited": data.favorited,
                                "retweeted": retweetStatus,
                                conversations: { "meta": { "result_count": 0 } }
                            }
                        });
                    }).catch(err => {
                        done("400", {
                            message: "Tweet action not completed"
                        });
                    })
                }
            });
        }

        switch (reqObj.action) {
            case 'like':
                url = "favorites/create";
                console.log("like");
                postAction(url)
                break;
            case 'unlike':
                console.log("unlike");
                url = "favorites/destroy";
                postAction(url)
                break;
            case 'retweet':
                console.log("retweet");
                url = "statuses/retweet";
                postAction(url)
                break;
            case 'unretweet':
                console.log("unretweet");
                url = "statuses/unretweet";
                postAction(url)
                break;
            default:
                break;
        }

    }
    const updateLinkedinStatus = async (socialDoc, reqObj) => {

        let postAction = async () => {

            try {
                //let shareData = await axios.get('https://api.linkedin.com/v2/shares/' + reqObj.postId, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                //let socialActionData = await axios.get('https://api.linkedin.com/v2/socialActions/' + reqObj.postId, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                let shareData = async () => {
                    return new Promise(async (resolve, reject) => {

                        //axios.get('https://api.linkedin.com/v2/ugcPosts/' + reqObj.postId, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } }).then((resp) => {
                        let url = 'https://api.linkedin.com/v2/ugcPosts/' + reqObj.postId + '?viewContext=AUTHOR&projection=(name,localizedName,author,id,created,specificContent(com.linkedin.ugc.ShareContent(shareMediaCategory,shareCommentary,media(*(media~:playableStreams,originalUrl,thumbnails,description,title)))))';
                        console.log("url......", url)
                        axios.get(url, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } }).then((resp) => {
                            console.log("shareData", JSON.stringify(resp.data))
                            if (resp.data) {
                                resolve({ shareData: resp.data })
                            } else {
                                resolve({ shareData: {} })
                            }
                        }).catch(err => {
                            resolve({ shareData: {} })
                        })
                    })
                }
                let socialActionData = async () => {
                    return new Promise(async (resolve, reject) => {
                        axios.get('https://api.linkedin.com/v2/socialActions/' + reqObj.postId, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } }).then((resp) => {
                            console.log("socialActionData", JSON.stringify(resp.data))
                            if (resp.data) {
                                resolve({ socialActionData: resp.data })
                            } else {
                                resolve({ socialActionData: {} })
                            }
                        }).catch(err => {
                            resolve({ socialActionData: {} })
                        })
                    })
                }

                let linkedinComments = async () => {
                    return new Promise(async (resolve, reject) => {
                        let responseArr = []
                        //let commentsData = await axios.get("https://api.linkedin.com/v2/socialActions/" + reqObj.postId + "/comments", { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                        let commentsData = await axios.get("https://api.linkedin.com/v2/socialActions/" + reqObj.postId + "/comments?projection=(elements(*(*,actor~(*,profilePicture(displayImage~digitalmediaAsset:playableStreams,logoV2(original~digitalmediaAsset:playableStreams))))))", { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                        console.log("linkedinComments", JSON.stringify(commentsData.data.elements))
                        if (commentsData.data && commentsData.data.elements && commentsData.data.elements.length > 0) {
                            for await (const comData of commentsData.data.elements) {
                                console.log("comData", JSON.stringify(comData));
                                let resObj = {}
                                resObj.replied = {}
                                resObj.postDate = comData.created.time;
                                resObj.message = comData.message.text;
                                resObj.commentUrn = comData.$URN;
                                resObj.commentId = comData.id;
                                resObj.pageId = reqObj.userId;
                                resObj.activity = comData.object;
                                resObj.like_count = 0;
                                resObj.reply_count = 0;
                                resObj.replied.name = comData['actor~'].vanityName;
                                resObj.likedByCurrentUser = false
                                resObj["mediaUrl"] = "";
                                if (comData && comData['actor~'] && comData['actor~'].profilePicture && comData['actor~'].profilePicture['displayImage~'] && comData['actor~'].profilePicture['displayImage~'].elements &&
                                    comData['actor~'].profilePicture['displayImage~'].elements.length > 0 && comData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier) {
                                    resObj.replied.profileImage = comData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier
                                }
                                if (comData && comData.actor) {
                                    resObj.replied.Id = comData.actor;
                                }
                                if (comData['actor~'].vanityName.includes("-")) {
                                    var textIndex = comData['actor~'].vanityName.lastIndexOf("-");
                                    resObj.replied.name = comData['actor~'].vanityName.substring(0, textIndex);
                                }
                                if (comData.content && comData.content[0]) {
                                    if (comData.content[0].type == 'IMAGE') {
                                        resObj["mediaUrl"] = comData.content[0].url;
                                    }
                                }
                                if (comData.likesSummary && comData.likesSummary.aggregatedTotalLikes) {
                                    resObj.like_count = comData.likesSummary.aggregatedTotalLikes;
                                }
                                if (comData.likesSummary && comData.likesSummary.selectedLikes && comData.likesSummary.selectedLikes.length > 0) {
                                    comData.likesSummary.selectedLikes.map(likeData => {
                                        var companyId = comData.actor.split(':').pop()
                                        console.log("companyId", companyId);
                                        if (likeData.includes(companyId)) {
                                            resObj.likedByCurrentUser = true;
                                            return
                                        }
                                    })
                                }
                                if (comData.commentsSummary && comData.commentsSummary.aggregatedTotalComments) {
                                    resObj.reply_count = comData.commentsSummary.aggregatedTotalComments;
                                }
                                let commThread = []
                                let commentsThread = await axios.get("https://api.linkedin.com/v2/socialActions/" + comData.$URN + "/comments", { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })

                                if (commentsThread.data && commentsThread.data.elements && commentsThread.data.elements.length > 0) {
                                    commentsThread.data.elements.forEach(threadData => {
                                        let threadObj = {}
                                        threadObj.replied = {}
                                        console.log("threadData", JSON.stringify(threadData));
                                        threadObj.postDate = threadData.created.time;
                                        threadObj.message = threadData.message.text;
                                        threadObj.commentUrn = threadData.$URN;
                                        threadObj.commentId = threadData.id;
                                        threadObj.activity = threadData.object;
                                        threadObj.pageId = reqObj.userId;
                                        threadObj.like_count = 0;
                                        threadObj.reply_count = 0;
                                        threadObj.likedByCurrentUser = false;
                                        threadObj["mediaUrl"] = "";
                                        if (threadData && threadData['actor~'] && threadData['actor~'].profilePicture && threadData['actor~'].profilePicture['displayImage~'] && threadData['actor~'].profilePicture['displayImage~'].elements &&
                                            threadData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0]?.identifier) {
                                            threadObj.replied.profileImage = threadData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier;
                                        }
                                        if (threadData.actor) {
                                            threadObj.replied.Id = threadData.actor;
                                        }

                                        threadObj.replied.name = threadData['actor~'].vanityName;
                                        if (threadData['actor~'].vanityName.includes("-")) {
                                            var textIndex = threadData['actor~'].vanityName.lastIndexOf("-");
                                            threadObj.replied.name = threadData['actor~'].vanityName.substring(0, textIndex);
                                        }
                                        if (threadData.content && threadData.content[0]) {
                                            if (threadData.content[0].type == 'IMAGE') {
                                                threadObj["mediaUrl"] = threadData.content[0].url;
                                            }
                                        }
                                        if (threadData.likesSummary && threadData.likesSummary.aggregatedTotalLikes) {
                                            threadObj.like_count = threadData.likesSummary.aggregatedTotalLikes;
                                        }
                                        if (threadData.likesSummary && threadData.likesSummary.selectedLikes && threadData.likesSummary.selectedLikes.length > 0) {
                                            threadData.likesSummary.selectedLikes.map(likeData => {
                                                var companyId = threadData.actor.split(':').pop()
                                                console.log("companyId", companyId);
                                                if (likeData.includes(companyId)) {
                                                    threadObj.likedByCurrentUser = true;
                                                    return
                                                }
                                            })
                                        }
                                        if (threadData.commentsSummary && threadData.commentsSummary.aggregatedTotalComments) {
                                            threadObj.reply_count = threadData.commentsSummary.aggregatedTotalComments;
                                        }
                                        commThread.push(threadObj)
                                    });
                                    resObj.commentsThread = commThread;
                                }
                                responseArr.push(resObj)
                            }
                        }

                        resolve({ comments: responseArr })
                    })

                    /* console.log("responseArr", responseArr.length);
                    done('200', {
                        status: "Comment details retrieved succussfully",
                        data: responseArr
                    }); */
                }

                //let merged = { ...shareData.data, ...socialActionData.data }

                let promiseArray = [];

                promiseArray.push(shareData());
                promiseArray.push(socialActionData());
                promiseArray.push(linkedinComments());

                Promise.all(promiseArray).then(resArr => {



                    let postInfo = {};
                    postInfo.mediaUrl = []
                    postInfo.userId = reqObj.userId;
                    postInfo.postStatus = "Success";
                    postInfo.postId = reqObj.postId;
                    postInfo.mediaType = "text";
                    postInfo["linkObj"] = [];
                    postInfo.thumbnail = '';
                    let postData = "";
                    let likedByCurrentUser = false;

                    let comments = []
                    let public_metrics = {}

                    resArr.forEach(finalRes => {
                        if (finalRes.shareData) {
                            postData = decodeURI(finalRes.shareData?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary.text);
                            postInfo.postDate = finalRes.shareData.created.time;
                            postInfo.activity = finalRes.shareData.activity;
                            postInfo.pageId = finalRes.shareData.owner;

                            /*  if (finalRes.shareData.content && finalRes.shareData.content.contentEntities && finalRes.shareData.content.contentEntities.length > 0) {
 
 
                                 if (finalRes.shareData.content.shareMediaCategory == 'ARTICLE') {
                                     postInfo.mediaType = 'link';
                                     postInfo.thumbnail
                                     postInfo["mediaUrl"] = finalRes.shareData.content.contentEntities.map(mediaData => {
                                         return mediaData.entityLocation
                                     })
                                 }
                             }
                             console.log("finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory",finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory)
                             if (finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'IMAGE' || finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'RICH') {
                                 postInfo.mediaType = 'image';
                                 postInfo["mediaUrl"] = finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent'].media.map(mediaData => {
                                     return mediaData.originalUrl
                                 })
                             }
                             if (finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'VIDEO') {
                                 console.log("finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements", finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements)
                                 finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements?.map(video => {
                                     if (video?.identifiers[0]?.mediaType == 'video/mp4') {
                                         if (video?.identifiers[0]?.identifier?.includes('-720p')) {
                                             postInfo.mediaType = 'video';
                                             postInfo.thumbnail = "https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/S3-Media/videoThumbnail.png";
                                             postInfo["mediaUrl"] = [video?.identifiers[0]?.identifier];
                                         }
                                     }
                                 });
                             } */

                            if (finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory.length > 0) {
                                if (finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'ARTICLE') {
                                    postInfo.mediaType = 'link';
                                    finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.media.map(mediaData => {
                                        let linkObject = {};
                                        linkObject.description = mediaData.description.text;
                                        if (mediaData.thumbnails && mediaData.thumbnails[0] && mediaData.thumbnails[0].url) {
                                            linkObject.imageUrl = mediaData.thumbnails[0].url;
                                        }
                                        linkObject.title = mediaData.title.text;
                                        linkObject.targetUrl = mediaData.originalUrl;
                                        postInfo["linkObj"].push(linkObject)
                                        return mediaData.entityLocation
                                    })
                                }
                                if (finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'IMAGE' || finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'RICH') {
                                    postInfo.mediaType = 'image';
                                    postInfo["mediaUrl"] = finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent'].media.map(mediaData => {
                                        return mediaData.originalUrl
                                    })
                                }
                                if (finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'VIDEO') {
                                    console.log("finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements", finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements)
                                    finalRes.shareData.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements?.map(video => {
                                        if (video?.identifiers[0]?.mediaType == 'video/mp4') {
                                            if (video?.identifiers[0]?.identifier?.includes('-720p')) {
                                                postInfo.mediaType = 'video';
                                                postInfo.thumbnail = "https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/S3-Media/videoThumbnail.png";
                                                postInfo["mediaUrl"] = [video?.identifiers[0]?.identifier];
                                            }
                                        }
                                    });
                                }
                            }
                        }

                        if (finalRes.socialActionData) {
                            public_metrics.like_count = finalRes.socialActionData.likesSummary.totalLikes || 0;
                            public_metrics.reply_count = finalRes.socialActionData.commentsSummary.aggregatedTotalComments || 0;
                            likedByCurrentUser = finalRes.socialActionData.likesSummary.likedByCurrentUser;
                        }

                        if (finalRes.comments) {
                            comments = finalRes.comments;
                        }

                    });


                    done('200', {
                        status: "LinkedIn Post Retrieved",
                        data: {
                            postStatus: "Posted",
                            postData: postData,
                            postInfo: postInfo,
                            public_metrics: public_metrics,
                            "likedByCurrentUser": likedByCurrentUser,
                            //linkedinData: merged,
                            conversations: comments
                        }
                    });

                    /* done('200', {
                        data: resArr
                    }) */
                })

            } catch (error) {
                console.log("err")
                done('401', {
                    status: "LinkedIn data retrive failed",
                    message: error.message
                });
            }
        }

        try {
            switch (reqObj.action) {
                case 'like':
                    console.log("like")
                    let request = {}
                    request.body = {
                        "actor": "urn:li:person:" + reqObj.userId,
                        "object": reqObj.postId
                    }
                    let urn = reqObj.postId
                    if (body.commentUrn) {
                        urn = body.commentUrn;
                    }
                    console.log("urn", JSON.stringify(urn));
                    console.log("request.body", JSON.stringify(request.body));
                    let likeResp = await axios.post("https://api.linkedin.com/v2/socialActions/" + urn + "/likes",
                        //let likeResp = await axios.post("https://api.linkedin.com/v2/ugcPosts/" + urn + "/likes",
                        request.body, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                    console.log("likeResp", likeResp)
                    postAction()
                    break;
                case 'unlike':
                    let commentUrn = reqObj.postId
                    if (body.commentUrn) {
                        commentUrn = body.commentUrn;
                    }
                    let unlikeResp = await axios.delete("https://api.linkedin.com/v2/socialActions/" + commentUrn + "/likes/urn:li:person:" + reqObj.userId + "?actor=urn:li:person:" + reqObj.userId,
                        { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                    postAction()
                    break;
                case 'comment':
                    if (!body.message) {
                        done('400', {
                            status: 'message is required',
                            data: body
                        });
                    }
                    let reqBody = {}
                    reqBody["actor"] = "urn:li:person:" + reqObj.userId;
                    reqBody["object"] = reqObj.postId;
                    reqBody["message"] = {}
                    reqBody.message["text"] = body.message

                    if (body.imageUrl) {
                        reqBody.content = [
                            {
                                "entity": {
                                    "digitalmediaAsset": body.imageUrl
                                },
                                "type": "IMAGE"
                            }
                        ]
                    }
                    let url = "https://api.linkedin.com/v2/socialActions/" + reqObj.postId + "/comments";
                    if (body.commentUrn) {
                        reqBody.parentComment = body.commentUrn;
                        //url = "https://api.linkedin.com/v2/socialActions/urn:li:comment:("+reqObj.postId,body.commentId+")/comments";
                        url = "https://api.linkedin.com/v2/socialActions/" + body.commentUrn + "/comments";
                    }
                    let commentResp = await axios.post(url, reqBody, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                    postAction()
                    break;
                case 'deletecomment':
                    if (!body.commentId) {
                        done('400', {
                            status: 'Comment Id is required',
                            data: body
                        });
                    }
                    if (body.pageId) {
                        let deleteCommentResp = await axios.delete("https://api.linkedin.com/v2/socialActions/" + reqObj.postId + "/comments/" + body.commentId + "?actor=" + body.pageId,
                            { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                    } else {
                        let deleteCommentRespo = await axios.delete("https://api.linkedin.com/v2/socialActions/" + reqObj.postId + "/comments/" + body.commentId,
                            { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                    }
                    postAction()
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.log("err2")
            console.log("error......linkedin........", JSON.stringify(error))
            done('404', {
                status: "LinkedIn data retrive failed",
                message: error.message
            });
        }
    }

    const updateFacebookStatus = async (socialDoc, reqObj) => {
        let url = "";

        if (socialDoc.type == 'group') {
            done('404', {
                status: "This service available only page post."
            })
            return;
        }

        let postAction = async () => {
            try {
                let addQueryParams = "";
                if (socialDoc.type == "page") {
                    addQueryParams = ",likes.summary(true)"
                }

                let url = 'https://graph.facebook.com/v12.0/' + reqObj.postId + '?access_token=' + socialDoc.pageToken + `&fields=message,targeting,created_time,comments{id,name,like_count,comment_count,attachment,from{name,id,picture},created_time,comments{id,name,like_count,comment_count,attachment,from{name,id,picture},created_time,message},to{id},message},attachments,from,to,parent_id,story,place,actions${addQueryParams}`

                //let url = 'https://graph.facebook.com/' + reqObj.postId + '?access_token=' + socialDoc.pageToken + '&fields=message,likes.summary(true),created_time,comments,attachments,from,parent_id,story,place,actions'

                console.log("url", JSON.stringify(url))
                axios.get(url).then((convRes) => {

                    console.log("convRes.data", JSON.stringify(convRes.data))

                    let postInfo = {};
                    let fbText = convRes.data.message || "";
                    let conversations = {};
                    postInfo.mediaUrl = []
                    postInfo.linkObj = [];
                    postInfo.userId = reqObj.userId;
                    postInfo['mediaType'] = "text";
                    postInfo.postStatus = "Success";
                    postInfo.postId = reqObj.postId;
                    postInfo.postDate = convRes.data.created_time;
                    if (convRes.data.from && convRes.data.from.id) {
                        postInfo['pageId'] = convRes.data.from.id;
                    } else {
                        postInfo['pageId'] = socialDoc.pageId;
                    }
                    if (convRes.data.from && convRes.data.from.name) {
                        postInfo['pageName'] = convRes.data.from.name;
                    }
                    if (convRes.data.story) {
                        postInfo['story'] = convRes.data.story;
                    }
                    postInfo.geo_location = {};
                    postInfo.place = {};
                    if (convRes.data.place) {
                        if (convRes.data.place.name) {
                            postInfo.place.name = convRes.data.place.name;
                        }
                        if (convRes.data.place.location && convRes.data.place.location.country) {
                            postInfo.place.country = convRes.data.place.location.country;
                        }
                        if (convRes.data.place.location && convRes.data.place.location.city) {
                            postInfo.place.city = convRes.data.place.location.city;
                        }
                        if (convRes.data.place.location && convRes.data.place.location.street) {
                            postInfo.place.street = convRes.data.place.location.street;
                        }
                        if (convRes.data.place.location && convRes.data.place.location.latitude && convRes.data.place.location.longitude) {
                            postInfo.geo_location.lng = convRes.data.place.location.latitude;
                            postInfo.geo_location.lat = convRes.data.place.location.longitude;
                        }
                    }

                    /* 
                        if (convRes.data.attachments && convRes.data.attachments.data && convRes.data.attachments.data[0]
                            && convRes.data.attachments.data[0].subattachments && convRes.data.attachments.data[0].subattachments.data && convRes.data.attachments.data[0].subattachments.data.length > 0) {
                            postInfo["mediaUrl"] = convRes.data.attachments.data[0].subattachments.data.flatMap(mediaData => {
                                if (mediaData.media && mediaData.media.image && mediaData.media.image.src && mediaData.type == "photo") {
                                    return mediaData.media.image.src
                                } else {
                                    return []
                                }
                            })
                        } else if (convRes.data.attachments && convRes.data.attachments.data && convRes.data.attachments.data[0] && !convRes.data.attachments.data[0].subattachments) {
                            postInfo["mediaUrl"] = convRes.data.attachments.data.flatMap(mediaData => {
                                if (mediaData.media && mediaData.media.image && mediaData.media.image.src && mediaData.type == "share") {
                                    let linkObject = {};
                                    linkObject.description = mediaData.description ? mediaData.description : '';
                                    linkObject.imageUrl = mediaData.media.image.src ? mediaData.media.image.src : '';
                                    linkObject.title = mediaData.title ? mediaData.title : '';
                                    linkObject.targetUrl = mediaData.target.url ? mediaData.target.url : mediaData.target.url ? mediaData.target.url : '';
                                    postInfo["linkObj"].push(linkObject)
                                }
                                if (mediaData.media && mediaData.media.image && mediaData.media.image.src && mediaData.type == "photo") {
                                    return mediaData.media.image.src
                                } else {
                                    return []
                                }
                            })
                    } */

                    if (convRes.data.attachments && convRes.data.attachments.data && convRes.data.attachments.data[0] &&
                        convRes.data.attachments.data[0].subattachments && convRes.data.attachments.data[0].subattachments.data && convRes.data.attachments.data[0].subattachments.data.length > 0) {
                        postInfo["mediaUrl"] = convRes.data.attachments.data[0].subattachments.data.flatMap(mediaData => {
                            console.log("if     mediaData", mediaData)
                            if (mediaData.media && mediaData.media.image && mediaData.media.image.src) {
                                postInfo['mediaType'] = "image";
                                return mediaData.media.image.src
                            }
                            else {
                                return []
                            }

                        })
                    }
                    else if (convRes.data.attachments && convRes.data.attachments.data && convRes.data.attachments.data[0] && !convRes.data.attachments.data[0].subattachments) {
                        //fbObj["mediaUrl"] = fbResp.attachments.data.flatMap(mediaData => {
                        convRes.data.attachments.data.flatMap(mediaData => {
                            console.log("else if     mediaData", mediaData)
                            if (mediaData?.media?.image?.src && (mediaData.type == "share" || mediaData.type == "link")) {
                                postInfo['mediaType'] = "link";
                                if (mediaData.media && mediaData.media.image && mediaData.media.image.src && (mediaData.type == "share" || mediaData.type == "link")) {
                                    let linkObject = {};
                                    linkObject.description = mediaData.description ? mediaData.description : '';
                                    linkObject.imageUrl = mediaData.media.image.src ? mediaData.media.image.src : '';
                                    linkObject.title = mediaData.title ? mediaData.title : '';
                                    linkObject.targetUrl = mediaData.target.url ? mediaData.target.url : mediaData.target.url ? mediaData.target.url : '';
                                    linkObject.display_url = mediaData.target.url ? mediaData.target.url : mediaData.target.url ? mediaData.target.url : '';
                                    if (linkObject.display_url !== '') {
                                        let url = new URL(decodeURIComponent(linkObject.display_url));
                                        let dUrl = url.searchParams.get("u");
                                        console.log("...........", dUrl);
                                        linkObject.display_url = dUrl;
                                    }
                                    postInfo["linkObj"].push(linkObject)
                                }
                            }
                            if (mediaData?.media?.image?.src && (mediaData.type == "photo" || mediaData.type == "album")) {
                                postInfo['mediaType'] = "image";
                                //fbObj["thumbnail"] = mediaData.media.image.src;
                                postInfo["mediaUrl"] = [mediaData.media.image.src]
                            } else if (mediaData?.media?.image?.src && (mediaData.type == "video_inline" || mediaData.type == "video" || mediaData.type == 'animated_image_video')) {
                                postInfo['mediaType'] = "video";
                                postInfo["thumbnail"] = mediaData.media.image.src;
                                postInfo["mediaUrl"] = [mediaData.media.source]
                            }
                            /* else {
                              return []
                            } */
                        })
                    }

                    let public_metrics = {}
                    let has_liked = "false";

                    public_metrics.likes == 0;
                    public_metrics.comments == 0;
                    if (socialDoc.type == "page") {
                        has_liked = convRes.data.likes.summary.has_liked;
                        public_metrics.likes = convRes.data.likes.summary.total_count;
                    }

                    if (convRes.data.comments && convRes.data.comments.data && convRes.data.comments.data.length > 0) {
                        console.log("convRes.data.comments.data", JSON.stringify(convRes.data.comments.data))
                        conversations.data = convRes.data.comments.data.map(comment => {
                            let replied = {};

                            //replied.name = comment.from.name;
                            //replied.profileImage = `https://graph.facebook.com/${comment.from.id}/picture?access_token=${socialDoc.pageToken}`;
                            if (comment.from && comment.from.picture && comment.from.picture.data) {
                                comment.from.profileImage = comment.from.picture.data.url;
                                delete comment.from.picture;
                            }
                            comment.mediaUrl = comment?.attachment?.media?.image?.src ?? undefined;
                            comment.mediaType = comment?.attachment?.media?.image?.src ? 'image' : "text";
                            if (comment?.attachment?.type && comment.attachment.type == "animated_image_share") {
                                comment.mediaUrl = comment.attachment.url;
                                comment.mediaType = "gif";
                            }
                            comment.likes = comment.like_count || 0;
                            comment.comments = comment.comment_count || 0;
                            delete comment.like_count;
                            delete comment.comment_count;
                            comment.replied = replied;
                            return comment;
                        })
                        public_metrics.comments = conversations.data.length;

                        /* const promiseFBArray = [];
    
                        for (let i = 0; i < convRes.data.comments.data.length; i++) {
                            const comment = convRes.data.comments.data[i];
    
                            console.log("comment.id.....", comment.id)
    
                            promiseFBArray.push(axios.get(`https://graph.facebook.com/${comment.id}?access_token=${socialDoc.pageToken}&fields=message,parent,from,id,created_time`));
    
                        }
    
                        Promise.all(promiseFBArray).then(result => {
    
                            result.forEach(profile => {
                                console.log("profile.data.....", JSON.stringify(profile.data));
                            });
    
                            done('200', {
                                status: "Facebook Post Retrieved",
                                data: {
                                    public_metrics: public_metrics,
                                    postData: fbText,
                                    postInfo: postInfo,
                                    "has_liked": has_liked,
                                    //conversations: conversations,
                                    attachments: convRes.data.attachments
                                }
                            });
                        }) */


                    } else {
                        conversations.data = [];
                    }

                    done('200', {
                        status: "Facebook Post Retrieved",
                        data: {
                            /* postStatus: savedDoc.postData.postStatus,
                            postData: savedDoc.postData.postData,
                            postInfo: savedDoc.postData[queryConst],
                            public_metrics: { likes: convRes.data.likes.summary.total_count }, */
                            public_metrics: public_metrics,
                            postData: fbText,
                            postInfo: postInfo,
                            "has_liked": has_liked,
                            conversations: conversations,
                            attachments: convRes.data.attachments
                        }
                    });
                });
            } catch (error) {
                done('401', {
                    status: "LinkedIn data retrive failed",
                    message: error.message
                });
            }
        }
        try {
            switch (reqObj.action) {
                case 'like':
                    url = 'https://graph.facebook.com/' + reqObj.postId + '/likes?access_token=' + socialDoc.pageToken;
                    if (body.commentId) {
                        url = 'https://graph.facebook.com/' + body.commentId + '/likes?access_token=' + socialDoc.pageToken;
                    }
                    let likeData = await axios.post(url, null)

                    if (likeData.data && likeData.data.success && likeData.data.success == true) {
                        postAction();
                    } else {
                        done('401', {
                            status: "Like action failed, try again",
                            message: error.message
                        });
                    }
                    break;
                case 'unlike':
                    url = 'https://graph.facebook.com/' + reqObj.postId + '/likes?access_token=' + socialDoc.pageToken;
                    if (body.commentId) {
                        url = 'https://graph.facebook.com/' + body.commentId + '/likes?access_token=' + socialDoc.pageToken;
                    }
                    let unlikeData = await axios.delete(url, null)
                    if (unlikeData.data && unlikeData.data.success && unlikeData.data.success == true) {
                        postAction();
                    } else {
                        done('401', {
                            status: "Like action failed, try again",
                            message: error.message
                        });
                    }
                    break;
                case 'comment':
                    let postMessage = encodeURI(body.postData)
                    postMessage = postMessage.replace(/#/g, '%23');
                    url = 'https://graph.facebook.com/' + reqObj.postId + '/comments?message=' + postMessage + '&access_token=' + socialDoc.pageToken;
                    console.log(body.commentId)
                    if (body.commentId) {
                        url = 'https://graph.facebook.com/' + body.commentId + '/comments?message=' + postMessage + '&access_token=' + socialDoc.pageToken;
                    }
                    if (body.imageUrl) {
                        /* let splitVal = body.imageUrl.split('.')
                        let ext = splitVal[splitVal.length - 1];

                        if (ext == 'mp4' || ext == 'gif') {
                            url = 'https://graph.facebook.com/' + reqObj.postId + '/comments?message=' + postMessage + '&access_token=' + socialDoc.pageToken + '&attachment_share_url=' + body.imageUrl;
                        } else {
                            let imageData = await axios.post(`https://graph.facebook.com/${socialDoc.pageId}/photos?url=${body.imageUrl}&access_token=${socialDoc.pageToken}&published=false`, null)
                            console.log("imageData", JSON.stringify(imageData.data));
                            url = 'https://graph.facebook.com/' + reqObj.postId + '/comments?message=' + postMessage + '&access_token=' + socialDoc.pageToken + '&attachment_id=' + imageData.data.id;
                        } */
                        url = 'https://graph.facebook.com/' + reqObj.postId + '/comments?message=' + postMessage + '&access_token=' + socialDoc.pageToken + '&attachment_url=' + body.imageUrl;
                        let splitVal = body.imageUrl.split('.')
                        let ext = splitVal[splitVal.length - 1];
                        if (ext == 'mp4' || ext == 'gif') {
                            url = 'https://graph.facebook.com/' + reqObj.postId + '/comments?message=' + postMessage + '&access_token=' + socialDoc.pageToken + '&attachment_share_url=' + body.imageUrl;
                        }
                    }
                    console.log("url", JSON.stringify(url))
                    let commentData = await axios.post(url, null)
                    postAction()
                    break;
                case 'updatecomment':
                    let updateMessage = encodeURI(body.postData)
                    updateMessage = updateMessage.replace(/#/g, '%23');
                    console.log(body.commentId)
                    if (!body.commentId) {
                        done('200', {
                            status: false,
                            message: "commentId is required."
                        });
                    }
                    if (!body.postData) {
                        done('200', {
                            status: false,
                            message: "postData is required."
                        });
                    }

                    if (body.commentId) {
                        url = 'https://graph.facebook.com/' + body.commentId + '?message=' + updateMessage + '&access_token=' + socialDoc.pageToken;
                    }
                    let updatecommentData = await axios.post(url, null)
                    postAction()
                    break;
                case 'deletecomment':
                    if (!body.commentId) {
                        done('200', {
                            status: false,
                            message: "commentId is required."
                        });
                    }
                    url = 'https://graph.facebook.com/' + body.commentId + '?access_token=' + socialDoc.pageToken;
                    let deletecomment = await axios.delete(url, null)
                    if (deletecomment.data && deletecomment.data.success && deletecomment.data.success == true) {
                        postAction();
                    } else {
                        done('401', {
                            status: "Delete Comment failed, try again",
                            message: error.message
                        });
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            done('404', {
                status: "Facebook data retrive failed",
                message: error.message
            });
        }
    }

    const updateYoutubeStatus = async (socialDoc, reqObj) => {
        const reconnectGoogle = (refreshtoken) => {
            return new Promise(async (resolve, reject) => {
                //const requestBody = `client_secret=${client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${client_id}`;
                const requestBody = `client_secret=${youtubeClientSecret}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${youtubeClientId}`;
                const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                try {
                    let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                    console.log("res....", JSON.stringify(result.data.access_token))
                    resolve(result.data.access_token)
                } catch (error) {
                    console.log("error", JSON.stringify(error.message))
                    reject({ 'token': 'Failed' })
                }
            })
        };
        reconnectGoogle(socialDoc.socialMedia[0].refresh_token).then(async (token) => {
            let postAction = async () => {
                let promiseArray = [];
                const getVideoRatingDetails = () => {
                    return new Promise(async (resolve, reject) => {

                        const url = `https://www.googleapis.com/youtube/v3/videos/getRating?id=${reqObj.postId}&part=statistics&access_token=${token}`;
                        try {
                            let rating = await axios.get(url, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            console.log("rating....", JSON.stringify(rating.data))
                            resolve(rating.data)
                        } catch (error) {

                            console.log("error reconnectGoogle", JSON.stringify(error.message))
                            resolve()

                        }

                    });
                };
                const video = () => {
                    return new Promise(async (resolve, reject) => {

                        //const url = `https://www.googleapis.com/youtube/v3/videos?id=${reqObj.postId}&access_token=${token}&part=contentDetails,fileDetails,id,liveStreamingDetails,localizations,player,processingDetails,recordingDetails,snippet,statistics,status,suggestions,topicDetails`;
                        const url = `https://www.googleapis.com/youtube/v3/videos?id=${reqObj.postId}&access_token=${token}&part=snippet,status,statistics`;
                        try {
                            let videos = await axios.get(url, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            resolve(videos.data)
                        } catch (error) {
                            console.log("error video", JSON.stringify(error.message))
                            resolve()
                        }

                    });
                };
                let youtubeComments = async () => {
                    return new Promise(async (resolve, reject) => {
                        const url = `https://youtube.googleapis.com/youtube/v3/commentThreads?part=id,replies,snippet&order=relevance&videoId=${reqObj.postId}&access_token=${token}`;
                        //const url = `https://youtube.googleapis.com/youtube/v3/commentThreads?part=id,replies,snippet&order=time&videoId=${postId}&access_token=${token}`;
                        try {
                            var responseArr = []
                            let commentsData = await axios.get(url);
                            console.log("coments................", JSON.stringify(commentsData.data))
                            commentsData.data.items.forEach(cmt => {
                                let resObj = {}
                                resObj.replied = {}

                                resObj.postDate = cmt.snippet.topLevelComment.snippet.publishedAt;
                                resObj.message = cmt.snippet.topLevelComment.snippet.textOriginal;
                                resObj.commentId = cmt.id;
                                resObj.replied.profileImage = cmt.snippet.topLevelComment.snippet.authorProfileImageUrl
                                resObj.favorited = cmt.snippet.topLevelComment.snippet.viewerRating
                                resObj.replied.Id = cmt.snippet.topLevelComment.snippet.authorChannelId.value
                                //resObj.pageId = userId;

                                resObj.like_count = 0;
                                resObj.reply_count = 0;
                                resObj.replied.name = cmt.snippet.topLevelComment.snippet.authorDisplayName;



                                if (cmt.snippet.topLevelComment.snippet && cmt.snippet.topLevelComment.snippet.likeCount) {
                                    resObj.like_count = cmt.snippet.topLevelComment.snippet.likeCount;
                                }

                                if (cmt.snippet && cmt.snippet.totalReplyCount) {
                                    resObj.reply_count = cmt.snippet.totalReplyCount;
                                }
                                if (cmt.replies) {

                                    let commThread = []
                                    cmt.replies.comments.forEach(threadData => {


                                        let threadObj = {}
                                        threadObj.replied = {}



                                        threadObj.replied.profileImage = threadData.snippet.authorProfileImageUrl;

                                        threadObj.postDate = threadData.snippet.publishedAt;
                                        threadObj.message = threadData.snippet.textOriginal;
                                        threadObj.favorited = threadData.snippet.viewerRating;
                                        threadObj.commentId = threadData.id;
                                        threadObj.parentId = threadData.snippet.parentId;
                                        //threadObj.pageId = userId;
                                        threadObj.like_count = 0;
                                        threadObj.reply_count = 0;
                                        threadObj.replied.name = threadData.snippet.authorDisplayName;
                                        resObj.replied.Id = threadData.snippet.authorChannelId.value

                                        if (threadData.snippet && threadData.snippet.likeCount) {
                                            threadObj.like_count = threadData.snippet.likeCount;
                                        }

                                        commThread.push(threadObj)

                                        resObj.commentsThread = commThread;
                                    });
                                } else {
                                    resObj.commentsThread = []
                                }

                                responseArr.push(resObj)


                            });

                            //resolve(commentsData.data)
                            resolve({ comments: responseArr })
                        } catch (error) {
                            console.log("error youtubeComments", JSON.stringify(error.message))
                            resolve()
                        }
                    })
                }

                promiseArray.push(getVideoRatingDetails());
                promiseArray.push(youtubeComments());
                promiseArray.push(video());

                Promise.all(promiseArray).then((post) => {

                    console.log("post", JSON.stringify(post))
                    let postInfo = {};
                    let titileText = '';
                    //let favorited = false;
                    let public_metrics = {};
                    let comments = [];

                    let conversations = { "meta": { "result_count": 0 } };
                    postInfo.mediaUrl = [];
                    postInfo.linkObj = [];
                    postInfo.geo_location = {};
                    postInfo.mediaType = "video";

                    postInfo.place = {};
                    postInfo.userId = socialDoc.socialMedia[0].userId;
                    postInfo.postStatus = "Success";
                    postInfo.postDate = post[2].items[0].snippet.publishedAt;
                    postInfo.postId = post[2].items[0].id;
                    postInfo.profileImage = socialDoc.socialMedia[0].userProfileImage ? socialDoc.socialMedia[0].userProfileImage : '';

                    postInfo.thumbnail = post[2].items[0].snippet.thumbnails.standard.url;
                    postInfo.mediaUrl.push(`https://www.youtube.com/embed/${post[2].items[0].id}`);

                    public_metrics.viewCount = post[2].items[0].statistics.viewCount;
                    public_metrics.like_count = post[2].items[0].statistics.likeCount;
                    public_metrics.dislikeCount = post[2].items[0].statistics.dislikeCount;
                    public_metrics.commentCount = post[2].items[0].statistics.commentCount;
                    public_metrics.favoriteCount = post[2].items[0].statistics.favoriteCount;
                    /*  if (post[0].items[0].rating == 'none') {
                         favorited = 'false'
                     } else {
 
                         favorited = post[0].items[0].rating;
                     } */
                    let favorited = post[0].items[0].rating;
                    if (post[1] && post[1].comments && post[1].comments.length > 0) {
                        comments = post[1].comments
                    }
                    done('200', {
                        status: "Video Details Retrieved",
                        data: {

                            postInfo: post.data,

                            postStatus: "Posted",
                            postData: titileText,
                            postInfo: postInfo,
                            public_metrics: public_metrics,
                            "favorited": favorited,
                            conversations: comments
                        }
                    });

                }).catch(error => {
                    done('401', {
                        status: "Youtube data retrive failed",
                        message: error.message
                    });
                });
            }


            let url = '';
            let rating = 'none';

            try {

                let reqBody = {

                    "snippet": {
                        "channelId": reqObj.userId,
                        "videoId": reqObj.postId,
                        "topLevelComment": {
                            "snippet": {
                                "textOriginal": body.message
                            }
                        }
                    },
                };
                /* 

                console.log("reqObj.userId", reqObj.userId)
                console.log("reqObj.postId", reqObj.postId)
                console.log("reqObj.comments", body.message) */
                let reqbody = {

                    "snippet": {

                        "channelId": reqObj.userId,
                        "videoId": reqObj.postId,
                        "textOriginal": body.message,
                        "parentId": body.commentId
                    }
                }



                switch (reqObj.action) {
                    case 'deletecomment':
                        if (!body.commentId) {
                            done('200', {
                                status: false,
                                message: "commentId is required."
                            });
                            return;
                        }
                        console.log("delete")
                        url = `https://youtube.googleapis.com/youtube/v3/comments?id=${body.commentId}&access_token=${token}`


                        await axios.delete(url, null);
                        postAction();
                        break;
                    case 'comment':
                        console.log("comments.............")
                        url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,id&access_token=${token}`;
                        await axios.post(url, reqBody);
                        if (body.commentId) {
                            cmt = `https://www.googleapis.com/youtube/v3/comments?part=snippet,id&access_token=${token}`
                            await axios.post(cmt, reqbody);
                        }
                        postAction();
                        break;
                    case 'like':
                        rating = "like"
                        url = `https://www.googleapis.com/youtube/v3/videos/rate?id=${reqObj.postId}&rating=${rating}&access_token=${token}`;
                        console.log("like url............", url)
                        await axios.post(url, null, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                        postAction();
                        break;
                    case 'unlike':
                        rating = "dislike"
                        url = `https://www.googleapis.com/youtube/v3/videos/rate?id=${reqObj.postId}&rating=${rating}&access_token=${token}`;
                        await axios.post(url, null, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                        postAction();
                        break;
                    case 'ignore':
                        rating = "none"
                        url = `https://www.googleapis.com/youtube/v3/videos/rate?id=${reqObj.postId}&rating=${rating}&access_token=${token}`;
                        await axios.post(url, null, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                        postAction();
                        break;

                    default:
                        break;
                }


                // done('200', {
                //     status: "youtube Post Retrieved",
                //     //data: VideoLike.data
                // });

            } catch (error) {
                postAction();
                console.log("error try", JSON.stringify(error.message))
                //resolve()
            }

        }).catch(error => {
            done('401', {
                status: "Youtube data retrive failed",
                message: error.message
            });
        });
    }

    const updateIntstagramStatus = async (socialDoc, reqObj) => {
        console.log("socialDoc...insta", JSON.stringify(socialDoc))
        let postAction = async () => {
            console.log("1232424")
            let promiseArray = [];

            const instagram = () => {
                return new Promise(async (resolve, reject) => {
                    //const url = 'https://graph.facebook.com/' + reqObj.postId + '?access_token=' + socialDoc.socialMedia[0].oauth_token + `&fields=media_url,like_count,comments_count,ig_id,media_type,caption,username,timestamp,shortcode,comments,is_comment_enabled,video_title,thumbnail_url,owner,media_product_type,id,permalink,children`;
                    const url = 'https://graph.facebook.com/' + reqObj.postId + '?access_token=' + socialDoc.socialMedia[0].oauth_token + `&fields=media_url,like_count,comments_count,ig_id,media_type,caption,username,timestamp,shortcode,comments,is_comment_enabled,video_title,thumbnail_url,owner,media_product_type,id,permalink,children{media_url,thumbnail_url}`;
                    try {
                        let instadata = await axios.get(url);
                        console.log("instadata....", JSON.stringify(instadata.data))
                        resolve(instadata.data)
                    } catch (error) {
                        console.log("error", JSON.stringify(error.message))

                    }
                });

            };


            const instacomments = () => {
                return new Promise(async (resolve, reject) => {
                    const url = 'https://graph.facebook.com/' + reqObj.postId + '/comments?access_token=' + socialDoc.socialMedia[0].oauth_token + `&fields=id,timestamp,from,text,media,user,username,replies.limit(10){media,id,like_count,from,text,timestamp,parent_id,user,username}`;
                    try {
                        var responseArr = []
                        let commentsData = await axios.get(url);
                        console.log("coments................", JSON.stringify(commentsData.data))
                        commentsData.data.data.forEach(cmt => {
                            let resObj = {}
                            resObj.replied = {}

                            resObj.postDate = cmt.timestamp;
                            resObj.message = cmt.text;
                            resObj.commentId = cmt.id;
                            resObj.replied.name = cmt.from.username;
                            resObj.replied.Id = cmt.from.id;

                            if (cmt.replies) {

                                let commThread = []
                                cmt.replies.data.forEach(threadData => {
                                    let threadObj = {}
                                    threadObj.replied = {}
                                    threadObj.postDate = threadData.timestamp;
                                    threadObj.message = threadData.text;
                                    threadObj.commentId = threadData.id;
                                    threadObj.parentId = threadData.parentId;
                                    threadObj.replied.name = threadData.from.username;
                                    threadObj.replied.Id = threadData.from.id


                                    commThread.push(threadObj)

                                    resObj.commentsThread = commThread;
                                });
                            } else {
                                resObj.commentsThread = []
                            }

                            responseArr.push(resObj)


                        });

                        //resolve(commentsData.data)

                        resolve({ comments: responseArr })
                    } catch (error) {
                        console.log("error", JSON.stringify(error.message))

                    }

                });

            };


            promiseArray.push(instagram());
            promiseArray.push(instacomments());
            Promise.all(promiseArray).then((igdata) => {
                var postInfo = {};
                var public_metrics = {};
                let comments = [];
                public_metrics['like'] = igdata[0].like_count;
                postInfo['mediaUrl'] = [igdata[0].media_url]
                postInfo['userId'] = igdata[0].owner.id;
                postInfo['postStatus'] = "Success";
                postInfo['postId'] = igdata[0].id;
                postInfo['pageName'] = igdata[0].username;
                postInfo['postDate'] = igdata[0].timestamp;
                postInfo['postData'] = igdata[0].caption;
                postInfo['comments_count'] = igdata[0].comments_count;
                public_metrics['comments'] = igdata[0].comments_count;
                postInfo["mediaType"] = '';
                postInfo["thumbnail"] = '';
                if (igdata[0].media_type == "CAROUSEL_ALBUM") {
                    postInfo["mediaType"] = "carousel_album";
                    postInfo["thumbnail"] = igdata[0].media_url;
                    if (igdata[0]?.children?.data && igdata[0]?.children?.data.length > 0) {
                        postInfo["mediaUrl"] = igdata[0].children.data.map(img => {
                            return img.media_url;
                        })
                    }
                }
                if (igdata[0].media_type == "VIDEO") {
                    postInfo["mediaType"] = "video";
                    postInfo["thumbnail"] = igdata[0].thumbnail_url;

                }
                if (igdata[0].media_type == "IMAGE") {
                    postInfo["mediaType"] = "image";
                    postInfo["thumbnail"] = igdata[0].media_url;

                }
                if (igdata[1] && igdata[1].comments && igdata[1].comments.length > 0) {
                    comments = igdata[1].comments
                }
                done('200', {
                    data: {
                        public_metrics: public_metrics,
                        postInfo: postInfo,
                        postData: igdata[0].caption,
                        //conversations: igdata[1].data 
                        conversations: comments
                    }
                });
                //console.log("igdata",JSON.stringify(igdata))
            }).catch(error => {

                console.log(".........................222222222222");
                done('401', {
                    status: "Instagram data retrive failed",
                    message: error.message
                });
            });
            /*  let convRes = await axios.get();
 
             if (convRes.data) {
                 var postInfo = {};
                 var public_metrics = {}
                 public_metrics['like'] = convRes.data.like_count;
                 postInfo['mediaUrl'] = [convRes.data.media_url]
                 postInfo['userId'] = convRes.data.owner.id;
                 postInfo['postStatus'] = "Success";
                 postInfo['postId'] = convRes.data.id;
                 postInfo['pageName'] = convRes.data.username;
                 postInfo['postDate'] = convRes.data.timestamp;
                 postInfo['postData'] = convRes.data.caption;
                 postInfo['comments_count'] = convRes.data.comments_count;
                 postInfo['media_type'] = convRes.data.media_type;
             }
             done('200', {
                 data: {
                     public_metrics: public_metrics,
                     postInfo: postInfo,
                 }
             }); */
        }
        try {
            switch (reqObj.action) {

                case 'comment':
                    console.log("action insta")
                    let postMessage = encodeURI(body.message)
                    console.log("postMessaginsta", postMessage)
                    console.log("reqObj.postId", reqObj.postId)
                    console.log("reqObj.postId", reqObj.postId)
                    igurl = 'https://graph.facebook.com/' + reqObj.postId + '/comments?message=' + postMessage + '&access_token=' + socialDoc.socialMedia[0].oauth_token;
                    console.log(body.commentId)
                    if (body.commentId) {
                        igurl = 'https://graph.facebook.com/' + body.commentId + '/replies?message=' + postMessage + '&access_token=' + socialDoc.socialMedia[0].oauth_token;
                    }
                    console.log("ig...........", igurl)
                    let commentData = await axios.post(igurl, null)
                    postAction()
                    break;
                case 'deletecomment':
                    url = 'https://graph.facebook.com/' + body.commentId + '?access_token=' + socialDoc.socialMedia[0].oauth_token;
                    let deletecomment = await axios.delete(url, null)
                    postAction();
                    if (deletecomment.data && deletecomment.data.success && deletecomment.data.success == true) {
                    } else {
                        done('401', {
                            status: "Delete Comment failed, try again",
                            message: error.message
                        });
                    }
                    break;

            }

        } catch (error) {
            console.log("error", JSON.stringify(error.message))

        }
    }

    switch (event.httpMethod) {
        case 'POST':
            console.log('POST Schedule tweet Called')
            var body = JSON.parse(event.body);
            context.callbackWaitsForEmptyEventLoop = false;
            if (event.headers && event.headers.userauthdata) {

                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
                if (email && email !== '') {
                    if (!body.socialMedia) {
                        done('400', {
                            status: 'Social Media Name is required',
                            data: body
                        });
                    }
                    if (!body.action) {
                        done('400', {
                            status: 'Action is required',
                            data: body
                        });
                    }
                    if (!body.postId) {
                        done('400', {
                            status: 'Post Id is required',
                            data: body
                        });
                    }
                    if (!body.userId) {
                        done('400', {
                            status: 'User Id is required',
                            data: body
                        });
                    }
                    /* const socialMedia = body.socialMedia;
                    const action = body.action;
                    const postId = body.postId;
                    const userId = body.userId; */

                    const reqObj = {
                        socialMedia: body.socialMedia,
                        action: body.action,
                        postId: body.postId,
                        userId: body.userId
                    }
                    console.log(reqObj.socialMedia)
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


                        if (reqObj.socialMedia === 'twitter' || reqObj.socialMedia === 'linkedin' || reqObj.socialMedia === 'youtube' || reqObj.socialMedia === 'instagram') {
                            const mdQueryRet = { 'email': { $regex: new RegExp("^" + email, "i") }, 'socialMedia.name': reqObj.socialMedia, 'socialMedia.userId': reqObj.userId };
                            socialModel.findOne(mdQueryRet, { _id: 0, socialMedia: { $elemMatch: { name: reqObj.socialMedia, userId: reqObj.userId } } })
                                .exec(function (err, socialDoc) {
                                    if (reqObj.socialMedia === 'twitter') {
                                        updateTwitterStatus(socialDoc, reqObj)
                                    } else if (reqObj.socialMedia === 'linkedin') {
                                        console.log("socialDoc", JSON.stringify(socialDoc))
                                        updateLinkedinStatus(socialDoc, reqObj);
                                    } else if (reqObj.socialMedia === 'youtube') {
                                        updateYoutubeStatus(socialDoc, reqObj);
                                    } else if (reqObj.socialMedia === 'instagram') {
                                        updateIntstagramStatus(socialDoc, reqObj);
                                    }
                                });
                        } else if (reqObj.socialMedia === 'facebook') {
                            var pageid = ""
                            if (body.pageId) {
                                pageid = body.pageId
                            } else {
                                if (body.postId.includes('_')) {
                                    let splitPostId = body.postId.split("_");
                                    pageid = splitPostId[0]
                                }
                            }
                            const mdQueryRet = [{ "$match": { email: email } },
                            { "$unwind": "$socialMedia" },
                            { "$match": { "socialMedia.name": "facebook", 'socialMedia.userId': reqObj.userId } },
                            { "$unwind": "$socialMedia.fbpages" },
                            { "$match": { "socialMedia.fbpages.id": pageid } },
                            { "$project": { _id: 0, "pageToken": "$socialMedia.fbpages.access_token", "pageId": "$socialMedia.fbpages.id", "userId": "$socialMedia.userId", "pageName": "$socialMedia.fbpages.name", "type": "$socialMedia.fbpages.type" } }
                            ]
                            socialModel.aggregate(mdQueryRet).exec(function (err, socialDoc) {
                                if (socialDoc && socialDoc[0]) {
                                    updateFacebookStatus(socialDoc[0], reqObj);
                                } else {
                                    done('400', {
                                        status: "Social Media Not Available",
                                    });
                                }
                            })
                        } else {
                            done('200', {
                                status: "Incorrect Social Media key provided",
                            });
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
        case 'GET':
            console.log('Linked in get comment data')
            context.callbackWaitsForEmptyEventLoop = false;
            if (event.headers && event.headers.userauthdata) {
                const userAuthData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const userEmail = userAuthData.split(':').length === 2 ? userAuthData.split(':')[0] : '';
                if (userEmail && userEmail !== '') {
                    connectorMongodb.then(() => {
                        var reqParams = event.queryStringParameters;
                        if (reqParams.socialMedia === 'linkedin') {
                            const mdQueryRet = { 'email': { $regex: new RegExp("^" + userEmail, "i") }, 'socialMedia.name': reqParams.socialMedia, 'socialMedia.userId': reqParams.userId };
                            socialModel.findOne(mdQueryRet, { _id: 0, socialMedia: { $elemMatch: { name: reqParams.socialMedia, userId: reqParams.userId } } }).exec(async (err, socialDoc) => {
                                let responseArr = []
                                let commentsData = await axios.get("https://api.linkedin.com/v2/socialActions/" + reqParams.postId + "/comments", { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })

                                if (commentsData.data && commentsData.data.elements && commentsData.data.elements.length > 0) {
                                    for await (const comData of commentsData.data.elements) {
                                        console.log("comData", JSON.stringify(comData));
                                        let resObj = {}
                                        resObj.postDate = comData.created.time;
                                        resObj.message = comData.message.text;
                                        resObj.commentUrn = comData.$URN;
                                        resObj.commentId = comData.id;
                                        resObj.pageId = reqParams.userId;
                                        resObj.activity = comData.object;
                                        resObj.like_count = 0;
                                        resObj.reply_count = 0;
                                        resObj.likedByCurrentUser = false
                                        resObj["mediaUrl"] = "";
                                        if (comData.content && comData.content[0]) {
                                            if (comData.content[0].type == 'IMAGE') {
                                                resObj["mediaUrl"] = comData.content[0].url;
                                            }
                                        }
                                        if (comData.likesSummary && comData.likesSummary.aggregatedTotalLikes) {
                                            resObj.like_count = comData.likesSummary.aggregatedTotalLikes;
                                        }
                                        if (comData.likesSummary && comData.likesSummary.selectedLikes && comData.likesSummary.selectedLikes.length > 0) {
                                            comData.likesSummary.selectedLikes.map(likeData => {
                                                var companyId = comData.actor.split(':').pop()
                                                console.log("companyId", companyId);
                                                if (likeData.includes(companyId)) {
                                                    resObj.likedByCurrentUser = true;
                                                    return
                                                }
                                            })
                                        }
                                        if (comData.commentsSummary && comData.commentsSummary.aggregatedTotalComments) {
                                            resObj.reply_count = comData.commentsSummary.aggregatedTotalComments;
                                        }
                                        let commThread = []
                                        let commentsThread = await axios.get("https://api.linkedin.com/v2/socialActions/" + comData.$URN + "/comments", { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })

                                        if (commentsThread.data && commentsThread.data.elements && commentsThread.data.elements.length > 0) {
                                            commentsThread.data.elements.forEach(threadData => {
                                                let threadObj = {}
                                                console.log("threadData", JSON.stringify(threadData));
                                                threadObj.postDate = threadData.created.time;
                                                threadObj.message = threadData.message.text;
                                                threadObj.commentUrn = threadData.$URN;
                                                threadObj.commentId = threadData.id;
                                                threadObj.activity = threadData.object;
                                                threadObj.pageId = reqParams.userId;
                                                threadObj.like_count = 0;
                                                threadObj.reply_count = 0;
                                                threadObj.likedByCurrentUser = false;
                                                threadObj["mediaUrl"] = "";
                                                if (threadData.content && threadData.content[0]) {
                                                    if (threadData.content[0].type == 'IMAGE') {
                                                        threadObj["mediaUrl"] = threadData.content[0].url;
                                                    }
                                                }
                                                if (threadData.likesSummary && threadData.likesSummary.aggregatedTotalLikes) {
                                                    threadObj.like_count = threadData.likesSummary.aggregatedTotalLikes;
                                                }
                                                if (threadData.likesSummary && threadData.likesSummary.selectedLikes && threadData.likesSummary.selectedLikes.length > 0) {
                                                    threadData.likesSummary.selectedLikes.map(likeData => {
                                                        var companyId = threadData.actor.split(':').pop()
                                                        console.log("companyId", companyId);
                                                        if (likeData.includes(companyId)) {
                                                            threadObj.likedByCurrentUser = true;
                                                            return
                                                        }
                                                    })
                                                }
                                                if (threadData.commentsSummary && threadData.commentsSummary.aggregatedTotalComments) {
                                                    threadObj.reply_count = threadData.commentsSummary.aggregatedTotalComments;
                                                }
                                                commThread.push(threadObj)
                                            });
                                            resObj.commentsThread = commThread;
                                        }
                                        responseArr.push(resObj)
                                    }
                                }
                                console.log("responseArr", responseArr.length);
                                done('200', {
                                    status: "Comment details retrieved succussfully",
                                    data: responseArr
                                });
                            });
                        } else {
                            done('400', {
                                status: "Incorrect Social Media key provided",
                            });
                        }
                    },
                        (err) => { console.log('Connection Error'); });
                } else {
                    done('403', {
                        status: "User Profile Not Retrieved"
                    });
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
