var mongoose = require('mongoose');
var postModel = require('./PostData.js');
var socialModel = require('./SocialModel.js');
var axios = require('axios');
var AuthHelper = require('./AuthHelper.js');

exports.handler = (event, context, callback) => {
    //console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? err : '400',
        body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });

    /* var connectorMongodb = mongoose.connect('mongodb+srv://storefries:CH8U1ZXGyeILqFWy@storefries.76ocf.mongodb.net/SocialMediaPublisher', { useNewUrlParser: true, useUnifiedTopology: true });
    const CONSUMERKEY = 'eLD1dQVA2Sz4rN166vyJnF8m8';
    const CONSUMERSECRET = 'qtO5wIc479drT3YqmiNYzRSTsc6hrpVR7paj8ZgMAAoDdSW50H';
    const twitter_token = 'AAAAAAAAAAAAAAAAAAAAABJRMAEAAAAAZCgIiNjUIBEmshoYJVkZsYV6Nc0%3DJtWFMmKy7Bz0CqFZI0xU9reKrJqYuHzpxW0fNgf9ptWDEskYRH';
    var googleClientSecret = "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";
    var googleClientId = "781834412445-ggdcsq1tuvsvsg99uh3pg6iqc6jqi4ug.apps.googleusercontent.com";
    var googleRedirctUrl = "https://test.storefries.com/dashboard/connect/new/gmb"; */

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
    const CONSUMERKEY = event.stageVariables['Twitter_ConsumerKey'];
    const CONSUMERSECRET = event.stageVariables['Twitter_ConsumerSecret'];
    const twitter_token = process.env.twitter_token;
    var googleClientId = event.stageVariables['Google_ClientId'];
    var googleClientSecret = event.stageVariables['Google_ClientSecret'];
    var googleRedirctUrl = event.stageVariables['Manage_ProfilePage'];

    const retrieveFacebook = async (postId, userId, socialDoc) => {

        try {
            //axios.get('https://graph.facebook.com/' + postId + '?access_token=' + socialDoc.pageToken + '&fields=message,likes.summary(true),created_time,comments,attachments,from,parent_id,story,place,actions').then((convRes) => {
            let addQueryParams = "";
            if (socialDoc.type == "page") {
                addQueryParams = ",likes.summary(true)"
            }
            //let convRes = await axios.get('https://graph.facebook.com/v12.0/' + postId + '?access_token=' + socialDoc.pageToken + `&fields=message,targeting,created_time,comments{id,name,from{name,id,picture},created_time,comments{id,name,from{name,id,picture},created_time,message},to{id},message},attachments,from,to,parent_id,story,place,actions${addQueryParams}`);
            let convRes = await axios.get('https://graph.facebook.com/v14.0/' + postId + '?access_token=' + socialDoc.pageToken + `&fields=message,targeting,created_time,comments{id,name,like_count,comment_count,attachment,from{name,id,picture},created_time,comments{id,name,like_count,comment_count,attachment,from{name,id,picture},created_time,message},to{id},message},attachments,from,to,parent_id,story,place,actions${addQueryParams}`);
            if (convRes.data) {
                let postInfo = {};
                let fbText = convRes.data.message || "";
                let conversations = {};
                postInfo.mediaUrl = [];
                postInfo.linkObj = [];
                postInfo.userId = userId;
                postInfo['mediaType'] = "text";
                postInfo["thumbnail"] = '';
                postInfo.postStatus = "Success";
                postInfo.postId = postId;
                postInfo.postDate = convRes.data.created_time;
                let id = "id";
                let name = "name";
                //postInfo['targetAudience'] = "false";

                if (socialDoc.type == "page") {
                    id = "pageId";
                    name = "pageName";
                }
                else if (socialDoc.type == "group") {
                    id = "groupId";
                    name = "groupName";
                }

                if (convRes.data.targeting && convRes.data.targeting.geo_locations) {
                    postInfo['targetAudience'] = true;
                }
                else {
                    postInfo['targetAudience'] = false;
                }

                postInfo[id] = socialDoc.pageId;
                postInfo[name] = socialDoc.pageName;

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

                if (convRes.data.attachments && convRes.data.attachments.data && convRes.data.attachments.data[0] &&
                    convRes.data.attachments.data[0].subattachments && convRes.data.attachments.data[0].subattachments.data && convRes.data.attachments.data[0].subattachments.data.length > 0) {
                    postInfo["mediaUrl"] = convRes.data.attachments.data[0].subattachments.data.flatMap(mediaData => {
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
                    convRes.data.attachments.data.flatMap(mediaData => {
                        if (mediaData?.media?.image?.src && (mediaData.type == "share" || mediaData.type == "link")) {
                            postInfo['mediaType'] = "link";
                            if (mediaData.media && mediaData.media.image && mediaData.media.image.src && (mediaData.type == "share" || mediaData.type == "link")) {
                              let linkObject = {};
                              linkObject.description =  mediaData.description ? mediaData.description : '';                           
                              linkObject.imageUrl = mediaData.media.image.src ? mediaData.media.image.src : '';
                              linkObject.title = mediaData.title ? mediaData.title : '';
                              linkObject.targetUrl = mediaData.target.url ? mediaData.target.url : mediaData.target.url ? mediaData.target.url : '';
                              linkObject.display_url = mediaData.target.url ? mediaData.target.url : mediaData.target.url ? mediaData.target.url : '';
                              if (linkObject.display_url !== '') {
                                  let url = new URL(decodeURIComponent(linkObject.display_url));
                                  let dUrl = url.searchParams.get("u");
                                  console.log("...........",dUrl);
                                  linkObject.display_url = dUrl;
                              }
                              postInfo["linkObj"].push(linkObject)
                          }
                        }
                        if (mediaData?.media?.image?.src && (mediaData.type == "photo" || mediaData.type == "album")) {
                            postInfo['mediaType'] = "image";
                            //fbObj["thumbnail"] = mediaData.media.image.src;
                            postInfo["mediaUrl"] = [mediaData.media.image.src]
                        }
                        else if (mediaData?.media?.image?.src && (mediaData.type == "video_inline" || mediaData.type == "video" || mediaData.type == "animated_image_video")) {
                            postInfo['mediaType'] = "video";
                            postInfo["thumbnail"] = mediaData.media.image.src;
                            postInfo["mediaUrl"] = [mediaData.media.source]
                        }
                    })
                }
                let public_metrics = {}
                let has_liked = "false"

                public_metrics.likes == 0;
                public_metrics.comments == 0;
                if (socialDoc.type == "page") {
                    has_liked = convRes.data.likes.summary.has_liked;
                    public_metrics.likes = convRes.data.likes.summary.total_count;
                }

                if (convRes.data.comments && convRes.data.comments.data && convRes.data.comments.data.length > 0) {
                        console.log("comment",JSON.stringify(convRes.data.comments.data));
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
                        if(comment?.attachment?.type && comment.attachment.type == "animated_image_share"){
                            comment.mediaUrl = comment.attachment.url;
                            comment.mediaType = "gif";
                        }
                        comment.likes = comment.like_count || 0;
                        comment.comments = comment.comment_count || 0;
                        delete comment.like_count;
                        delete comment.comment_count;
                        if (comment?.attachment) {
                            delete comment.attachment;
                        }

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


                }
                else {
                    conversations.data = [];
                }

                done('200', {
                    status: "Facebook Post Retrieved",
                    data: {
                        public_metrics: public_metrics,
                        postData: fbText,
                        postInfo: postInfo,
                        "has_liked": has_liked,
                        conversations: conversations,
                        attachments: convRes.data.attachments
                    }
                });
            }

            //});            
        }
        catch (error) {
            done('401', {
                status: "Facebook data retrive failed",
                message: error.message
            });
        }
    }

    const retrieveLinkedIn = async (socialDoc, userId, postId) => {

        try {

            let shareData = async () => {
                return new Promise(async (resolve, reject) => {
                    console.log("shareData........")
                    //axios.get('https://api.linkedin.com/v2/shares/' + postId, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } }).then((resp) => {
                    //axios.get('https://api.linkedin.com/v2/ugcPosts/' + postId, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } }).then((resp) => {
                    let url = 'https://api.linkedin.com/v2/ugcPosts/' + postId + '?viewContext=AUTHOR&projection=(name,localizedName,author,id,created,specificContent(com.linkedin.ugc.ShareContent(shareMediaCategory,shareCommentary,media(*(media~:playableStreams,originalUrl,thumbnails,description,title)))))';
                    console.log("url......", url)
                    axios.get(url, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } }).then((resp) => {

                        //console.log("shareData", JSON.stringify(resp.data))
                        if (resp.data) {
                            resolve({ shareData: resp.data })
                        }
                        else {
                            resolve({ shareData: {} })
                        }
                    }).catch(err => {
                        console.log("err111  ,,,", JSON.stringify(err))
                        console.log("share errror")
                        resolve({ shareData: {} })
                    })
                })
            }

            let socialActionData = async () => {
                return new Promise(async (resolve, reject) => {
                    console.log("socialActionData........")
                    axios.get('https://api.linkedin.com/v2/socialActions/' + postId, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } }).then((resp) => {
                        if (resp.data) {
                            resolve({ socialActionData: resp.data })
                        }
                        else {
                            resolve({ socialActionData: {} })
                        }
                    }).catch(err => {
                        console.log("err", JSON.stringify(err))
                        resolve({ socialActionData: {} })
                    })
                })
            }

            let linkedinComments = async () => {
                return new Promise(async (resolve, reject) => {
                    let responseArr = []
                    console.log("cmt........")
                    try {
                        let commentsData = await axios.get("https://api.linkedin.com/v2/socialActions/" + postId + "/comments?projection=(elements(*(*,actor~(*,profilePicture(displayImage~digitalmediaAsset:playableStreams,logoV2(original~digitalmediaAsset:playableStreams))))))", { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })
                        console.log("commentsData.data.elements", JSON.stringify(commentsData.data.elements))
                        if (commentsData.data && commentsData.data.elements && commentsData.data.elements.length > 0) {

                            for await (const comData of commentsData.data.elements) {
                                let resObj = {}
                                resObj.replied = {}
                                //console.log("comData.created.actor", comData.created.actor)
                                //console.log("socialDoc.socialMedia[0].linkedinPages", JSON.stringify(socialDoc.socialMedia[0].linkedinPages))
                                /* let filterdata = socialDoc.socialMedia[0].linkedinPages.filter(profile => {
                                    return comData.created.actor == profile.pageId
                                })
                                if (filterdata.length == 0) {
                                    resObj.replied.profileImage = comData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier;
                                } else {
                                    resObj.replied.profileImage = socialDoc.socialMedia[0].linkedinPages[0].pageImage;
                                } */

                                if (comData && comData['actor~'] && comData['actor~'].profilePicture && comData['actor~'].profilePicture['displayImage~'] && comData['actor~'].profilePicture['displayImage~'].elements &&
                                    comData['actor~'].profilePicture['displayImage~'].elements.length > 0 && comData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier) {
                                    resObj.replied.profileImage = comData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier
                                }
                                if (comData && comData.actor) {
                                    resObj.replied.Id = comData.actor;
                                }
                                resObj.postDate = comData.created.time;
                                resObj.message = comData.message.text;
                                resObj.commentUrn = comData.$URN;
                                resObj.commentId = comData.id;

                                //resObj.pageId = userId;
                                resObj.activity = comData.object;
                                resObj.like_count = 0;
                                resObj.reply_count = 0;
                                resObj.replied.name = comData['actor~'].vanityName;
                                resObj.likedByCurrentUser = false
                                resObj["mediaUrl"] = "";
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
                                let commentsThread = await axios.get("https://api.linkedin.com/v2/socialActions/" + comData.$URN + "/comments?projection=(elements(*(*,actor~(*,profilePicture(displayImage~:playableStreams,logoV2(original~digitalmediaAsset:playableStreams))))))", { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia[0].oauth_token } })

                                if (commentsThread.data && commentsThread.data.elements && commentsThread.data.elements.length > 0) {
                                    console.log("commentsThread.data.elements", commentsThread.data.elements)
                                    commentsThread.data.elements.forEach(threadData => {
                                        let threadObj = {}
                                        threadObj.replied = {}
                                        console.log("..............111111111111............................")
                                        let pageData = socialDoc.socialMedia[0].linkedinPages.filter(thread => {
                                            return comData.actor == thread.pageId
                                        })
                                        /*if (pageData.length == 0) {
                                            threadObj.replied.profileImage = threadData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier;
                                        }
                                        else {
                                            threadObj.replied.profileImage = pageData[0].pageImage;
                                        }*/

                                        if (threadData && threadData['actor~'] && threadData['actor~'].profilePicture && threadData['actor~'].profilePicture['displayImage~'] && threadData['actor~'].profilePicture['displayImage~'].elements &&
                                            threadData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0]?.identifier) {
                                            threadObj.replied.profileImage = threadData['actor~'].profilePicture['displayImage~'].elements[0].identifiers[0].identifier;
                                        }
                                        if (threadData.actor) {
                                            threadObj.replied.Id = threadData.actor;
                                        }

                                        console.log("......................222222222222222.....................................")

                                        threadObj.postDate = threadData.created.time;
                                        threadObj.message = threadData.message.text;
                                        threadObj.commentUrn = threadData.$URN;
                                        threadObj.commentId = threadData.id;
                                        threadObj.activity = threadData.object;
                                        //threadObj.pageId = userId;
                                        threadObj.like_count = 0;
                                        threadObj.reply_count = 0;
                                        threadObj.replied.name = threadData['actor~'].vanityName;
                                        if (threadData['actor~'].vanityName.includes("-")) {
                                            var textIndex = threadData['actor~'].vanityName.lastIndexOf("-");
                                            threadObj.replied.name = threadData['actor~'].vanityName.substring(0, textIndex);
                                        }
                                        console.log("....................333333333333333333333....................................")
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
                                                if (likeData.includes(companyId)) {
                                                    threadObj.likedByCurrentUser = true;
                                                    return
                                                }
                                            })
                                        }
                                        console.log("...................44444444444444.................................")
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

                    }
                    catch (error) {
                        console.log("error", JSON.stringify(error))
                        resolve({ comments: responseArr })
                    }
                })
            }

            let promiseArray = [];

            promiseArray.push(shareData());
            promiseArray.push(socialActionData());
            promiseArray.push(linkedinComments());

            Promise.all(promiseArray).then(resArr => {
                console.log("linkedin ress", JSON.stringify(resArr))


                let postInfo = {};
                postInfo.mediaUrl = []
                postInfo.userId = userId;
                postInfo.postStatus = "Success";
                postInfo.postId = postId;
                postInfo["linkObj"] = [];
                postInfo.mediaType = "text";
                postInfo.thumbnail = '';

                let postData = "";
                let comments = [];
                let public_metrics = {};
                public_metrics.like_count = 0;
                public_metrics.reply_count = 0;
                likedByCurrentUser = false;

                resArr.forEach(finalRes => {

                    if (finalRes.shareData) {
                        postData = decodeURI(finalRes.shareData?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary.text);
                        postInfo.postDate = finalRes.shareData.created.time;
                        postInfo.activity = finalRes.shareData.activity;
                        postInfo.pageId = finalRes.shareData.author;

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
                                    linkObject.display_url = mediaData.originalUrl;
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
                    
                    console.log("finalRes.socialActionData",JSON.stringify(finalRes.socialActionData));

                    if (finalRes.socialActionData) {
                        public_metrics.like_count = finalRes?.socialActionData?.likesSummary?.totalLikes ?? 0;
                        public_metrics.reply_count = finalRes?.socialActionData?.commentsSummary?.aggregatedTotalComments ?? 0;
                        likedByCurrentUser = finalRes?.socialActionData?.likesSummary?.likedByCurrentUser ?? false;
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
            })

        }
        catch (error) {
            done('401', {
                status: "LinkedIn data retrive failed",
                message: error.message
            });
        }
    }

    const retrieveTwitter = (savedDoc, email, postId, socialDoc, queryConst) => {
        const request = {
            url: 'https://api.twitter.com/2/tweets?ids=' + postId + '&tweet.fields=attachments,conversation_id,geo,public_metrics,referenced_tweets,source,text&media.fields=url,type',
            method: 'GET',
            body: {}
        }
        const authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia[0].oauth_token, socialDoc.socialMedia[0].oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
        axios.get('https://api.twitter.com/2/tweets?ids=' + postId + '&tweet.fields=attachments,conversation_id,geo,public_metrics,referenced_tweets,source,text&media.fields=url,type', { headers: authHeader }).then((res) => {

            axios.get('https://api.twitter.com/2/tweets/search/recent?query=conversation_id:' + postId + '&expansions=in_reply_to_user_id&tweet.fields=in_reply_to_user_id,author_id,created_at,conversation_id&user.fields=profile_image_url,username,name', { headers: { 'Authorization': 'Bearer ' + twitter_token } }).then((convRes) => {
                done('200', {
                    status: "Tweet Retrieved",
                    data: {
                        postStatus: savedDoc.postData.postStatus,
                        postData: savedDoc.postData.postData,
                        postInfo: savedDoc.postData[queryConst],
                        public_metrics: res.data[0].public_metrics,
                        conversations: convRes.data
                    }
                });
            }).catch((error) => {
                done('401', {
                    status: "Tweet Retrieve Failed",
                    message: error.message
                });
            });
        });
    }

    const retriveTwit = (socialDoc, userId, postId) => {

        try {
            let promiseArray = [];


            let tweetsData = async () => {
                return new Promise(async (resolve, reject) => {
                    let request = {
                        url: 'https://api.twitter.com/2/tweets?ids=' + postId + '&tweet.fields=entities,attachments,conversation_id,created_at,geo,public_metrics,referenced_tweets,source,text&expansions=attachments.media_keys,referenced_tweets.id&media.fields=url,type,preview_image_url',
                        method: 'GET',
                        body: {}
                    }

                    //let authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia[0].oauth_token, socialDoc.socialMedia[0].oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
                    let authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia[0].oauth_token, socialDoc.socialMedia[0].oauth_token_secret, CONSUMERKEY, CONSUMERSECRET);
                    axios.get(request.url, { headers: authHeader }).then((resp) => {
                        if (resp.data) {
                            resolve({ tweetsData: resp.data })
                        }
                        else {
                            resolve({ tweetsData: {} })
                        }
                    }).catch(err => {
                        resolve({ tweetsData: {} })
                    })
                });
            }

            let tweetLookup = async () => {
                return new Promise(async (resolve, reject) => {
                    let request1 = {
                        url: `https://api.twitter.com/1.1/statuses/lookup.json?id=${postId}`,
                        method: 'GET',
                        body: {}
                    }

                    //authHeader = AuthHelper.getAuthHeaderForRequest(request1, socialDoc.socialMedia[0].oauth_token, socialDoc.socialMedia[0].oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
                    let authHeader = AuthHelper.getAuthHeaderForRequest(request1, socialDoc.socialMedia[0].oauth_token, socialDoc.socialMedia[0].oauth_token_secret, CONSUMERKEY, CONSUMERSECRET);
                    axios.get(encodeURI(request1.url), { headers: authHeader }).then((res) => {
                        if (res.data) {
                            resolve({ tweetLookup: res.data })
                        }
                        else {
                            resolve({ tweetLookup: {} })
                        }
                    }).catch(err => {
                        resolve({ tweetLookup: {} })
                    })
                });
            }

            let tweetRecent = async () => {
                return new Promise(async (resolve, reject) => {
                    axios.get('https://api.twitter.com/2/tweets/search/recent?query=conversation_id:' + postId + '&expansions=in_reply_to_user_id,referenced_tweets.id,referenced_tweets.id.author_id,entities.mentions.username&tweet.fields=in_reply_to_user_id,author_id,created_at,conversation_id&user.fields=profile_image_url,username,name', {
                        headers: {
                            'Authorization': 'Bearer ' + twitter_token
                        }
                    }).then((result) => {
                        if (result.data) {
                            resolve({ tweetRecent: result.data });
                        }
                        else {
                            resolve({ tweetRecent: {} });
                        }
                    }).catch(err => {
                        resolve({ tweetRecent: {} });
                    })
                });
            }

            promiseArray.push(tweetsData());
            promiseArray.push(tweetLookup());
            promiseArray.push(tweetRecent());

            Promise.all(promiseArray).then(resArr => {
                let postInfo = {};
                let tweetText = '';
                let favorited = false;
                let retweeted = false;
                let public_metrics = {};
                let conversations = { "meta": { "result_count": 0 } };
                postInfo.mediaUrl = [];
                postInfo.mediaType = "text";
                postInfo.thumbnail = '';
                postInfo.linkObj = [];
                postInfo.geo_location = {};
                postInfo.place = {};
                postInfo.userId = userId;
                postInfo.postStatus = "Success";
                postInfo.postId = postId;
                postInfo.profileImage = socialDoc.socialMedia[0].userProfileImage;

                if (resArr[0].tweetsData.data) {
                    tweetText = resArr[0].tweetsData.data[0].text;
                    public_metrics = resArr[0].tweetsData.data[0].public_metrics;
                    postInfo.source = resArr[0].tweetsData.data[0].source;
                    postInfo.postDate = resArr[0].tweetsData.data[0].created_at;
                    if (resArr[0].tweetsData.data[0].entities && resArr[0].tweetsData.data[0].entities.urls && resArr[0].tweetsData.data[0].entities.urls.length > 0) {
                        resArr[0].tweetsData.data[0].entities.urls.forEach(urlsData => {
                            let linkObject = {};
                            if (urlsData.title) {
                                postInfo['mediaType'] = "link";
                                linkObject.description = urlsData.description ? urlsData.description : '';
                                linkObject.title = urlsData.title ? urlsData.title : '';
                                console.log("urlsData", JSON.stringify(urlsData));
                                if (urlsData.images && urlsData.images[1] && urlsData.images[1].url) {
                                    linkObject.imageUrl = urlsData.images[1].url;
                                    postInfo["thumbnail"] = urlsData.images[1].url;
                                }
                                else {
                                    linkObject.imageUrl = '';
                                }
                                linkObject.targetUrl = urlsData.expanded_url ? urlsData.expanded_url : urlsData.url ? urlsData.url : '';
                                //linkObject.expanded_url = urlsData.expanded_url ? urlsData.expanded_url : '';
                                linkObject.display_url = urlsData.display_url ? urlsData.display_url : '';
                                postInfo["linkObj"].push(linkObject)
                            }
                        });
                    }
                }
                if (resArr[0].tweetsData.data[0].text.includes('https://t.co')) {
                    var textIndex = resArr[0].tweetsData.data[0].text.lastIndexOf(" ");
                    tweetText = resArr[0].tweetsData.data[0].text.substring(0, textIndex)
                }
                if (tweetText.includes(":")) {
                    let splitText = tweetText.split(":");
                    if (splitText[0] && splitText[0].includes('RT')) {
                        tweetText = tweetText.split(/:(.+)/)[1].trim()
                    }
                }
                if (resArr[1].tweetLookup) {
                    /*if (resArr[1].tweetLookup[0].entities && resArr[1].tweetLookup[0].entities.urls && resArr[1].tweetLookup[0].entities.urls.length > 0) {
                        postInfo['mediaType'] = "link";
                        //tweetObj["thumbnail"] = '';
                    }*/
                    if (resArr[1].tweetLookup[0].extended_entities && resArr[1].tweetLookup[0].extended_entities.media && resArr[1].tweetLookup[0].extended_entities.media.length > 0) {
                        console.log("resArr[1].tweetLookup[0].extended_entities.media", JSON.stringify(resArr[1].tweetLookup[0].extended_entities.media))
                        // postInfo.mediaUrl = resArr[1].tweetLookup[0].extended_entities.media.map(mediaImg => { return mediaImg.media_url })

                        if (resArr[1].tweetLookup[0].extended_entities.media[0].type == 'photo') {
                            postInfo['mediaType'] = 'image'
                            //postInfo["mediaUrl"] = [resArr[1].tweetLookup[0].extended_entities.media[0].media_url]
                            postInfo["mediaUrl"] = resArr[1].tweetLookup[0].extended_entities.media.map(mediaImg => { return mediaImg.media_url })
                            //tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url;
                        }
                        else if (resArr[1].tweetLookup[0].extended_entities.media[0].type == 'video' || resArr[1].tweetLookup[0].extended_entities.media[0].type == 'animated_gif') {
                            postInfo['mediaType'] = 'video';

                            //console.log('[resArr[1].tweetLookup[0].extended_entities.media[0]...',resArr[1].tweetLookup[0].extended_entities.media[0])
                            if (resArr[1].tweetLookup[0].extended_entities.media[0].video_info?.variants[0]?.content_type == "video/mp4") {
                                postInfo["mediaUrl"] = [resArr[1].tweetLookup[0].extended_entities.media[0].video_info.variants[0].url];
                                postInfo["thumbnail"] = resArr[1].tweetLookup[0].extended_entities.media[0].media_url;
                                console.log("............................")
                            }
                            else if (resArr[1].tweetLookup[0].extended_entities.media[0].video_info?.variants[1]?.content_type == "video/mp4") {
                                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
                                postInfo["mediaUrl"] = [resArr[1].tweetLookup[0].extended_entities.media[0].video_info.variants[1].url];
                                postInfo["thumbnail"] = resArr[1].tweetLookup[0].extended_entities.media[0].media_url;
                            }

                        }
                    }
                    /*if (resArr[1].tweetLookup[0].entities.urls && resArr[1].tweetLookup[0].entities.urls.length > 0) {
                        postInfo.linkObj = resArr[1].tweetLookup[0].entities.urls.map(urlsData => {
                            delete urlsData["indices"];
                            return urlsData
                        })
                    }*/
                    if (resArr[1].tweetLookup[0].geo && resArr[1].tweetLookup[0].geo.coordinates) {
                        postInfo.geo_location.lng = resArr[1].tweetLookup[0].geo.coordinates[1];
                        postInfo.geo_location.lat = resArr[1].tweetLookup[0].geo.coordinates[0];
                    }
                    if (resArr[1].tweetLookup[0].place) {
                        if (resArr[1].tweetLookup[0].place.country) {
                            postInfo.place.country = resArr[1].tweetLookup[0].place.country;
                        }
                        if (resArr[1].tweetLookup[0].place.country_code) {
                            postInfo.place.country_code = resArr[1].tweetLookup[0].place.country_code;
                        }
                        if (resArr[1].tweetLookup[0].place.full_name) {
                            postInfo.place.full_name = resArr[1].tweetLookup[0].place.full_name;
                        }
                        if (resArr[1].tweetLookup[0].place.name) {
                            postInfo.place.name = resArr[1].tweetLookup[0].place.name;
                        }
                        if (resArr[1].tweetLookup[0].place.place_type) {
                            postInfo.place.place_type = resArr[1].tweetLookup[0].place.place_type;
                        }
                    }
                    
                    console.log("resArr[1].tweetLookup[0]",JSON.stringify(resArr[1].tweetLookup[0]));

                    favorited = resArr[1].tweetLookup[0].favorited;
                    retweeted = resArr[1].tweetLookup[0].retweeted;
                    if (resArr[1]?.tweetLookup[0]?.retweeted_status) {
                        favorited = resArr[1].tweetLookup[0].retweeted_status.favorited;
                        retweeted = resArr[1].tweetLookup[0].retweeted_status.retweeted;
                        public_metrics.like_count = resArr[1].tweetLookup[0].retweeted_status.favorite_count;
                        public_metrics.retweet_count = resArr[1].tweetLookup[0].retweeted_status.retweet_count;
                        
                    }
                }
                if (resArr[2].tweetRecent && resArr[2].tweetRecent.data) {
                    //conversations = resArr[2].tweetRecent.data;
                    conversations = resArr[2].tweetRecent.data.map(comment => {
                        let replied = {};
                        if (resArr[2].tweetRecent.includes.users) {
                            resArr[2].tweetRecent.includes.users.forEach(profile => {
                                if (comment.author_id == profile.id) {
                                    replied.name = profile.name;
                                    replied.profileImage = profile.profile_image_url;
                                }
                            })
                        }
                        comment.replied = replied;
                        return comment;
                    })
                }

                done('200', {
                    status: "Tweet Retrieved",
                    data: {
                        //rep: res.data[0],
                        //resp: resp.data,
                        postStatus: "Posted",
                        postData: tweetText,
                        postInfo: postInfo,
                        public_metrics: public_metrics,
                        "favorited": favorited,
                        "retweeted": retweeted,
                        conversations: conversations
                        //conversations: { "meta": { "result_count": 0 } }
                    }
                });
            });
        }
        catch (error) {
            done('401', {
                status: "Twitter data retrive failed",
                message: error.message
            });
        }
    }

    const retrieveYoutube = (socialDoc, userId, postId) => {
        try {

            console.log("socialDoc", JSON.stringify(socialDoc))

            const reconnectGoogle = (refreshtoken) => {
                console.log("refreshtoken", refreshtoken);

                return new Promise(async (resolve, reject) => {
                    //const requestBody = `client_secret=${client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${client_id}`;
                    const requestBody = `client_secret=${googleClientSecret}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${googleClientId}`;
                    const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                    try {
                        let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                        console.log("res....", JSON.stringify(result.data.access_token))
                        resolve(result.data.access_token)
                    }
                    catch (error) {
                        console.log("error", JSON.stringify(error.message))
                        reject({ 'token': 'Failed' })
                    }
                })
            };

            reconnectGoogle(socialDoc.socialMedia[0].refresh_token).then(token => {
                console.log("token..........", JSON.stringify(token));
                let promiseArray = [];


                const getVideoRatingDetails = () => {
                    return new Promise(async (resolve, reject) => {

                        let url = `https://www.googleapis.com/youtube/v3/videos/getRating?id=${postId}&part=statistics&access_token=${token}`;
                        try {
                            let rating = await axios.get(url, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            console.log("rating....", JSON.stringify(rating.data))
                            resolve(rating.data)
                        }
                        catch (error) {
                            console.log("..........getVideoRatingDetails.................")
                            console.log("error", JSON.stringify(error.message))
                            resolve({})

                        }

                    });
                };

                const video = () => {
                    return new Promise(async (resolve, reject) => {

                        let url = `https://www.googleapis.com/youtube/v3/videos?id=${postId}&access_token=${token}&part=snippet,status,statistics`;
                        try {
                            let videos = await axios.get(url, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            //console.log("videos....", JSON.stringify(videos.data))
                            resolve(videos.data)
                        }
                        catch (error) {
                            console.log("..........video.................")
                            console.log("error", JSON.stringify(error.message))
                            resolve({})

                        }

                    });
                };

                let youtubeComments = async () => {
                    return new Promise(async (resolve, reject) => {
                        let url = `https://youtube.googleapis.com/youtube/v3/commentThreads?part=id,replies,snippet&order=relevance&videoId=${postId}&access_token=${token}`;
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
                                }
                                else {
                                    resObj.commentsThread = []
                                }

                                responseArr.push(resObj)


                            });

                            //resolve(commentsData.data)
                            resolve({ comments: responseArr })
                        }
                        catch (error) {
                            console.log("..........comments.................")
                            console.log("error", JSON.stringify(error))
                            resolve({ comments: responseArr })

                        }
                    })
                }


                promiseArray.push(getVideoRatingDetails());
                promiseArray.push(video());
                promiseArray.push(youtubeComments());


                Promise.all(promiseArray).then((post) => {
                    console.log("post", post)
                    if (post && post.length > 0 && post[1]?.items && post[1]?.items.length > 0) {

                        let postInfo = {};
                        let titileText = '';
                        // let favorited = false;
                        let comments = [];
                        let public_metrics = {};

                        let conversations = { "meta": { "result_count": 0 } };
                        postInfo.mediaUrl = [];
                        postInfo.mediaType = 'video';
                        postInfo.linkObj = [];
                        postInfo.geo_location = {};
                        postInfo.mediaType = "video";
                        postInfo.place = {};
                        postInfo.userId = socialDoc.socialMedia[0].userId;
                        postInfo.postStatus = "Success";
                        postInfo.postDate = post[1].items[0].snippet.publishedAt;
                        postInfo.postId = post[1]?.items[0]?.id;
                        postInfo.profileImage = socialDoc.socialMedia[0].userProfileImage ? socialDoc.socialMedia[0].userProfileImage : '';

                        console.log("post[1].items[0].snippet", post[1].items[0].snippet)

                        postInfo.thumbnail = post[1].items[0].snippet.thumbnails?.standard?.url ?? post[1].items[0].snippet.thumbnails?.default?.url;
                        postInfo.mediaUrl.push(`https://www.youtube.com/embed/${post[1].items[0].id}`);

                        public_metrics.viewCount = post[1].items[0].statistics.viewCount;
                        public_metrics.like_count = post[1].items[0].statistics.likeCount;
                        public_metrics.dislikeCount = post[1].items[0].statistics.dislikeCount;
                        public_metrics.commentCount = post[1].items[0].statistics.commentCount;
                        public_metrics.favoriteCount = post[1].items[0].statistics.favoriteCount;

                        console.log("post[1].items[0].statistics", post[1].items[0].statistics)


                        /*  if (post[0].items[0].rating == 'none') {
                             favorited = false
                         }
                         else {
                             favorited = true;
                         } */
                        let favorited = post[0].items[0].rating;


                        if (post[2] && post[2].comments && post[2].comments.length > 0) {
                            comments = post[2].comments
                        }

                        done('200', {
                            status: "Video Details Retrieved",
                            data: {
                                postStatus: "Posted",
                                postData: titileText,
                                postInfo: postInfo,
                                public_metrics: public_metrics,
                                "favorited": favorited,
                                conversations: comments
                            }
                        });
                    }
                    else {
                        done('401', {
                            status: false,
                            message: "Youtube data retrive failed"
                        });
                    }


                }).catch(error => {
                    done('401', {
                        status: "Youtube data retrive failed",
                        message: error.message
                    });
                });

            }).catch(error => {
                done('401', {
                    status: "Youtube data retrive failed",
                    message: error.message
                });
            });
        }
        catch (error) {
            done('401', {
                status: "Youtube data retrive failed",
                message: error.message
            });
        }
    }

    const retrieveGmb = (socialDoc, userId, postId, locationId) => {
        try {

            console.log("socialDoc", JSON.stringify(socialDoc))

            const reconnectGoogle = (refreshtoken) => {
                console.log("refreshtoken", refreshtoken);

                return new Promise(async (resolve, reject) => {
                    //const requestBody = `client_secret=${client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${client_id}`;
                const requestBody = `client_secret=${googleClientSecret}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${googleClientId}&redirect_uri=${googleRedirctUrl}`;
                const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                    try {
                        console.log("reqUrl",reqUrl)
                        console.log("requestBody",requestBody)
                        let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                        console.log("res....", JSON.stringify(result.data.access_token))
                        resolve(result.data.access_token)
                    }
                    catch (error) {
                        console.log("error", JSON.stringify(error.message))
                        reject({ 'token': 'Failed' })
                    }
                })
            };

            reconnectGoogle(socialDoc.socialMedia[0].refresh_token).then(token => {
                console.log("token..........", JSON.stringify(token));

                let promiseArray = [];

                const getPost = () => {
                    return new Promise(async (resolve, reject) => {

                        let url = `https://mybusinessaccountmanagement.googleapis.com/v4/accounts/${userId}/locations/${locationId}/localPosts/${postId}`;
                        try {
                            console.log("url",url)
                            let postDetail = await axios.get(url, { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Bearer ' + token  } });
                            console.log("rating....", JSON.stringify(postDetail.data))
                            resolve(postDetail.data)
                            //resolve({})
                        }
                        catch (error) {
                            console.log("..........getVideoRatingDetails.................")
                            console.log("error", JSON.stringify(error.message))
                            resolve({})

                        }

                    });
                };

                const getMetric = () => {
                    return new Promise(async (resolve, reject) => {
                        let endDate = new Date();
                        let nowDate = new Date();
                        let startDate = new Date(nowDate.setFullYear(nowDate.getFullYear() - 1));

                        let url = `https://mybusiness.googleapis.com/v4/accounts/${userId}/locations/${locationId}/localPosts:reportInsights`;
                        let requestBody = {
                            "localPostNames": [
                                `accounts/${userId}/locations/${locationId}/localPosts/${postId}`
                            ],
                            "basicRequest": {
                                "metricRequests": [
                                    {
                                        "metric": "ALL"
                                    }
                                ],
                                "timeRange": {
                                    "startTime": startDate,
                                    "endTime": endDate
                                }
                            }
                        }

                        try {
                            let getMetric = await axios.post(url, requestBody, { headers: { 'Authorization': 'Bearer ' + token } });
                            console.log("getMetric....", JSON.stringify(getMetric.data))
                            resolve(getMetric.data)
                            //resolve({})
                        }
                        catch (error) {
                            console.log(" getMetric....error.....", JSON.stringify(error.message))
                            resolve({})
                        }
                    });
                };

                promiseArray.push(getPost());
                promiseArray.push(getMetric());

                Promise.all(promiseArray).then((post) => {
                    console.log("post", post)
                    /* done('200',{
                        data: post
                    }) */
                    if (post && post.length > 0 && Object.keys(post[0]).length !== 0) {
                        console.log("..........insdie the post...........")

                        let postInfo = {};
                        let titileText = '';
                        // let favorited = false;
                        let comments = [];
                        let public_metrics = {};
                        public_metrics.viewCount = 0;
                        public_metrics.clickCount = 0;

                        postInfo.mediaUrl = [];
                        postInfo.mediaType = 'text';
                        postInfo.linkObj = [];
                        //postInfo.geo_location = {};
                        //postInfo.place = {};
                        postInfo.userId = socialDoc.socialMedia[0].userId;
                        postInfo.postId = postId;
                        postInfo.locationId = socialDoc.socialMedia[0].locationId;
                        postInfo.postStatus = "Success";
                        postInfo.profileImage = socialDoc.socialMedia[0].userProfileImage ? socialDoc.socialMedia[0].userProfileImage : '';

                        //titileText = post[0]?.summary;
                        titileText = post[0]?.summary.replace(/\n/g, '');
                        console.log(".........titileText.............",titileText)
                        postInfo.postUrl = post[0]?.searchUrl;
                        postInfo.postDate = post[0].createTime;
                        postInfo["topicType"] = "";
                            if (post[0]?.topicType) {
                              postInfo["topicType"] = post[0]?.topicType
                            }

                            if (post[0]?.callToAction) {
                              postInfo["actionType"] = post[0]?.callToAction?.actionType
                              postInfo["buttonUrl"] = post[0]?.callToAction?.url
                            }

                        if (post[0].media && post[0].media.length > 0) {
                            post[0].media.forEach(medFile => {
                                if (medFile.mediaFormat == 'PHOTO') {
                                    postInfo.mediaType = 'image';
                                } else if (medFile.mediaFormat == 'VIDEO') {
                                    postInfo.mediaType = 'video';
                                }
                                postInfo.mediaUrl.push(medFile.googleUrl);
                            });
                            postInfo.thumbnail = post[0].media[0]?.googleUrl ?? '';
                        }

                        if (post[1]?.localPostMetrics?.length > 0 && post[1]?.localPostMetrics[0]?.metricValues?.length > 0) {
                            console.log("...........metrics...............")
                            post[1].localPostMetrics[0].metricValues.forEach(postMetric => {
                                if (postMetric.metric === "LOCAL_POST_VIEWS_SEARCH") {
                                    public_metrics.viewCount = Number(postMetric.totalValue.value)
                                    console.log("public_metrics.viewCount",public_metrics.viewCount)
                                }
                                if (postMetric.metric === "LOCAL_POST_ACTIONS_CALL_TO_ACTION") {
                                    public_metrics.clickCount = Number(postMetric.totalValue.value)
                                    console.log("public_metrics.viewCount",public_metrics.clickCount)
                                }
                            });
                        }

                        done('200', {
                            status: "GMB Details Retrieved",
                            data: {
                                postStatus: "Posted",
                                postData: titileText,
                                postInfo: postInfo,
                                public_metrics: public_metrics,
                                conversations: comments
                            }
                        });
                    }
                    else {
                        done('401', {
                            status: false,
                            message: "GMB data retrive failed"
                        });
                    }


                }).catch(error => {
                    done('401', {
                        status: "GMB data retrive failed",
                        message: error.message
                    });
                });

            }).catch(error => {
                done('401', {
                    status: "GMB data retrive failed",
                    message: error.message
                });
            });
        }
        catch (error) {
            done('401', {
                status: "GMB data retrive failed",
                message: error.message
            });
        }
    }

    const retrieveIntstagram = async (socialDoc, userId, postId) => {

        console.log("retrieveIntstagram")
        let promiseArray = [];
        const instagram = () => {
            return new Promise(async (resolve, reject) => {
                //const url = 'https://graph.facebook.com/' + postId + '?access_token=' + socialDoc.socialMedia[0].oauth_token + `&fields=media_url,like_count,comments_count,ig_id,media_type,caption,username,timestamp,shortcode,comments,is_comment_enabled,video_title,thumbnail_url,owner,media_product_type,id,permalink,children`;
                const url = 'https://graph.facebook.com/' + postId + '?access_token=' + socialDoc.socialMedia[0].oauth_token + `&fields=media_url,like_count,comments_count,ig_id,media_type,caption,username,timestamp,shortcode,comments,is_comment_enabled,video_title,thumbnail_url,owner,media_product_type,id,permalink,children{media_url,thumbnail_url}`;
                try {
                    let instadata = await axios.get(url);
                    //console.log("instadata....", JSON.stringify(instadata.data))
                    resolve(instadata.data)
                }
                catch (error) {
                    console.log("error", JSON.stringify(error.message))

                }
            });

        };


        const instacomments = () => {
            return new Promise(async (resolve, reject) => {
                const url = 'https://graph.facebook.com/' + postId + '/comments?access_token=' + socialDoc.socialMedia[0].oauth_token + `&fields=id,timestamp,from,text,media,user,username,replies.limit(10){media,id,like_count,from,text,timestamp,parent_id,user,username}`;
                try {
                    var responseArr = []
                    let commentsData = await axios.get(url);
                    //console.log("coments................", JSON.stringify(commentsData.data))
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
                        }
                        else {
                            resObj.commentsThread = []
                        }

                        responseArr.push(resObj)


                    });

                    //resolve(commentsData.data)

                    resolve({ comments: responseArr })
                }
                catch (error) {
                    console.log("error", JSON.stringify(error.message))

                }

            });

        };


        promiseArray.push(instagram());
        promiseArray.push(instacomments());
        Promise.all(promiseArray).then((igdata) => {
            console.log("igdata..........",JSON.stringify(igdata))
            var postInfo = {};
            var public_metrics = {};
            let comments = [];
            public_metrics['like'] = igdata[0].like_count;
            postInfo['mediaUrl'] = igdata[0].media_url ? [igdata[0].media_url] : []
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
        /*  let convRes = await axios.get('https://graph.facebook.com/' + postId + '?access_token=' + socialDoc.socialMedia[0].oauth_token + `&fields=media_url,like_count,comments_count,ig_id,media_type,caption,username,timestamp,shortcode,comments,is_comment_enabled,video_title,thumbnail_url,owner,media_product_type,id,permalink,children`);

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

    switch (event.httpMethod) {
        case 'POST':
            console.log('POST Schedule tweet Called')
            var body = JSON.parse(event.body);

            context.callbackWaitsForEmptyEventLoop = false;
            if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
                event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
                if (email && email !== '') {

                    if (!body.socialMedia) {
                        done('422', {
                            status: 'Social Media Name is required',
                            data: body
                        });
                        return;
                    }
                    if (!body.postId) {
                        done('422', {
                            status: 'PostId is required',
                            data: body
                        });
                        return;
                    }
                    if (!body.userId) {
                        done('422', {
                            status: 'UserId is required',
                            data: body
                        });
                        return;
                    }
                    const socialMedia = body.socialMedia;
                    const postId = body.postId;
                    const userId = body.userId;

                    console.log(postId)
                    console.log(socialMedia)
                    connectorMongodb.then(() => {
                        /*if (socialMedia === 'twitter' || socialMedia === 'linkedin') {
                            const mdQueryRet = { 'email': { $regex: new RegExp("^" + email, "i") }, 'socialMedia.name': socialMedia, 'socialMedia.userId': userId };
                            socialModel.findOne(mdQueryRet, { _id: 0, socialMedia: { $elemMatch: { name: socialMedia, userId: userId } } })
                                .exec(function (err, socialDoc) {
                                    if (socialMedia === 'twitter') {
                                        retriveTwit(socialDoc, userId, postId);
                                    } else if (socialMedia === 'linkedin') {
                                        retrieveLinkedIn(socialDoc, userId, postId);
                                    }
                                });
                        } else if (socialMedia === 'facebook') {
                            let pageid = ""
                            if (body.pageId) {
                                pageid = body.pageId
                            } else {
                                if (body.postId.includes('_')) {
                                    let splitPostId = body.postId.split("_");
                                    pageid = splitPostId[0]
                                }
                            }

                            socialModel.aggregate(
                                [{ "$match": { email: email } },
                                { "$unwind": "$socialMedia" },
                                { "$match": { "socialMedia.name": "facebook", 'socialMedia.userId': body.userId } },
                                { "$unwind": "$socialMedia.fbpages" },
                                { "$match": { "socialMedia.fbpages.id": pageid } },
                                { "$project": { _id: 0, "pageToken": "$socialMedia.fbpages.access_token", "pageId": "$socialMedia.fbpages.id", "userId": "$socialMedia.userId", "pageName": "$socialMedia.fbpages.name", "type": "$socialMedia.fbpages.type" } }
                                ]
                            ).exec(function (err, socialdoc) {
                                console.log("socialdoc",JSON.stringify(socialdoc))
                                if (socialdoc && socialdoc[0]) {
                                    //retrieveFacebook(doc[0], email, postId, socialdoc[0], queryConst);
                                    retrieveFacebook(postId, userId, socialdoc[0]);
                                } else {
                                    done('400', {
                                        status: "Social Media Not Available",
                                    });
                                }
                            });

                        } else {
                            done('200', {
                                status: "Incorrect Social Media key provided",
                            });
                        }*/

                        switch (socialMedia) {
                            case 'twitter':
                            case 'linkedin':
                            case 'youtube':
                            case 'googlemybusiness':
                            case 'instagram':
                                const mdQueryRet = { 'email': { $regex: new RegExp("^" + email, "i") }, 'socialMedia.name': socialMedia, 'socialMedia.userId': userId };
                                let elemMatchQry = { name: socialMedia, userId: userId };

                                if (socialMedia === 'googlemybusiness') {
                                    if (!body.locationId) {
                                        done('422', {
                                            status: 'locationId is required',
                                            data: body
                                        });
                                        return;
                                    }
                                    elemMatchQry.locationId = body.locationId;
                                    mdQueryRet['socialMedia.locationId'] = body.locationId;
                                }
                                console.log("mdQueryRet", JSON.stringify(mdQueryRet))
                                console.log("elemMatchQry", JSON.stringify(elemMatchQry))
                                socialModel.findOne(mdQueryRet, { _id: 0, socialMedia: { $elemMatch: elemMatchQry } })
                                    .exec(function (err, socialDoc) {
                                        switch (socialMedia) {
                                            case 'twitter':
                                                retriveTwit(socialDoc, userId, postId);
                                                break;
                                            case 'linkedin':
                                                retrieveLinkedIn(socialDoc, userId, postId);
                                                break;
                                            case 'youtube':
                                                retrieveYoutube(socialDoc, userId, postId);
                                                break;
                                            case 'googlemybusiness':
                                                retrieveGmb(socialDoc, userId, postId, body.locationId);
                                                break;
                                            case "instagram":
                                                retrieveIntstagram(socialDoc, userId, postId);
                                                break;
                                            default:
                                                break;
                                        }
                                        /* if (socialMedia === 'twitter') {
                                            retriveTwit(socialDoc, userId, postId);
                                        } else if (socialMedia === 'linkedin') {
                                            retrieveLinkedIn(socialDoc, userId, postId);
                                        } */
                                    });

                                break;
                            case 'facebook':
                                let pageid = ""
                                if (body.pageId) {
                                    pageid = body.pageId
                                }
                                else {
                                    if (body.postId.includes('_')) {
                                        let splitPostId = body.postId.split("_");
                                        pageid = splitPostId[0]
                                    }
                                }

                                socialModel.aggregate(
                                    [{ "$match": { email: email } },
                                    { "$unwind": "$socialMedia" },
                                    { "$match": { "socialMedia.name": "facebook", 'socialMedia.userId': body.userId } },
                                    { "$unwind": "$socialMedia.fbpages" },
                                    { "$match": { "socialMedia.fbpages.id": pageid } },
                                    { "$project": { _id: 0, "pageToken": "$socialMedia.fbpages.access_token", "pageId": "$socialMedia.fbpages.id", "userId": "$socialMedia.userId", "pageName": "$socialMedia.fbpages.name", "type": "$socialMedia.fbpages.type" } }
                                    ]
                                ).exec(function (err, socialdoc) {
                                    console.log("socialdoc", JSON.stringify(socialdoc))
                                    if (socialdoc && socialdoc[0]) {
                                        //retrieveFacebook(doc[0], email, postId, socialdoc[0], queryConst);
                                        retrieveFacebook(postId, userId, socialdoc[0]);
                                    }
                                    else {
                                        done('400', {
                                            status: "Social Media Not Available",
                                        });
                                    }
                                });
                                break;
                            default:
                                done('200', {
                                    status: "Incorrect Social Media key provided",
                                });
                                break;
                        }
                    },
                        (err) => { console.log('Connection Error'); });
                }

            }
            else {
                done('403', {
                    status: "Unauthorized"
                });
            }

            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
