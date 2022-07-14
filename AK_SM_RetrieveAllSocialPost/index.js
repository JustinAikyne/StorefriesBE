var mongoose = require('mongoose');
var axios = require('axios');
var ScheduledData = require('./ScheduledData.js');
var DraftData = require('./DraftData.js');
var AuthHelper = require('./AuthHelper.js');
var socialModel = require('./SocialModel.js');
var userModel = require('./userModel.js');
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
  const CONSUMERKEY = event.stageVariables['Twitter_ConsumerKey'];
  const CONSUMERSECRET = event.stageVariables['Twitter_ConsumerSecret'];
  var google_client_id = event.stageVariables['Google_ClientId'];
  var google_client_secrets = event.stageVariables['Google_ClientSecret'];
  var google_redirect_uri = event.stageVariables['Manage_ProfilePage'];

  console.log("process.env", CONSUMERKEY)
  console.log("CONSUMERSECRET.env", CONSUMERSECRET)

  switch (event.httpMethod) {
    case 'POST':
      console.log('GET ALL social Post Called')

      context.callbackWaitsForEmptyEventLoop = false;
      if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
        event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

        const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
        const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
        if (email && email !== '') {
          var body = JSON.parse(event.body);
          console.log("body", JSON.stringify(body));
          const showDraft = (body['draft'] === "true") || false;
          const showPublished = (body['publised'] === "true") || false;
          const showScheduled = (body['scheduled'] === "true") || false;

          console.log(showDraft + '::' + showPublished + '::' + showScheduled)
          const promiseArray = [];
          connectorMongodb.then(async () => {

            let responseArr = [];
            let draftData = [];
            let scheduledData = [];
            const data = {};

            //try {

            //userModel = await userModel.aggregate([{ $match: { 'userId': email } }]);
            let userData1 = await userModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } });
            let subscriptionData = await subscriptionModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } });
            //data['is_CalendarViewAllowed'] = features.is_CalendarViewAllowed
            if (subscriptionData && subscriptionData.status == 'cancelled') {
              done('200', {
                message: `Your Subscription has been cancelled, Please active your Subscription`,
                status: false,
                data: {}
              });
              return;
            }
            if (showDraft) {
              //promiseArray.push(DraftData.aggregate([{ $match: { 'userId': email } }, { $unwind: '$draftPost' }, { $sort: { 'draftPost.createdTime': -1 } }]));
              draftData = await DraftData.aggregate([{ $match: { 'userId': email } }, { $unwind: '$draftPost' }, { $sort: { 'draftPost.createdTime': -1 } }]);

              draftData = draftData.sort(function (a, b) {
                var dateA = new Date(a.draftPost.createdTime).getTime();
                var dateB = new Date(b.draftPost.createdTime).getTime();
                return dateA < dateB ? 1 : -1;
              });
              data['drafts'] = draftData;
            }

            /* if (showScheduled) {
              if (userData.features.is_CalendarViewAllowed) {
              //promiseArray.push(ScheduledData.aggregate([{ $match: { 'userId': email } }, { $unwind: '$scheduledPost' }, { $sort: { 'scheduledPost.createdTime': -1 } }]));
              scheduledData = await ScheduledData.aggregate([{ $match: { 'userId': email } }, { $unwind: '$scheduledPost' }, { $sort: { 'scheduledPost.createdTime': -1 } }]);
              data['scheduled'] = scheduledData;
              } else {
              done('200', {
                status: "You are not allowed to see Calendar View, If you need access calendar Upgrade your Subscription",
    	
              })
              return;
              }
            } */

            if (showScheduled) {
              //promiseArray.push(ScheduledData.aggregate([{ $match: { 'userId': email } }, { $unwind: '$scheduledPost' }, { $sort: { 'scheduledPost.createdTime': -1 } }]));
              scheduledData = await ScheduledData.aggregate([{ $match: { 'userId': email } }, { $unwind: '$scheduledPost' }, { $sort: { 'scheduledPost.scheduleTime': 1 } }]);
              data['scheduled'] = scheduledData;
            }

            if (showPublished) {
              console.log(".........................................................................")
              var tweetData = [];
              var linkedInData = [];
              //var linkedInDataArr = [];
              var fbDataArr = [];
              var fbpost = [];
              var mediaData = [];
              var query = []
              query = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }, { $unwind: "$socialMedia" }];

              var twitterPagenation = [];

              const twitterPost = async (email, socialDoc) => {
                console.log("..............twitter..................")

                let timeLine = "user";
                var url = ''

                var count = 10;
                if (body && body['count']) {
                  count = body['count']
                }

                let queryStringParameters = "";
                if (twitterPagenation && twitterPagenation.length > 0) {
                  let pagingObj = twitterPagenation.find(obj => obj.id == socialDoc.socialMedia.userId)
                  if (pagingObj.previous) {
                    queryStringParameters = "&since_id=" + pagingObj.previous;
                  }
                  if (pagingObj.next) {
                    queryStringParameters = "&max_id=" + pagingObj.next;
                  }
                  count = count + 1;
                }

                if (body && body['timeLine']) {
                  timeLine = body['timeLine'];
                }
                if (timeLine == 'mention') {
                  url = "https://api.twitter.com/1.1/statuses/mentions_timeline.json?count=" + count + queryStringParameters
                }
                else if (timeLine == 'home') {
                  url = "https://api.twitter.com/1.1/statuses/home_timeline.json?count=" + count + queryStringParameters

                }
                else {
                  url = "https://api.twitter.com/1.1/statuses/user_timeline.json?count=" + count + queryStringParameters
                }
                const request = {
                  url: url,
                  method: 'GET',
                  body: {}
                }
                console.log("request.url", request.url)
                //const authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia.oauth_token, socialDoc.socialMedia.oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
                const authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia.oauth_token, socialDoc.socialMedia.oauth_token_secret, CONSUMERKEY, CONSUMERSECRET);
                console.log("authHeader", authHeader)
                try {
                  var res = await axios.get(encodeURI(request.url), { headers: authHeader })

                  if (res && res.data && res.data.length > 0) {
                    if (twitterPagenation && twitterPagenation.length > 0) {
                      res.data.shift();
                    }
                    let fromDate = ""
                    let endDate = ""
                    if (body && body.fromDate) {
                      fromDate = new Date(parseInt(body.fromDate)).toISOString()
                    }
                    else {

                      var today = new Date();
                      var monthDate = new Date(today.getFullYear(), today.getMonth(), 1);
                      endDate = monthDate.toString()
                      fromDate = new Date(endDate);
                    }
                    res.data.forEach(resp => {
                      if (new Date(fromDate) < new Date(resp.created_at)) {
                        let resObj = {};
                        let tweetObj = {};
                        resObj.postData = {};
                        resObj.postData.tweetData = [];
                        resObj['createdAt'] = resp.created_at;
                        tweetObj['postStatus'] = "Posted";
                        tweetObj['postDate'] = resp.created_at;
                        tweetObj['screen_name'] = resp.user.screen_name;
                        tweetObj['source'] = resp.source;
                        tweetObj['mediaType'] = "text";
                        tweetObj["thumbnail"] = '';
                        tweetObj["mediaUrl"] = [];
                        tweetObj['userId'] = resp.user.id_str;
                        tweetObj["postId"] = resp.id_str;
                        resObj['userId'] = email;
                        resObj['postId'] = resp.id_str;
                        resObj.postData['linkedInData'] = linkedInData;
                        resObj.postData['fbpost'] = fbpost;
                        resObj.postData['postTime'] = resp.created_at;
                        resObj.postData['postStatus'] = "Posted";
                        resObj.postData['postData'] = resp.text;
                        if (resp.entities && resp.entities.urls && resp.entities.urls.length > 0) {
                          tweetObj['mediaType'] = "link";
                          //tweetObj["thumbnail"] = '';
                        }
                        if (resp.extended_entities) {
                          if (resp.extended_entities.media && resp.extended_entities.media.length > 0) {
                            tweetObj['mediaType'] = resp.extended_entities.media[0].type;


                            if (resp.extended_entities.media[0].type == 'photo') {
                              tweetObj['mediaType'] = 'image'
                              tweetObj["mediaUrl"] = [resp.extended_entities.media[0].media_url]
                              //tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url;
                            }
                            else if (resp.extended_entities.media[0].type == 'video' || resp.extended_entities.media[0].type == 'animated_gif') {
                              tweetObj['mediaType'] = 'video';
                              if (resp.extended_entities.media[0]?.video_info?.variants[0]?.content_type == "video/mp4") {
                                tweetObj["mediaUrl"] = [resp.extended_entities.media[0].video_info.variants[0].url];
                                tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url
                              }
                              else if (resp.extended_entities.media[0]?.video_info?.variants[1]?.content_type == "video/mp4") {
                                tweetObj["mediaUrl"] = [resp.extended_entities.media[0].video_info.variants[1].url]
                                tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url;
                              }
                            }

                            if (resp.text.includes("https://t.co")) {
                              var textIndex = resObj.postData['postData'].lastIndexOf(" ");
                              resObj.postData['postData'] = resObj.postData['postData'].substring(0, textIndex).trim()
                            }

                          }
                        }
                        if (resObj.postData['postData'].includes(":")) {
                          let splitText = resObj.postData['postData'].split(":");

                          if (splitText[0] && splitText[0].includes('RT')) {
                            resObj.postData['postData'] = resObj.postData['postData'].split(/:(.+)/)[1]
                          }
                        }
                        if (resp.entities.urls && resp.entities.urls.length > 0) {

                          tweetObj["linkObj"] = resp.entities.urls.map(urlsData => {
                            if (resObj.postData['postData'].includes(urlsData.url)) {
                              let textIndex = resObj.postData['postData'].indexOf(urlsData.url)
                              resObj.postData['postData'] = resObj.postData['postData'].slice(0, textIndex) + urlsData.display_url + resObj.postData['postData'].slice(textIndex + 1)
                            }
                            delete urlsData["indices"];
                            return urlsData
                          })
                        }
                        resObj.postData.tweetData.push(tweetObj)
                        responseArr.push(resObj)
                      }

                    });
                    if (res.data && res.data.length < 1) {
                      return
                    }
                    if (new Date(fromDate) < new Date(res.data[res.data.length - 1].created_at)) {
                      twitterPagenation = [];
                      let twitterPagenObj = {}
                      twitterPagenObj.id = socialDoc.socialMedia.userId;
                      twitterPagenObj.next = res.data[res.data.length - 1].id_str;
                      twitterPagenation.push(twitterPagenObj)
                      return twitterPost(email, socialDoc);

                    }

                  }
                } catch (e) {
                  console.log("error.......twitter.........", JSON.stringify(e))
                }
              }

              const linkedInPost = async (email, socialDoc) => {
                console.log("..............linkedin..................")

                if (socialDoc.socialMedia.linkedinPages && socialDoc.socialMedia.linkedinPages.length > 0) {
                  let linkedInDataArr = [];

                  var count = "&count=90";
                  if (body && body['count']) {
                    count = "&count=" + body['count']
                  }
                  var queryStringParameters = "&count=90";
                  // if (body && body['count']) {
                  //   queryStringParameters = "&count=" + body['count']
                  // }

                  for await (const linkedinPages of socialDoc.socialMedia.linkedinPages) {
                    if (body && body.linkedInPagenation) {
                      if (body && body.linkedInPagenation.previous) {
                        queryStringParameters = "&start=" + body.linkedInPagenation.previous
                      }
                      if (body && body.linkedInPagenation.next) {
                        queryStringParameters = "&start=" + body.linkedInPagenation.next
                      }
                      if (body && body['count'] && body.linkedInPagenation.previous) {
                        queryStringParameters = "&count=" + body['count'] + "&start=" + body.linkedInPagenation.previous
                      }
                      if (body && body['count'] && body.linkedInPagenation.next) {
                        queryStringParameters = "&count=" + body['count'] + "&start=" + body.linkedInPagenation.next
                      }
                    }
                    try {
                      //var linkedinUrl = "https://api.linkedin.com/v2/shares?q=owners&owners=" + linkedinPages.pageId + "&sortBy=LAST_MODIFIED" + queryStringParameters
                      //var linkedinUrl = "https://api.linkedin.com/v2/ugcPosts?q=authors&authors[0]=" + linkedinPages.pageId + "&count=5&projection=(paging,elements*(name,localizedName,author,id,firstPublishedAt,vanityName,created,specificContent(reactions,com.linkedin.ugc.ShareContent(shareMediaCategory,shareCommentary,media(*(media~:playableStreams,originalUrl,thumbnails,description,title))))))"
                      var linkedinUrl = "https://api.linkedin.com/v2/ugcPosts?q=authors&authors[0]=" + linkedinPages.pageId + "&sortBy=LAST_MODIFIED" + queryStringParameters + "&projection=(paging,elements*(name,localizedName,author,id,firstPublishedAt,vanityName,created,specificContent(reactions,com.linkedin.ugc.ShareContent(shareMediaCategory,shareCommentary,media(*(media~:playableStreams,originalUrl,thumbnails,description,title))))))"
                      var linkedInRes = await axios.get(linkedinUrl, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia.oauth_token } })
                      if (linkedInRes.data && linkedInRes.data.elements && linkedInRes.data.elements.length) {
                        linkedInDataArr.push(linkedInRes.data.elements)
                      }
                      /* if (linkedInRes.data.paging) {
                        linkedInPagenation.previous = linkedInRes.data.paging.start;
                        linkedInPagenation.next = linkedInRes.data.paging.start + linkedInRes.data.paging.count;
                      } */

                    } catch (e) {
                      console.log("linkedIn error in loop", JSON.stringify((e)))
                    }
                  }

                  if (linkedInDataArr.length > 0) {
                    let flatArr = linkedInDataArr.flat()
                    console.log("flatArr....linkedIn......", flatArr.length)
                    flatArr.forEach(linkedInresp => {
                      let resObj = {};
                      let linkedInObj = {};
                      resObj.postData = {};
                      resObj.postData.linkedInData = [];
                      resObj['createdAt'] = linkedInresp.created.time;
                      linkedInObj['postStatus'] = "Posted";
                      linkedInObj['postDate'] = linkedInresp.created.time
                      linkedInObj['userId'] = socialDoc.socialMedia.userId;
                      linkedInObj['pageId'] = linkedInresp.author;

                      linkedInObj['mediaType'] = "text";
                      linkedInObj["thumbnail"] = '';
                      //linkedInObj['screen_name'] = linkedInresp.user.screen_name;
                      linkedInObj["postId"] = linkedInresp.id;
                      linkedInObj["mediaUrl"] = [];
                      resObj['userId'] = email;
                      resObj['postId'] = linkedInresp.id;
                      resObj.postData['fbpost'] = fbpost;
                      resObj.postData['postTime'] = linkedInresp.created.time;
                      resObj.postData['postStatus'] = "Posted";
                      resObj.postData['postData'] = decodeURI(linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary.text);
                      if (linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'IMAGE') {
                        linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.media?.map(image => {
                          linkedInObj['mediaType'] = "image";
                          linkedInObj["mediaUrl"] = [image?.originalUrl]
                        });
                      }
                      else if (linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'ARTICLE') {
                        linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.media?.map(link => {
                          linkedInObj['mediaType'] = "link";
                          linkedInObj["thumbnail"] = link?.thumbnails[0]?.url
                          linkedInObj["mediaUrl"] = [link?.originalUrl]
                        });
                      }
                      else if (linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'VIDEO') {
                        linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements?.map(video => {
                          if (video?.identifiers[0]?.mediaType == 'video/mp4') {
                            if (video?.identifiers[0]?.identifier?.includes('-720p')) {
                              linkedInObj['mediaType'] = "video";
                              linkedInObj["thumbnail"] = "https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/S3-Media/videoThumbnail.png";
                              linkedInObj["mediaUrl"] = [video?.identifiers[0]?.identifier]
                            }
                          }
                        });
                      }

                      // if (linkedInresp.content && linkedInresp.content.contentEntities && linkedInresp.content.contentEntities.length > 0) {
                      // 	linkedInObj["mediaUrl"] = linkedInresp.content.contentEntities.map(mediaData => {
                      // 		return mediaData.entityLocation
                      // 	})
                      // }
                      resObj.postData.linkedInData.push(linkedInObj)
                      responseArr.push(resObj)
                    });
                  }
                }
              }

              const facebookPost = async (email, socialDoc) => {
                console.log("..............facebook..................")

                if (socialDoc.socialMedia.fbpages && socialDoc.socialMedia.fbpages.length > 0) {
                  for await (const fbPages of socialDoc.socialMedia.fbpages) {


                    /* code */
                    var limit = "limit=50";
                    if (body && body['count']) {
                      limit = "limit=" + body.count;
                    }

                    let fbUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&pretty=0&${limit}&fields=location,to,message,created_time,attachments,from,parent_id,story`;
                    //let pagingUrl = "";
                    /* if (body.facebookPagenation && body.facebookPagenation.length > 0) {
                      let pagingObj = body.facebookPagenation.find(obj => obj.id == fbPages.id)
                      if (pagingObj.previous) {
                        pagingUrl = pagingObj.previous;
                      }
                      if (pagingObj.next) {
                        pagingUrl = pagingObj.next;
                      }
                    }
                    if (pagingUrl != "") {
                      fbUrl = pagingUrl;
                    } */

                    var since;
                    var until;

                    if (body && body.since) {
                      since = parseInt((new Date(body.since).getTime() / 1000).toFixed(0));
                      fbUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&pretty=0&${limit}&since=${since}&fields=location,message,created_time,attachments,from,parent_id,story`
                    }
                    if (body && body.until) {
                      until = parseInt((new Date(body.until).getTime() / 1000).toFixed(0));
                      fbUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&pretty=0&${limit}&until=${until}&fields=location,message,created_time,attachments,from,parent_id,story`;
                    }
                    if (body && body.since && body.until) {
                      fbUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&pretty=0&${limit}&since=${since}&until=${until}&fields=location,message,created_time,attachments,from,parent_id,story`;
                    }

                    //let fbUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&fields=location,message,created_time,attachments,from,parent_id,story`;

                    try {
                      let feed = await axios.get(fbUrl)

                      if (feed.data && feed.data.data) {
                        let feedsData = feed.data.data.map(v => ({ ...v, socialName: fbPages.name }))
                        fbDataArr.push(feedsData)

                        /* let facebookPagenObj = {}
  
                        if (feed.data.paging) {
                          facebookPagenObj.type = fbPages.type;
                          if (feed.data.paging.previous) {
                            facebookPagenObj.previous = feed.data.paging.previous;
                          }
                          if (feed.data.paging.next) {
                            facebookPagenObj.next = feed.data.paging.next;
                          }
                          facebookPagenObj.id = fbPages.id;
                        }
                        facebookPagenation.push(facebookPagenObj) */

                      }
                    } catch (e) {
                      console.log("error in facebook ......feed...", JSON.stringify(e))
                    }

                  }
                  if (fbDataArr.length > 0) {
                    console.log("............fbDataArr.................")
                    let flatArr = fbDataArr.flat()
                    /*flatArr.forEach(fbResp => {
                      let resObj = {};
                      let fbObj = {};
                      resObj.postData = {};
                      resObj.postData['fbpost'] = [];
                      resObj['createdAt'] = fbResp.created_time;
                      fbObj['postStatus'] = "Posted";
                      fbObj['postDate'] = fbResp.created_time;
                      fbObj['userId'] = socialDoc.socialMedia.userId;

                      if (fbResp.id.includes('_')) {
                        let splitPostId = fbResp.id.split("_");
                        fbObj['pageId'] = splitPostId[0]
                      }
                      else {
                        fbObj['pageId'] = fbResp.from.id;
                      }
                      if (fbResp.socialName) {
                        fbObj['pageName'] = fbResp.socialName;
                      }
                      else {
                        fbObj['pageName'] = fbResp.from.name;
                      }
                      if (fbResp.story) {
                        fbObj['story'] = fbResp.story;
                      }
                      fbObj["postId"] = fbResp.id;
                      fbObj["mediaUrl"] = [];
                      resObj['userId'] = email;
                      resObj.postData.linkedInData = [];
                      resObj.postData['postTime'] = fbResp.created_time;
                      resObj.postData['postStatus'] = "Posted";
                      resObj.postData['postData'] = fbResp.message || "";
                      if (fbResp.attachments && fbResp.attachments.data && fbResp.attachments.data[0] &&
                        fbResp.attachments.data[0].subattachments && fbResp.attachments.data[0].subattachments.data && fbResp.attachments.data[0].subattachments.data.length > 0) {
                        fbObj["mediaUrl"] = fbResp.attachments.data[0].subattachments.data.flatMap(mediaData => {
                          if (mediaData.media && mediaData.media.image && mediaData.media.image.src) {
                            return mediaData.media.image.src
                          }
                          else {
                            return []
                          }
                        })
                      }
                      else if (fbResp.attachments && fbResp.attachments.data && fbResp.attachments.data[0] && !fbResp.attachments.data[0].subattachments) {
                        fbObj["mediaUrl"] = fbResp.attachments.data.flatMap(mediaData => {
                          if (mediaData.media && mediaData.media.image && mediaData.media.image.src && mediaData.type == "photo") {
                            return mediaData.media.image.src
                          }
                          else {
                            return []
                          }
                        })
                      }
                      resObj.postData['fbpost'].push(fbObj)
                      responseArr.push(resObj)
                    });*/
                    flatArr.forEach(fbResp => {
                      let resObj = {};
                      let fbObj = {};
                      resObj.postData = {};
                      resObj.postData['fbpost'] = [];
                      resObj['createdAt'] = fbResp.created_time;
                      fbObj['postStatus'] = "Posted";
                      fbObj['postDate'] = fbResp.created_time;
                      fbObj['userId'] = socialDoc.socialMedia.userId;
                      fbObj['mediaType'] = "text";
                      fbObj["thumbnail"] = '';

                      if (fbResp.id.includes('_')) {
                        let splitPostId = fbResp.id.split("_");
                        fbObj['pageId'] = splitPostId[0]
                      }
                      else {
                        fbObj['pageId'] = fbResp.from.id;
                      }
                      if (fbResp.socialName) {
                        fbObj['pageName'] = fbResp.socialName;
                      }
                      else {
                        fbObj['pageName'] = fbResp.from.name;
                      }
                      if (fbResp.story) {
                        fbObj['story'] = fbResp.story;
                      }
                      fbObj["postId"] = fbResp.id;
                      fbObj["mediaUrl"] = [];
                      resObj['userId'] = email;
                      resObj['postId'] = fbResp.id;
                      resObj.postData.linkedInData = [];
                      resObj.postData['postTime'] = fbResp.created_time;
                      resObj.postData['postStatus'] = "Posted";
                      resObj.postData['postData'] = fbResp.message || "";
                      if (fbResp.attachments && fbResp.attachments.data && fbResp.attachments.data[0] &&
                        fbResp.attachments.data[0].subattachments && fbResp.attachments.data[0].subattachments.data && fbResp.attachments.data[0].subattachments.data.length > 0) {
                        fbObj["mediaUrl"] = fbResp.attachments.data[0].subattachments.data.flatMap(mediaData => {
                          if (mediaData.media && mediaData.media.image && mediaData.media.image.src) {
                            fbObj['mediaType'] = "image";
                            return mediaData.media.image.src
                          }
                          else {
                            return []
                          }

                        })
                      }
                      else if (fbResp.attachments && fbResp.attachments.data && fbResp.attachments.data[0] && !fbResp.attachments.data[0].subattachments) {
                        //fbObj["mediaUrl"] = fbResp.attachments.data.flatMap(mediaData => {
                        fbResp.attachments.data.flatMap(mediaData => {
                          if (mediaData?.media?.image?.src && (mediaData.type == "share" || mediaData.type == "link")) {
                            fbObj['mediaType'] = "link";
                          }
                          if (mediaData?.media?.image?.src && (mediaData.type == "photo" || mediaData.type == "album")) {
                            fbObj['mediaType'] = "image";
                            //fbObj["thumbnail"] = mediaData.media.image.src;
                            fbObj["mediaUrl"] = [mediaData.media.image.src]
                          }
                          else if (mediaData?.media?.image?.src && (mediaData.type == "video_inline" || mediaData.type == "video" || mediaData.type == "animated_image_video")) {
                            fbObj['mediaType'] = "video";
                            fbObj["thumbnail"] = mediaData.media.image.src;
                            fbObj["mediaUrl"] = [mediaData.media.source]
                          }
                          /* else {
                            return []
                          } */
                        })
                      }
                      resObj.postData['fbpost'].push(fbObj)
                      responseArr.push(resObj)
                    });
                  }
                }

              }

              const youtubePost = async (email, socialDoc) => {
                let promiseArr = [];
                var count = 99;
                if (body && body['count']) {
                  count = body['count']
                }


                let reconnectGoogle = async (refreshtoken) => {
                  return new Promise(async (resolve, reject) => {
                    const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}`;
                    const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                    try {
                      let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                      resolve({ 'token': result.data.access_token });
                    }
                    catch (error) {
                      console.log("error", JSON.stringify(error.message))
                      reject({ 'token': null });
                    }
                  })
                };
                promiseArr.push(reconnectGoogle(socialDoc.socialMedia.refresh_token));
                await Promise.all(promiseArr).then(async (resArr) => {
                  if (resArr) {

                    let pageToken = '';

                    if (body.youtubePagenation && body.youtubePagenation.length > 0) {
                      let pagingObj = body.youtubePagenation.find(obj => obj.id == socialDoc.socialMedia.userId)
                      if (pagingObj.previous) {
                        pageToken = `&pageToken=${pagingObj.previous}`;
                      }
                      if (pagingObj.next) {
                        pageToken = `&pageToken=${pagingObj.next}`;
                      }
                    }
                    let dateNow = new Date();
                    let currentdate = new Date();
                    var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));

                    if (body && body.dateFilterType && body.dateFilterType == '7days') {
                      currentdate = new Date();
                      startDate = new Date(currentdate.setDate(currentdate.getDate() - 7));
                    }
                    if (body && body.dateFilterType && body.dateFilterType == '14days') {
                      currentdate = new Date();
                      startDate = new Date(currentdate.setDate(currentdate.getDate() - 14));
                    }
                    let dateFilter = `&publishedAfter=${startDate.toISOString()}&publishedBefore=${dateNow.toISOString()}`;
                    if (body && body.dateFilterType && body.dateFilterType == 'custom') {
                      if (!body.toDate) {
                        done('422', {
                          message: "To date Required"
                        })
                        return;
                      }
                      if (!body.fromDate) {
                        done('422', {
                          message: "From date Required"
                        })
                        return;
                      }
                      if (parseInt(body.fromDate) > parseInt(body.toDate)) {
                        done('422', {
                          message: "From date must be less then To date"
                        })
                        return;
                      }
                      dateFilter = `&publishedAfter=${new Date(parseInt(body.fromDate)).toISOString()}&publishedBefore=${new Date(parseInt(body.toDate)).toISOString()}`
                    }

                    let ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&order=date&channelId=${socialDoc.socialMedia.userId}${dateFilter}&maxResults=${count}&type=video&access_token=${resArr[0].token}${pageToken}`;
                    console.log("ytUrl", ytUrl)
                    try {
                      let feed = await axios.get(encodeURI(ytUrl), null)
                      if (feed && feed.data) {

                        let ytResp = feed.data;
                        if (ytResp.items && ytResp.items.length > 0) {
                          ytResp.items.forEach(videoRes => {
                            let resObj = {};
                            let ytobj = {};
                            resObj.postData = {};
                            resObj.postData.youtubeData = [];
                            resObj.userId = email;
                            resObj.postId = videoRes.id.videoId;
                            resObj.postData['postData'] = videoRes.snippet.title;
                            resObj['createdAt'] = videoRes.snippet.publishedAt;

                            ytobj["mediaUrl"] = [];
                            ytobj["mediaType"] = "video";
                            ytobj['postStatus'] = "Posted";
                            ytobj['postDate'] = videoRes.snippet.publishedAt;
                            ytobj['userId'] = socialDoc.socialMedia.userId;
                            ytobj['channelName'] = videoRes.snippet.channelTitle;
                            ytobj["postId"] = videoRes.id.videoId;
                            ytobj["description"] = videoRes.snippet.description;
                            //ytobj["mediaUrl"] = [`https://www.youtube.com/watch?v=${videoRes.id.videoId}`];
                            ytobj["mediaUrl"].push(`https://www.youtube.com/embed/${videoRes.id.videoId}`);
                            ytobj["thumbnail"] = videoRes.snippet.thumbnails.default.url;
                            ytobj["thumbnail_size"] = ['default.jpg', 'mqdefault.jpg', 'hqdefault.jpg'];
                            resObj.postData['linkedInData'] = linkedInData;
                            resObj.postData['fbpost'] = fbpost;
                            resObj.postData['postTime'] = videoRes.snippet.publishedAt;
                            resObj.postData['postStatus'] = "Posted";
                            resObj.postData['postData'] = videoRes.snippet.title;
                            resObj.postData['youtubeData'].push(ytobj);
                            responseArr.push(resObj);
                          });
                        }
                        /* if (ytResp.nextPageToken || ytResp.prevPageToken) {
                          let youtubePagenObj = {};
                          youtubePagenObj.id = socialDoc.socialMedia.userId;
                          youtubePagenObj.previous = ytResp.prevPageToken ? ytResp.prevPageToken : '';
                          youtubePagenObj.next = ytResp.nextPageToken ? ytResp.nextPageToken : '';
                          youtubePagenation.push(youtubePagenObj)
                        } */
                      }
                    }
                    catch (error) {
                      console.log("error..", error.message)
                    }
                  }
                }).catch(err => {
                  console.log("err", JSON.stringify(err.message))
                })
              }

              const instagramPost = async (email, socialDoc) => {
                console.log("socialDoc", JSON.stringify(socialDoc))
                let limit = "limit=99";
                //let limit = "";
                if (body && body['count']) {
                  limit = "limit=" + body.count;
                }


                let dateNow = new Date().getTime() / 1000;
                let currentdate = new Date();

                var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30)) / 1000;
                if (body && body.dateFilterType && body.dateFilterType == '7days') {
                  currentdate = new Date();
                  startDate = new Date(currentdate.setDate(currentdate.getDate() - 7)) / 1000;
                }
                if (body && body.dateFilterType && body.dateFilterType == '14days') {
                  currentdate = new Date();
                  startDate = new Date(currentdate.setDate(currentdate.getDate() - 14)) / 1000;
                }

                let dateFilter = `&since=${parseInt(startDate.toFixed(0))}&until=${parseInt(dateNow.toFixed(0))}`;
                if (body && body.dateFilterType && body.dateFilterType == 'custom') {
                  if (!body.toDate) {
                    done('422', {
                      message: "To date Required"
                    })
                    return;
                  }
                  if (!body.fromDate) {
                    done('422', {
                      message: "From date Required"
                    })
                    return;
                  }
                  if (parseInt(body.fromDate) > parseInt(body.toDate)) {
                    done('422', {
                      message: "From date must be less then To date"
                    })
                    return;
                  }
                  let from = parseInt(body.fromDate) / 1000;
                  let to = parseInt(body.toDate) / 1000;

                  dateFilter = `&since=${from.toFixed(0)}&until=${to.toFixed(0)}`;

                }

                try {

                  const request = {
                    url: `https://graph.facebook.com/v12.0/${socialDoc.socialMedia.userId}/media?fields=timestamp,business_discovery,thumbnail_url,media_url,media_type,owner,ig_id,comments_count,like_count,is_comment_enabled,media_product_type,username,video_title,children{media_url,thumbnail_url},caption&${limit}${dateFilter}&access_token=${socialDoc.socialMedia.oauth_token}`,
                    //url: `https://graph.facebook.com/v12.0/${socialDoc.socialMedia.userId}/media?fields=timestamp,business_discovery,thumbnail_url,media_url,media_type,owner,ig_id,comments_count,like_count,is_comment_enabled,media_product_type,username,video_title,caption&${limit}${dateFilter}&access_token=${socialDoc.socialMedia.oauth_token}`,

                    method: 'GET',
                    body: {}
                  }
                  console.log("request.url", request.url)
                  let res = await axios.get((request.url))

                  if (res && res.data && res.data.data && res.data.data.length > 0) {
                    res.data.data.forEach(resp => {
                      let resObj = {};
                      let instaobj = {};
                      resObj.postData = {};
                      resObj.postData.instagramData = [];
                      resObj['createdAt'] = resp.timestamp;
                      instaobj['postStatus'] = "Posted";
                      instaobj['postDate'] = resp.timestamp;
                      instaobj['name'] = resp.username;
                      instaobj["mediaUrl"] = [resp.media_url];
                      instaobj['userId'] = resp.owner.id;
                      instaobj["postId"] = resp.id;
                      instaobj["mediaType"] = '';
                      instaobj["thumbnail"] = '';
                      instaobj['postData'] = resp.caption
                      if (resp.media_type == "CAROUSEL_ALBUM") {
                        instaobj["mediaType"] = "carousel_album";
                        instaobj["thumbnail"] = resp.media_url;
                        if (resp?.children?.data && resp?.children?.data.length > 0) {
                          instaobj["mediaUrl"] = resp.children.data.map(img => {
                            return img.media_url;
                          })
                        }
                      }
                      if (resp.media_type == "VIDEO") {
                        instaobj["mediaType"] = "video";
                        instaobj["thumbnail"] = resp.thumbnail_url;

                      }
                      if (resp.media_type == "IMAGE") {
                        instaobj["mediaType"] = "image";
                        instaobj["thumbnail"] = resp.media_url;

                      }
                      resObj['userId'] = email;
                      resObj['postId'] = resp.id;
                      resObj.postData['linkedInData'] = linkedInData;
                      resObj.postData['fbpost'] = fbpost;
                      resObj.postData['postTime'] = resp.timestamp;
                      resObj.postData['postStatus'] = "Posted";
                      resObj.postData['postData'] = resp.caption;
                      resObj.postData.instagramData.push(instaobj)
                      responseArr.push(resObj)
                    });

                  }
                } catch (error) {
                  console.log("error...........", JSON.stringify(error));
                }
              }

              const googelMyBussinessPost = async (email, socialDoc) => {
                let promiseArr = [];
                var count = 99;
                if (body && body['count']) {
                  count = body['count']
                }

                let reconnectGoogle = async (refreshtoken) => {
                  return new Promise(async (resolve, reject) => {
                    const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                    const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}&redirect_uri=${google_redirect_uri}`;
                    //const requestBody = `client_secret=${client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${client_id}&redirect_uri=https://test.storefries.com/dashboard/user/manageuseraccount`;
                    try {
                      let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                      console.log("result", JSON.stringify(result.data))
                      resolve({ 'token': result.data.access_token });
                    }
                    catch (error) {

                      console.log("error", JSON.stringify(error))
                      reject({ 'token': null });
                    }
                  })
                };

                promiseArr.push(reconnectGoogle(socialDoc.socialMedia.refresh_token));
                //promiseArr.push(reconnectGoogle(refresh_token));

                await Promise.all(promiseArr).then(async (resArr) => {
                  console.log("gmb........................................................", JSON.stringify(resArr))
                  //responseArr.push(resArr);
                  if (resArr && resArr.length > 0) {
                    let pageToken = '';
                    /* if (body.gmbPagenation && body.gmbPagenation.length > 0) {
                      console.log("gmbPagenation/.....................")
                      let pagingObj = body.gmbPagenation.find(obj => obj.id == socialDoc.socialMedia.locationId)
                      if (pagingObj.previous) {
                        pageToken = `&pageToken=${pagingObj.previous}`;
                      }
                      if (pagingObj.next) {
                        pageToken = `&pageToken=${pagingObj.next}`;
                      }
                    } */

                    let gmbUrl = `https://mybusinessaccountmanagement.googleapis.com/v4/accounts/113275134162591771708/locations/2008038776901890362/localPosts?pageSize=${count}${pageToken}`;
                    //let gmbUrl = `https://mybusinessaccountmanagement.googleapis.com/v4/accounts/${socialDoc.socialMedia.userId}/locations/${socialDoc.socialMedia.locationId}/localPosts`;


                    try {
                      //let feed = await axios.get(encodeURI(gmbUrl), null)
                      let feed = await axios.get(gmbUrl, { headers: { 'Authorization': 'Bearer ' + resArr[0].token } })
                      if (feed && feed.data) {
                        let gmbResp = feed.data;
                        if (gmbResp.localPosts && gmbResp.localPosts.length > 0) {
                          gmbResp.localPosts.forEach(gmbRes => {
                            //console.log("gmbRes", JSON.stringify(gmbRes))
                            let id = gmbRes.name.split('/')
                            let postId = id[5]
                            let resObj = {};
                            let gmbObj = {};
                            resObj.postData = {};
                            resObj.postData.gmbData = [];
                            resObj.userId = email;
                            resObj.postId = postId;
                            resObj.postData['postData'] = gmbRes.summary;
                            resObj['createdAt'] = gmbRes.createTime;
                            gmbObj["mediaType"] = "";
                            gmbObj["mediaUrl"] = [];
                            gmbObj["thumbnail"] = "";
                            gmbObj['postStatus'] = "Posted";
                            gmbObj['postDate'] = gmbRes.createTime;
                            gmbObj['userId'] = socialDoc.socialMedia.userId;
                            gmbObj['locationId'] = socialDoc.socialMedia.locationId;
                            gmbObj['channel_name'] = socialDoc.socialMedia.channel_name;
                            gmbObj['postUrl'] = gmbRes.searchUrl;
                            gmbObj["postId"] = postId;
                            gmbObj["topicType"] = "";
                            if (gmbRes.topicType) {
                              gmbObj["topicType"] = gmbRes.topicType
                            }

                            if (gmbRes.callToAction) {
                              gmbObj["actionType"] = gmbRes.callToAction.actionType
                              gmbObj["buttonUrl"] = gmbRes.callToAction.url
                            }
                            if (gmbRes.media) {
                              gmbRes.media.forEach(mediaUrl => {
                                if (mediaUrl.mediaFormat == 'PHOTO') {
                                  gmbObj["mediaType"] = "image";
                                }
                                if (mediaUrl.mediaFormat == 'VIDEO') {
                                  gmbObj["mediaType"] = "video";
                                }
                                gmbObj["mediaUrl"].push(mediaUrl.googleUrl);
                                gmbObj["thumbnail"] = mediaUrl.googleUrl;
                              });
                            }
                            // gmbobj["thumbnail_size"] = ['default.jpg', 'mqdefault.jpg', 'hqdefault.jpg'];
                            resObj.postData['linkedInData'] = linkedInData;
                            resObj.postData['fbpost'] = fbpost;
                            resObj.postData['postTime'] = gmbRes.createTime;
                            resObj.postData['postStatus'] = "Posted";
                            resObj.postData['gmbData'].push(gmbObj);
                            responseArr.push(resObj);
                          });
                        }
                        /* if (gmbResp.nextPageToken || gmbResp.prevPageToken) {
                          let gmbPagenObj = {};
                          gmbPagenObj.id = socialDoc.socialMedia.locationId;
                          //gmbPagenObj.previous = ytResp.prevPageToken ? ytResp.prevPageToken : '';
                          gmbPagenObj.next = gmbResp.nextPageToken;
                          gmbPagenation.push(gmbPagenObj)
                        } */
                      }
                    }
                    catch (error) {
                      console.log("............................................................")
                      console.log("error..", error)
                    }
                  }
                }).catch(err => {
                  console.log("err...........", JSON.stringify(err))
                })
              }

              data['posts'] = [];
              //if (userData1.features.is_CalendarViewAllowed && (subscriptionData.planId == 'ProPlan-USD-Yearly' || subscriptionData.planId == 'ProPlan-USD-Monthly')) {
              if (userData1.features.is_CalendarViewAllowed && (subscriptionData.planId.includes('ProPlan'))) {
                let doc = await socialModel.aggregate(query)
                if (doc && doc.length > 0) {

                  console.log("doc", JSON.stringify(doc));

                  const promiseArray = [];
                  for (let i = 0; i < doc.length; i++) {
                    switch (doc[i].socialMedia.name) {
                      case "twitter":
                        promiseArray.push(twitterPost(email, doc[i]));
                        break;
                      case "linkedin":
                        promiseArray.push(linkedInPost(email, doc[i]));
                        break;
                      case "facebook":
                        promiseArray.push(facebookPost(email, doc[i]));
                        break;
                      case "youtube":
                        promiseArray.push(youtubePost(email, doc[i]));
                        break;
                      case "instagram":
                        promiseArray.push(instagramPost(email, doc[i]));
                        break;
                      case "googlemybusiness":
                        promiseArray.push(googelMyBussinessPost(email, doc[i]));
                        break;
                      default:
                        break;
                    }
                  }
                  await Promise.all(promiseArray).then(resArr => {

                    //let uniqueArray = [...new Set([objectReference, objectReference])]
                    console.log("responseArr", responseArr.length)

                    //let newResponseArr = responseArr;

                    //newResponseArr = Array.from(new Set(newResponseArr.map(JSON.stringify))).map(JSON.parse);

                    //console.log("newResponseArr",newResponseArr.length)

                    responseArr.sort(function (a, b) {
                      var dateA = new Date(a.createdAt),
                        dateB = new Date(b.createdAt)
                      return dateB - dateA
                    });
                    data['posts'] = responseArr;
                  })
                }
              }
              /*else {
                done('200', {
                  status: "You are not allowed to see Calendar View, If you need access calendar Upgrade your Subscription",

                })
                return;
              }*/
              //});
            }

            done('200', {
              status: "All Post retrieved",
              data: data
            });
            return;
            // }
            // catch (error) {
            //   done('400', {
            //     status: "Post retrieved Failed",
            //     message: error
            //   });
            // }
            // }
            // else {
            //   done('200', {
            //     message: `Your Subscription has been cancelled, Please active your Subscription`,
            //     status: false,
            //     data: {}
            //   });
            // }
          },
            () => { console.log('Connection Error'); });
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
