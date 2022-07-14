var mongoose = require('mongoose');
var axios = require('axios');
var socialModel = require('./SocialModel.js');
var scheduledPost = require('./ScheduledPost.js');
var AuthHelper = require('./AuthHelper.js');
var userModel = require('./userModel.js');
const moment = require('moment');
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
    var google_client_secrets = event.stageVariables['Google_ClientSecret']
    var google_redirect_uri = event.stageVariables['Manage_ProfilePage']

    /*  var connectorMongodb = mongoose.connect('mongodb+srv://storefries:CH8U1ZXGyeILqFWy@storefries.76ocf.mongodb.net/SocialMediaPublisher', { useNewUrlParser: true, useUnifiedTopology: true });
     const CONSUMERKEY = 'eLD1dQVA2Sz4rN166vyJnF8m8';
     const CONSUMERSECRET = 'qtO5wIc479drT3YqmiNYzRSTsc6hrpVR7paj8ZgMAAoDdSW50H';
     const twitter_token = 'AAAAAAAAAAAAAAAAAAAAABJRMAEAAAAAZCgIiNjUIBEmshoYJVkZsYV6Nc0%3DJtWFMmKy7Bz0CqFZI0xU9reKrJqYuHzpxW0fNgf9ptWDEskYRH';
 
     const google_client_id = '781834412445-ggdcsq1tuvsvsg99uh3pg6iqc6jqi4ug.apps.googleusercontent.com';
     const google_client_secrets = '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';
     const google_redirect_uri = 'https://test.storefries.com/dashboard/connect/new/gmb' */

    const analitics = async (doc, email) => {
        return new Promise(async (resolve, reject) => {

            let responseArr = []
            let finalResponse = []
            const promiseArr = [];

            var pageToken = '';
            let twitterPostIds = [];

            const twitter = async (socialdoc) => {

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
                let dateFilter = `&start_time=${startDate.toISOString()}&end_time=${dateNow.toISOString()}`;
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
                    dateFilter = `&start_time=${new Date(parseInt(body.fromDate)).toISOString()}&end_time=${new Date(parseInt(body.toDate)).toISOString()}`
                }

                let twitUrl = `https://api.twitter.com/2/users/${socialdoc.socialMedia.userId}/tweets?exclude=retweets,replies&tweet.fields=created_at&max_results=100${pageToken}${dateFilter}`
                //console.log("twitUrl.........................................................", twitUrl)
                let twitPromiseArr = []

                twitPromiseArr.push(axios.get(encodeURI(twitUrl), { headers: { 'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAABJRMAEAAAAAZCgIiNjUIBEmshoYJVkZsYV6Nc0%3DJtWFMmKy7Bz0CqFZI0xU9reKrJqYuHzpxW0fNgf9ptWDEskYRH' } }))

                return Promise.all(twitPromiseArr).then(async (result) => {

                    if (result[0] && result[0].data && result[0].data.data && result[0].data.data[0]) {
                        result[0].data.data.forEach(elem => {
                            twitterPostIds.push(elem.id);
                        });

                        if (result[0].data.meta && result[0].data.meta.next_token) {
                            pageToken = `&pagination_token=${result[0].data.meta.next_token}`;
                            return twitter(socialdoc);
                        } else {
                            let resObj = {};
                            resObj['post_count'] = twitterPostIds.length;
                            let finalTwitPromiseArr = [];
                            let maxIdSize = 100;

                            for (let i = 0; i < twitterPostIds.length; i += maxIdSize) {
                                let myArray = twitterPostIds.slice(i, i + maxIdSize);
                                let twitMetricUrl = `https://api.twitter.com/2/tweets?ids=${myArray.toString()}&user.fields=public_metrics&tweet.fields=public_metrics,organic_metrics&expansions=author_id,entities.mentions.username`

                                let request = {
                                    url: twitMetricUrl,
                                    method: 'GET',
                                    body: {}
                                }
                                //let authorizeHeader = AuthHelper.getAuthHeaderForRequest(request1, doc[i].socialMedia.oauth_token, doc[i].socialMedia.oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
                                //let authorizeHeader = await AuthHelper.getAuthHeaderForRequest(request, socialdoc.socialMedia.oauth_token, socialdoc.socialMedia.oauth_token_secret, CONSUMERKEY, CONSUMERSECRET);
                                //let twitterData = await axios.get(encodeURI(request.url), { headers: authorizeHeader })

                                //finalTwitPromiseArr.push(axios.get(encodeURI(request.url), { headers: AuthHelper.getAuthHeaderForRequest(request, socialdoc.socialMedia.oauth_token, socialdoc.socialMedia.oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']) }))
                                finalTwitPromiseArr.push(axios.get(encodeURI(request.url), { headers: AuthHelper.getAuthHeaderForRequest(request, socialdoc.socialMedia.oauth_token, socialdoc.socialMedia.oauth_token_secret, CONSUMERKEY, CONSUMERSECRET) }))
                            }

                            await Promise.all(finalTwitPromiseArr).then(async (twitterResult) => {

                                resObj['reach'] = 0;
                                resObj['engagement'] = 0;
                                resObj['followers_count'] = 0;
                                resObj['following_count'] = 0;
                                resObj['userId'] = socialdoc.socialMedia.userId;
                                resObj['name'] = socialdoc.socialMedia.screenName;
                                resObj['profileImage'] = socialdoc.socialMedia.userProfileImage || "";
                                resObj['socialMedia'] = 'twitter';
                                twitterResult.forEach(twitterData => {
                                    if (twitterData.data && twitterData.data.data) {

                                        twitterData.data.data.forEach(twitEle => {
                                            if (twitEle.organic_metrics && twitEle.organic_metrics.impression_count) {
                                                resObj['reach'] = resObj['reach'] + twitEle.organic_metrics.impression_count;
                                            }
                                            if (twitEle.public_metrics) {
                                                resObj['engagement'] = resObj['engagement'] + twitEle.public_metrics.retweet_count + twitEle.public_metrics.reply_count + twitEle.public_metrics.like_count;
                                            }
                                        });
                                        if (twitterData.data.includes && twitterData.data.includes.users && twitterData.data.includes.users.length > 0) {
                                            resObj['followers_count'] = twitterData.data.includes.users[0].public_metrics.followers_count;
                                            resObj['following_count'] = twitterData.data.includes.users[0].public_metrics.following_count;
                                        }

                                    }
                                });
                                responseArr.push(resObj)
                            }).catch(err => {
                                console.log("err twitter promiseArr.all ......", err);
                            })
                        }
                    }
                }).catch(err => {
                    console.log("err twitter promiseArr.all ......", err);
                })
                //}
                //}
            }

            const linkedin = async (socialdoc) => {
                if (socialdoc.socialMedia.linkedinPages && socialdoc.socialMedia.linkedinPages.length > 0) {
                    for await (const linkedinPages of socialdoc.socialMedia.linkedinPages) {
                        let linkedinPromiseArr = []
                        let dateNow = parseInt((new Date().getTime()).toFixed(0));
                        let currentdate = new Date();
                        let startDate = new Date(currentdate.setDate(currentdate.getDate() - 30))
                        let backDate = parseInt((startDate.getTime()).toFixed(0));

                        if (body && body.dateFilterType && body.dateFilterType == '7days') {
                            currentdate = new Date();
                            startDate = new Date(currentdate.setDate(currentdate.getDate() - 7));
                            backDate = parseInt((startDate.getTime()).toFixed(0));
                        }
                        if (body && body.dateFilterType && body.dateFilterType == '14days') {
                            currentdate = new Date();
                            startDate = new Date(currentdate.setDate(currentdate.getDate() - 14))
                            backDate = parseInt((startDate.getTime()).toFixed(0));
                        }
                        let dateFilter = `&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${backDate}&timeIntervals.timeRange.end=${dateNow}`

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

                            //dateFilter = `&start_time=${new Date(body.fromDate)}&end_time=${ new Date(body.toDate) }`
                            dateFilter = `&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${body.fromDate}&timeIntervals.timeRange.end=${body.toDate}`
                        }

                        //let urls = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${linkedinPages.pageId}${dateFilter}`
                        let urls = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${linkedinPages.pageId}${dateFilter}`

                        let linkedInRes = async () => {
                            return new Promise((resolve, reject) => {
                                axios.get(`https://api.linkedin.com/v2/networkSizes/${linkedinPages.pageId}?edgeType=CompanyFollowedByMember${dateFilter}`,
                                    //axios.get(`https://api.linkedin.com/v2/networkSizes/${linkedinPages.pageId}?edgeType=CompanyFollowedByMember`,
                                    { headers: { 'Authorization': 'Bearer ' + socialdoc.socialMedia.oauth_token } }).then((resp) => {
                                        if (resp.data) {
                                            resolve({ linkRes: resp.data })
                                        } else {
                                            resolve({ linkRes: '' })
                                        }
                                    }).catch(err => {
                                        resolve({ linkRes: '' })
                                    })
                            })
                        }

                        let linkedInStatRes = async () => {
                            return new Promise((resolve, reject) => {
                                axios.get(urls, { headers: { 'Authorization': 'Bearer ' + socialdoc.socialMedia.oauth_token } }).then((statRes) => {
                                    if (statRes.data) {
                                        resolve({ statRes: statRes.data })
                                    } else {
                                        resolve({ statRes: '' })
                                    }
                                }).catch(err => {
                                    resolve({ statRes: '' })
                                })
                            })
                        }

                        let linkedInPostPost_count = 0;
                        let paginateCount = 0;
                        let postRequestCount = "start=0";
                        let linkedInPostRes = async () => {
                            let linkedinPostPromiseArr = [];
                            //let linkedinUrl = `https://api.linkedin.com/v2/shares?q=owners&owners=${linkedinPages.pageId}&sortBy=LAST_MODIFIED&sharesPerOwner=100&count=50&${postRequestCount}`;
                            let linkedinUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors[0]=${linkedinPages.pageId}&sortBy=LAST_MODIFIED&count=50&${postRequestCount}`;

                            let linkedinPost = async (linkedinUrl, oauth_token) => {
                                return new Promise((resolve, reject) => {
                                    axios.get(linkedinUrl, { headers: { 'Authorization': 'Bearer ' + oauth_token } }).then((response) => {
                                        if (response.data) {
                                            resolve(response)
                                        } else {
                                            resolve({});
                                        }
                                    }).catch(err => {
                                        resolve({});
                                    })
                                })
                            }
                            //linkedinPostPromiseArr.push(axios.get(linkedinUrl, { headers: { 'Authorization': 'Bearer ' + socialdoc.socialMedia.oauth_token } }))
                            linkedinPostPromiseArr.push(linkedinPost(linkedinUrl, socialdoc.socialMedia.oauth_token))

                            let postRes = await Promise.all(linkedinPostPromiseArr);
                            if (postRes[0].data && postRes[0].data.elements && postRes[0].data.elements.length > 0) {
                                if (body && body.dateFilterType && body.dateFilterType == 'custom' && body.toDate && body.fromDate) {
                                    postRes[0].data.elements.forEach(post => {
                                        if (post.created.time > parseInt(body.fromDate) && parseInt(body.toDate) > post.created.time) {
                                            linkedInPostPost_count = linkedInPostPost_count + 1;
                                        }
                                    });

                                    if (postRes[0].data.elements[0].created.time > parseInt(body.fromDate)) {
                                        paginateCount = paginateCount + postRes[0].data.elements.length;
                                        postRequestCount = `start=${paginateCount}`;
                                        return linkedInPostRes();
                                    }
                                } else {
                                    postRes[0].data.elements.forEach(post => {
                                        if (post.created.time > backDate) {
                                            linkedInPostPost_count = linkedInPostPost_count + 1;
                                        }
                                    });
                                    if (postRes[0].data.elements[0].created.time > backDate) {
                                        postRequestCount = `start=${linkedInPostPost_count}`;
                                        return linkedInPostRes();
                                    }
                                }
                            }
                            return { postRes: linkedInPostPost_count };
                        }

                        linkedinPromiseArr.push(linkedInRes());
                        linkedinPromiseArr.push(linkedInStatRes());
                        linkedinPromiseArr.push(linkedInPostRes());

                        await Promise.all(linkedinPromiseArr).then(result => {
                            let resObj = {};
                            resObj['userId'] = socialdoc.socialMedia.userId;
                            resObj['pageId'] = linkedinPages.pageId;
                            resObj['name'] = linkedinPages.pageName;
                            resObj['socialMedia'] = 'linkedin';
                            resObj['following_count'] = 0;
                            resObj['followers_count'] = 0;
                            resObj['reach'] = 0;
                            resObj['engagement'] = 0;
                            resObj['profileImage'] = '';
                            resObj['post_count'] = 0;

                            if (linkedinPages.pageImage) {
                                resObj['profileImage'] = linkedinPages.pageImage;
                            }
                            result.forEach(linked => {
                                if (linked && linked.linkRes && linked.linkRes.firstDegreeSize) {
                                    resObj['followers_count'] = linked.linkRes.firstDegreeSize;

                                }
                                if (linked && linked.postRes) {
                                    resObj['post_count'] = linked.postRes;

                                }
                                if (linked && linked.statRes && linked.statRes.elements && linked.statRes.elements[0]) {
                                    linked.statRes.elements.forEach(elem => {
                                        if (elem.totalShareStatistics.uniqueImpressionsCount) {
                                            resObj['reach'] = resObj['reach'] + elem.totalShareStatistics.uniqueImpressionsCount;
                                        }
                                        /* if (elem.totalShareStatistics.engagement) {
                                            resObj['engagement'] = resObj['engagement'] + elem.totalShareStatistics.engagement;
                                        } */
                                        if (elem.totalShareStatistics) {
                                            let likeCount = 0;
                                            if (elem.totalShareStatistics.likeCount && elem.totalShareStatistics.likeCount > 0) {
                                                likeCount = elem.totalShareStatistics.likeCount
                                            }
                                            resObj['engagement'] = resObj['engagement'] + elem.totalShareStatistics.commentCount + likeCount + elem.totalShareStatistics.shareCount;
                                        }
                                    });
                                }
                            });
                            responseArr.push(resObj)
                        }).catch(err => {
                            console.log("err linkedin promiseArr.all ......", err);
                        })
                    }
                }
            }

            const facebook = async (socialdoc) => {
                if (socialdoc.socialMedia.fbpages && socialdoc.socialMedia.fbpages.length > 0) {
                    for await (const fbPages of socialdoc.socialMedia.fbpages) {
                        if (fbPages.type == "page") {
                            let dateNow = new Date().getTime() / 1000;
                            let currentdate = new Date();
                            //var startDate = parseInt((new Date(currentdate.setDate(currentdate.getDate() - 28).getTime() / 1000)).toFixed(0));

                            var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30)) / 1000;

                            //var startDate =parseInt(((new Date().getTime()) / 1000).toFixed(0));

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

                            let facebookPromiseArr = [];
                            let fbUrl1 = `https://graph.facebook.com/${fbPages.id}?fields=id,followers_count,engagement,feed&access_token=${fbPages.access_token}`

                            let facebookFollowers = async () => {
                                return new Promise((resolve, reject) => {
                                    axios.get(fbUrl1).then((followersRes) => {
                                        if (followersRes.data) {
                                            resolve({ followersRes: followersRes.data })
                                        } else {
                                            resolve({ followersRes: {} })
                                        }
                                    }).catch(err => {
                                        resolve({ followersRes: {} })
                                    })
                                })
                            }

                            let fbUrl = `https://graph.facebook.com/${fbPages.id}/insights?metric=page_impressions_unique&period=day&access_token=${fbPages.access_token}${dateFilter}`
                            let facebookFeed = async () => {
                                return new Promise((resolve, reject) => {
                                    axios.get(fbUrl).then((feedRes) => {
                                        if (feedRes.data) {
                                            resolve({ feedRes: feedRes.data })
                                        } else {
                                            resolve({ feedRes: {} })
                                        }
                                    }).catch(err => {
                                        resolve({ feedRes: {} })
                                    })
                                })
                            }

                            let fbPostCount = 0;
                            let fbEngageCount = 0;
                            let postUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&fields=created_time,from,likes.summary(true),comments.summary(true),shares&limit=50${dateFilter}`

                            let facebookPostCount = async () => {
                                let facebookPostPromiseArr = [];
                                let facePtCt = async (url) => {
                                    return new Promise((resolve, reject) => {
                                        axios.get(url).then((ptRes) => {
                                            if (ptRes.data) {
                                                resolve(ptRes)
                                            } else {
                                                resolve({ feedRes: {} })
                                            }
                                        }).catch(err => {
                                            resolve({ feedRes: {} })
                                        })
                                    })
                                }
                                try {
                                    //facebookPostPromiseArr.push(axios.get(postUrl));
                                    facebookPostPromiseArr.push(facePtCt(postUrl));
                                    let postResult = await Promise.all(facebookPostPromiseArr);
                                    if (postResult[0] && postResult[0].data && postResult[0].data.data && postResult[0].data.data.length > 0) {
                                        postResult[0].data.data.forEach(feedData => {
                                            let likes = 0;
                                            let comments = 0;
                                            let shares = 0;
                                            if (feedData.likes && feedData.likes.summary && feedData.likes.summary.total_count) {
                                                likes = feedData.likes.summary.total_count;
                                            }
                                            if (feedData.comments && feedData.comments.summary && feedData.comments.summary.total_count) {
                                                comments = feedData.comments.summary.total_count;
                                            }
                                            if (feedData.shares && feedData.shares.count) {
                                                shares = feedData.shares.count;
                                            }
                                            fbEngageCount = fbEngageCount + likes + comments + shares;
                                        })

                                        fbPostCount = fbPostCount + postResult[0].data.data.length;
                                        if (postResult[0].data.paging && postResult[0].data.paging.next) {
                                            postUrl = postResult[0].data.paging.next;
                                            return facebookPostCount();
                                        } else {
                                            return { fbPostCount: fbPostCount, fbEngageCount: fbEngageCount };
                                        }
                                    }
                                    return { fbPostCount: fbPostCount, fbEngageCount: fbEngageCount };
                                } catch (error) {
                                    return { fbPostCount: fbPostCount, fbEngageCount: fbEngageCount };
                                }
                            }

                            facebookPromiseArr.push(facebookFeed());
                            facebookPromiseArr.push(facebookFollowers());
                            facebookPromiseArr.push(facebookPostCount());

                            await Promise.all(facebookPromiseArr).then(fbResult => {
                                let resObj = {};
                                resObj['userId'] = socialdoc.socialMedia.userId;
                                resObj['pageId'] = fbPages.id;
                                resObj['name'] = fbPages.name;
                                resObj['socialMedia'] = 'facebook';
                                resObj['following_count'] = 0;
                                resObj['folowers_count'] = 0;
                                resObj['profileImage'] = '';
                                resObj['post_count'] = 0;
                                resObj['reach'] = 0;
                                resObj['engagement'] = 0;

                                if (fbPages.image) {
                                    resObj['profileImage'] = fbPages.image;
                                }
                                fbResult.forEach(result => {
                                    if (result.followersRes && result.followersRes.followers_count) {
                                        resObj['folowers_count'] = result.followersRes.followers_count;
                                    }
                                    if (result && result.fbPostCount) {
                                        resObj['post_count'] = result.fbPostCount;
                                    }
                                    if (result && result.fbEngageCount) {
                                        resObj['engagement'] = result.fbEngageCount;
                                    }
                                    if (result.feedRes && result.feedRes.data && result.feedRes.data[0] && result.feedRes.data[0].values && result.feedRes.data[0].values.length > 0) {
                                        result.feedRes.data[0].values.forEach(fbReach => {
                                            resObj['reach'] = resObj['reach'] + fbReach.value;
                                        })
                                    }
                                    /* if (result.feedRes value.name == "page_impressions_unique" && value.period == "days_28") {
                                        resObj['reach'] = value.values[1].value;
                                    }
                                    if (value.name == "page_post_engagements" && value.period == "days_28") {
                                        resObj['engagement'] = value.values[1].value;
                                    } */
                                })
                                responseArr.push(resObj)
                            }).catch(err => {
                                console.log("err facebook promise all ...", err)
                            })
                        }
                    }
                }
            }

            const instagram = async (socialdoc) => {
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


                //let igUrl = `https://graph.facebook.com/v12.0/${socialdoc.socialMedia.userId}/insights?metric=impressions,reach&period=day${dateFilter}&access_token=${socialdoc.socialMedia.oauth_token}`
                let insightUrl = `https://graph.facebook.com/v12.0/${socialdoc.socialMedia.userId}/media?fields=username,insights.metric(reach,engagement),comments_count,like_count&limit=90${dateFilter}&access_token=${socialdoc.socialMedia.oauth_token}`

                let followersUrl = `https://graph.facebook.com/v12.0/${socialdoc.socialMedia.userId}?fields=media_count,profile_picture_url,name,username,followers_count,follows_count${dateFilter}&access_token=${socialdoc.socialMedia.oauth_token}`
                //let res = axios.get(insightUrl)
                let reach = 0;
                let engagement = 0;
                let instaPostCount = 0;
                let instagramInsight = async (postUrl) => {

                    let igInsightPromiseArr = [];
                    igInsightPromiseArr.push(axios.get(postUrl));
                    let insightRes = await Promise.all(igInsightPromiseArr);
                    if (insightRes[0] && insightRes[0].data && insightRes[0].data.data && insightRes[0].data.data.length > 0) {

                        insightRes[0].data.data.forEach(igData => {
                            igData.insights.data.forEach(igInsight => {
                                if (igInsight.name == "reach") {
                                    reach = reach + igInsight.values[0].value;
                                }
                                if (igInsight.name == "engagement") {
                                    engagement = engagement + igInsight.values[0].value;
                                }
                            });
                        });
                        if (insightRes[0].data.paging && insightRes[0].data.paging.next) {
                            postUrl = insightRes[0].data.paging.next;
                            return instagramInsight(postUrl);
                        } else {
                            return { reach: reach, engagement: engagement };
                        }
                    }
                    return { reach: reach, engagement: engagement };
                }

                let instagrampostUrl = `https://graph.facebook.com/v12.0/${socialdoc.socialMedia.userId}/media?username,media_count,insights.metric(reach,engagement),comments_count,like_count&limit=50&${dateFilter}&access_token=${socialdoc.socialMedia.oauth_token}`
                let instagramPostCount = async () => {
                    let instagramPostPromiseArr = [];
                    try {
                        instagramPostPromiseArr.push(axios.get(instagrampostUrl));
                        let postResult = await Promise.all(instagramPostPromiseArr);
                        if (postResult[0] && postResult[0].data && postResult[0].data.data && postResult[0].data.data.length > 0) {

                            instaPostCount = instaPostCount + postResult[0].data.data.length;
                            if (postResult[0].data.paging && postResult[0].data.paging.next) {
                                instagrampostUrl = postResult[0].data.paging.next;
                                return instagramPostCount();
                            } else {
                                return { instaPostCount: instaPostCount };
                            }
                        }
                        return { instaPostCount: instaPostCount };
                    } catch (error) {
                        console.log("instagramPostCount error", error)
                        return { instaPostCount: instaPostCount };
                    }
                }

                let promiseAllArr = [];
                promiseAllArr.push(instagramInsight(insightUrl))
                promiseAllArr.push(axios.get(followersUrl))
                promiseAllArr.push(instagramPostCount())
                await Promise.all(promiseAllArr).then(igResult => {
                    let resObj = {};
                    resObj['userId'] = socialdoc.socialMedia.userId;
                    resObj['name'] = igResult[1].data.username;
                    resObj['socialMedia'] = 'instagram';
                    resObj['following_count'] = igResult[1]?.data.follows_count ?? 0;
                    resObj['followers_count'] = igResult[1]?.data.followers_count ?? 0;
                    resObj['profileImage'] = igResult[1]?.data.profile_picture_url ?? "";
                    resObj['post_count'] = igResult[2]?.instaPostCount ?? 0;
                    resObj['reach'] = 0;
                    resObj['engagement'] = 0;
                    if (igResult[0].reach) {
                        resObj['reach'] = igResult[0].reach
                    }
                    if (igResult[0].engagement) {
                        resObj['engagement'] = igResult[0].engagement
                    }
                    /* igResult[0].data.data.forEach(insight => {
                        insight.insights.data.forEach(igInsight => {
                            if (igInsight.name == "reach") {
                                resObj['reach'] = resObj['reach'] + igInsight.values[0].value;
                            }
                            if (igInsight.name == "engagement") {
                                resObj['engagement'] = resObj['engagement'] + igInsight.values[0].value;
                            }
                        })
                    }); */
                    responseArr.push(resObj)

                }).catch(err => {
                    console.log("err   instagram promise all", err)
                })
            }

            // const youtube = async (socialdoc) => {
            //     let reconnectGoogle = async (refreshtoken) => {
            //         return new Promise(async (resolve, reject) => {
            //             //const requestBody = `client_secret=${client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${client_id}`;
            //             const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}`;
            //             const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
            //             try {
            //                 let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            //                 resolve({ 'token': result.data.access_token });
            //             } catch (error) {
            //                 reject({ 'token': null });
            //             }
            //         })
            //     };

            //     let promiseArr = []

            //     promiseArr.push(reconnectGoogle(socialdoc.socialMedia.refresh_token));
            //     await Promise.all(promiseArr).then(async (token) => {

            //         let dateNow = new Date().getTime();
            //         let currentdate = new Date();
            //         //var startDate = parseInt((new Date(currentdate.setDate(currentdate.getDate() - 28).getTime() / 1000)).toFixed(0));

            //         let startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));


            //         if (body && body.dateFilterType && body.dateFilterType == '7days') {
            //             currentdate = new Date();
            //             startDate = new Date(currentdate.setDate(currentdate.getDate() - 7));
            //         }
            //         if (body && body.dateFilterType && body.dateFilterType == '14days') {
            //             currentdate = new Date();
            //             startDate = new Date(currentdate.setDate(currentdate.getDate() - 14));
            //         }
            //         let newStartDate = startDate.getTime()
            //         let dateFilter = `&startDate=${moment(parseInt(newStartDate.toFixed(0))).format('YYYY-MM-DD')}&endDate=${moment(parseInt(dateNow.toFixed(0))).format('YYYY-MM-DD')}`;

            //         if (body && body.dateFilterType && body.dateFilterType == 'custom') {
            //             if (!body.toDate) {
            //                 done('422', {
            //                     message: "To date Required"
            //                 })
            //                 return;
            //             }
            //             if (!body.fromDate) {
            //                 done('422', {
            //                     message: "From date Required"
            //                 })
            //                 return;
            //             }
            //             if (parseInt(body.fromDate) > parseInt(body.toDate)) {
            //                 done('422', {
            //                     message: "From date must be less then To date"
            //                 })
            //                 return;
            //             }
            //             let fromDate = body.fromDate;
            //             let toDate = body.toDate;
            //             dateFilter = `&startDate=${moment(parseInt(fromDate)).format('YYYY-MM-DD')}&endDate=${moment(parseInt(toDate)).format('YYYY-MM-DD')}`
            //             /*           startDate = moment(parseInt(body.fromDate.toFixed(0))).format('YYYY-MM-DD'),
            //                           endDate = moment(parseInt(body.toDate.toFixed(0))).format('YYYY-MM-DD') */
            //         }
            //         let metricFunction = async () => {
            //             return new Promise((resolve, reject) => {
            //                 let metrics = 'views,comments,likes,dislikes,shares';
            //                 let url = `https://youtubeanalytics.googleapis.com/v2/reports?dimensions=day&access_token=${token[0].token}&ids=channel%3D%3D${socialdoc.socialMedia.userId}&metrics=${metrics}&sort=-day${dateFilter}`;
            //                 //let url = `https://youtubeanalytics.googleapis.com/v2/reports?dimensions=day&access_token=${token[0].token}&ids=channel%3D%3D${socialdoc.socialMedia.userId}&metrics=${metrics}  `;
            //                 let metricRes = {};
            //                 axios.get(url, null).then((metricResp) => {
            //                     if (metricResp.data) {
            //                         metricRes = metricResp.data
            //                         resolve({ metricRes: metricRes })
            //                     } else {
            //                         resolve({ metricRes: metricRes })
            //                     }
            //                 }).catch(err => {
            //                     resolve({ metricRes: metricRes })
            //                 })
            //             })
            //         }

            //         let postFunction = async () => {
            //             return new Promise((resolve, reject) => {
            //                 let postCount = 0;
            //                 //let ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${socialdoc.socialMedia.userId}&maxResults=1&type=video&access_token=${token[0].token}${pageToken}`;
            //                 let ytUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,id,contentDetails,brandingSettings,localizations,status,topicDetails&id=${socialdoc.socialMedia.userId}&access_token=${token[0].token}${pageToken}`;
            //                 axios.get(encodeURI(ytUrl), null).then((resp) => {
            //                     if (resp.data) {
            //                         postCount = resp.data
            //                         resolve({ postRes: postCount })
            //                     } else {
            //                         resolve({ postRes: postCount })
            //                     }
            //                 }).catch(err => {
            //                     resolve({ postRes: postCount })
            //                 })
            //             })
            //         }


            //         let promisefunc = [];
            //         promisefunc.push(postFunction())
            //         promisefunc.push(metricFunction())
            //         await Promise.all(promisefunc).then((resArr) => {
            //             let commentCount = 0;
            //             let shareCount = 0;
            //             let likeCount = 0;
            //             let dislikeCount = 0;
            //             let shares = 0;

            //             let resObj = {};
            //             resObj['userId'] = socialdoc.socialMedia.userId;
            //             resObj['name'] = socialdoc.socialMedia.channel_name;
            //             resObj['profileImage'] = '';
            //             resObj['socialMedia'] = 'youtube';
            //             resObj['followers_count'] = 0;
            //             resObj['post_count'] = 0;
            //             resObj['reach'] = 0;
            //             resObj['following_count'] = 0;
            //             resObj['engagement'] = 0;
            //             if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].snippet.thumbnails.default.url) {
            //                 resObj['profileImage'] = resArr[0].postRes.items[0].snippet.thumbnails.default.url;
            //             }
            //             if (resArr && resArr.length > 0 && resArr[1] && resArr[1].metricRes.rows) {
            //                 resArr[1].metricRes.rows.forEach(element => {
            //                     commentCount = commentCount + element[1]
            //                     shareCount = shareCount + element[2]
            //                     likeCount = likeCount + element[3]
            //                     dislikeCount = dislikeCount + element[4]
            //                     shares = shares + element[5]

            //                 });
            //                 resObj['engagement'] = commentCount + shareCount + likeCount + dislikeCount + shares;
            //             }
            //             if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.videoCount) {
            //                 resObj['post_count'] = resArr[0].postRes.items[0].statistics.videoCount;
            //             }
            //             if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.subscriberCount) {
            //                 resObj['followers_count'] = resArr[0].postRes.items[0].statistics.subscriberCount;
            //             }
            //             if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.viewCount) {
            //                 resObj['reach'] = resArr[0].postRes.items[0].statistics.viewCount;
            //             }

            //             responseArr.push(resObj)
            //         }).catch(err => {
            //             console.log("err...1..youtube promise all......", err)
            //         })
            //     }).catch(err => {
            //         console.log("err..2...youtube promise all......", err)
            //     })
            // }
            const youtube = async (socialdoc) => {
                let reconnectGoogle = async (refreshtoken) => {
                    return new Promise(async (resolve, reject) => {
                        //const requestBody = `client_secret=${client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${client_id}`;
                        const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}`;
                        const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                        try {
                            let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            resolve({ 'token': result.data.access_token });
                        } catch (error) {
                            reject({ 'token': null });
                        }
                    })
                };

                let promiseArr = []

                promiseArr.push(reconnectGoogle(socialdoc.socialMedia.refresh_token));
                await Promise.all(promiseArr).then(async (token) => {

                    let dateNow = new Date().getTime();
                    let currentdate = new Date();
                    //var startDate = parseInt((new Date(currentdate.setDate(currentdate.getDate() - 28).getTime() / 1000)).toFixed(0));

                    let startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));


                    if (body && body.dateFilterType && body.dateFilterType == '7days') {
                        currentdate = new Date();
                        startDate = new Date(currentdate.setDate(currentdate.getDate() - 7));
                    }
                    if (body && body.dateFilterType && body.dateFilterType == '14days') {
                        currentdate = new Date();
                        startDate = new Date(currentdate.setDate(currentdate.getDate() - 14));
                    }
                    let postFilter = `&publishedAfter=${startDate.toISOString()}`

                    let newStartDate = startDate.getTime()


                    let dateFilter = `&startDate=${moment(parseInt(newStartDate.toFixed(0))).format('YYYY-MM-DD')}&endDate=${moment(parseInt(dateNow.toFixed(0))).format('YYYY-MM-DD')}`;

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
                        let fromDate = body.fromDate;
                        let toDate = body.toDate;
                        dateFilter = `&startDate=${moment(parseInt(fromDate)).format('YYYY-MM-DD')}&endDate=${moment(parseInt(toDate)).format('YYYY-MM-DD')}`
                        /*           startDate = moment(parseInt(body.fromDate.toFixed(0))).format('YYYY-MM-DD'),
                                      endDate = moment(parseInt(body.toDate.toFixed(0))).format('YYYY-MM-DD') */
                    }

                    let metricFunction = async () => {
                        return new Promise((resolve, reject) => {
                            let metrics = 'views,comments,likes,dislikes,shares';
                            let url = `https://youtubeanalytics.googleapis.com/v2/reports?dimensions=day&access_token=${token[0].token}&ids=channel%3D%3D${socialdoc.socialMedia.userId}&metrics=${metrics}&sort=-day${dateFilter}`;
                            //let url = `https://youtubeanalytics.googleapis.com/v2/reports?dimensions=day&access_token=${token[0].token}&ids=channel%3D%3D${socialdoc.socialMedia.userId}&metrics=${metrics}  `;
                            //console.log("utube.........ggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg.........url", url)
                            let metricRes = {};
                            axios.get(url, null).then((metricResp) => {
                                if (metricResp.data) {
                                    metricRes = metricResp.data
                                    resolve({ metricRes: metricRes })
                                } else {
                                    resolve({ metricRes: metricRes })
                                }
                            }).catch(err => {
                                resolve({ metricRes: metricRes })
                            })
                        })
                    }

                    let postFunction = async () => {
                        return new Promise((resolve, reject) => {
                            let postCount = 0;
                            //let ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${socialdoc.socialMedia.userId}&maxResults=1&type=video&access_token=${token[0].token}${pageToken}`;
                            let ytUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,id,contentDetails,brandingSettings,localizations,status,topicDetails&id=${socialdoc.socialMedia.userId}&access_token=${token[0].token}${pageToken}`;
                            axios.get(encodeURI(ytUrl), null).then((resp) => {
                                if (resp.data) {
                                    postCount = resp.data
                                    resolve({ postRes: postCount })
                                } else {
                                    resolve({ postRes: postCount })
                                }
                            }).catch(err => {
                                resolve({ postRes: postCount })
                            })
                        })
                    }
                    let postcountFunction = async () => {
                        return new Promise((resolve, reject) => {
                            let postCount = 0;
                            //let ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${socialdoc.socialMedia.userId}&maxResults=1&type=video&access_token=${token[0].token}${pageToken}`;
                            //let ytPostCountUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,id,contentDetails,brandingSettings,localizations,status,topicDetails&id=${socialdoc.socialMedia.userId}&access_token=${token[0].token}${pageToken}`;


                            let ytPostCountUrl = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&channelId=${socialdoc.socialMedia.userId}${postFilter}&order=date&access_token=${token[0].token}`;
                            console.log("ytPostCountUrl",JSON.stringify(ytPostCountUrl))
                            
                            axios.get(ytPostCountUrl, null).then((resp) => {
                                if (resp.data) {
                                    console.log("resp.data",JSON.stringify(resp.data))
                                    postCount = resp.data
                                    resolve({ postCount })
                                } else {
                                    resolve({ postCount })
                                }
                            }).catch(err => {
                                resolve({ postCount })
                            })
                        })
                    }


                    let promisefunc = [];
                    promisefunc.push(postFunction())
                    promisefunc.push(metricFunction())
                    promisefunc.push(postcountFunction())
                    await Promise.all(promisefunc).then((resArr) => {
                        let commentCount = 0;
                        let shareCount = 0;
                        let likeCount = 0;
                        let dislikeCount = 0;
                        let shares = 0;
                        let viewsCount = 0;

                        let resObj = {};
                        resObj['userId'] = socialdoc.socialMedia.userId;
                        resObj['name'] = socialdoc.socialMedia.channel_name;
                        resObj['profileImage'] = '';
                        resObj['socialMedia'] = 'youtube';
                        resObj['followers_count'] = 0;
                        resObj['post_count'] = 0;
                        resObj['reach'] = 0;
                        resObj['following_count'] = 0;
                        resObj['engagement'] = 0;
                        if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].snippet.thumbnails.default.url) {
                            resObj['profileImage'] = resArr[0].postRes.items[0].snippet.thumbnails.default.url;
                        }
                        if (resArr && resArr.length > 0 && resArr[1] && resArr[1].metricRes.rows) {
                            resArr[1].metricRes.rows.forEach(element => {
                                viewsCount = viewsCount + element[1]
                                commentCount = commentCount + element[2]
                                likeCount = likeCount + element[3]
                                dislikeCount = dislikeCount + element[4]
                                shareCount = shareCount + element[5]
                                //shares = shares + element[5]

                            });

                            resObj['engagement'] = commentCount + shareCount + likeCount + dislikeCount;
                        }
                        /* if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.videoCount) {
                            resObj['post_count'] = resArr[0].postRes.items[0].statistics.videoCount;
                        } */
                        /* if (resArr && resArr[2] && resArr[2].postCount) {
                            resObj['post_count'] = resArr[2].postCount.items.length;
                        } */
                        /* if (resArr && resArr[2] && resArr[2].postCount.items && resArr[2].postCount.items.length > 0) {
                            resObj['post_count'] = resArr[2].postCount.items.length;
                        } */
                        if (resArr && resArr[2] && resArr[2].postCount.pageInfo && resArr[2].postCount.pageInfo.totalResults) {
                            resObj['post_count'] = resArr[2].postCount.pageInfo.totalResults;
                        }
                        if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.subscriberCount) {
                            resObj['followers_count'] = resArr[0].postRes.items[0].statistics.subscriberCount;
                        }
                        /* if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.viewCount) {
                            resObj['reach'] = resArr[0].postRes.items[0].statistics.viewCount;
                        } */
                        resObj['reach'] = viewsCount;
 
                        
                        responseArr.push(resObj)
                    }).catch(err => {
                        console.log("err...1..youtube promise all......", err)
                    })
                }).catch(err => {
                    console.log("err..2...youtube promise all......", err)
                })
            }

            const googlemybusiness = async (socialdoc) => {
                let reconnectGoogle = async (refreshtoken) => {
                    return new Promise(async (resolve, reject) => {
                        const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                        //const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}&redirect_uri=${google_redirect_uri}`;
                        const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}&redirect_uri=${google_redirect_uri}`;
                        try {
                            let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            resolve({ 'token': result.data.access_token });
                        }
                        catch (error) {

                            reject({ 'token': null });
                        }
                    })
                };

                let promiseArr = []

                promiseArr.push(reconnectGoogle(socialdoc.socialMedia.refresh_token));
                await Promise.all(promiseArr).then(async (token) => {

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
                    // let dateFilter = `&start_time=${startDate.toISOString()}&end_time=${dateNow.toISOString()}`;
                    endDate = dateNow.toISOString()
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
                        startDate = new Date(parseInt(body.fromDate)).toISOString()
                        endDate = new Date(parseInt(body.toDate)).toISOString()
                    }


                    let insight = async () => {
                        return new Promise((resolve, reject) => {
                            let gmbUrl = `https://mybusiness.googleapis.com/v4/accounts/${socialdoc.socialMedia.userId}/locations/${socialdoc.socialMedia.locationId}/reviews`;
                            axios.get(gmbUrl, { headers: { 'Authorization': 'Bearer ' + token[0].token } }).then((resp) => {
                                if (resp.data) {
                                    resolve(resp.data)
                                } else {
                                    resolve({})
                                }
                            }).catch(err => {
                                resolve({})
                            })
                        })
                    }
                    let metric = async () => {
                        return new Promise((resolve, reject) => {
                            // let endDate = new Date();
                            // let nowDate = new Date();
                            // let startDate = new Date(nowDate.setFullYear(nowDate.getFullYear() - 1));
                            metricReq = {
                                "locationNames": [
                                    `accounts/${socialdoc.socialMedia.userId}/locations/${socialdoc.socialMedia.locationId}`
                                ],
                                "basicRequest": {
                                    "metricRequests": [
                                        {
                                            "metric": "ALL"
                                        },
                                        // {
                                        //     "metric": "LOCAL_POST_VIEWS_SEARCH"
                                        // },
                                        // {
                                        //     "metric": "LOCAL_POST_ACTIONS_CALL_TO_ACTION"
                                        // },
                                        // {
                                        //     "metric": "VIEWS_MAPS"
                                        // }
                                    ],
                                    "timeRange": {
                                        "startTime": startDate,
                                        "endTime": endDate
                                    }
                                }
                            }

                            //let metricUrl = `https://mybusiness.googleapis.com/v4/accounts/${socialdoc.socialMedia.userId}/locations/${socialdoc.socialMedia.locationId}/reviews`;
                            let metricUrl = `https://mybusiness.googleapis.com/v4/accounts/${socialdoc.socialMedia.userId}/locations:reportInsights`;
                            axios.post(metricUrl, metricReq, { headers: { 'Authorization': 'Bearer ' + token[0].token } }).then((res) => {
                                if (res.data) {
                                    resolve(res.data)
                                } else {
                                    resolve({})
                                }
                            }).catch(err => {
                                resolve({})
                            })
                        })
                    }


                    let promisefunc = [];
                    promisefunc.push(insight())
                    promisefunc.push(metric())

                    await Promise.all(promisefunc).then((resArr) => {
                        let resObj = {};
                        resObj['userId'] = socialdoc.socialMedia.userId;
                        resObj['locationId'] = socialdoc.socialMedia.locationId;
                        resObj['name'] = socialdoc.socialMedia.channel_name;
                        resObj['profileImage'] = socialdoc.socialMedia.userProfileImage;
                        resObj['socialMedia'] = 'googlemybusiness';
                        resObj['followers_count'] = 0;
                        resObj['post_count'] = 0;
                        resObj['reach'] = 0;
                        resObj['following_count'] = 0;
                        resObj['engagement'] = 0;

                        if (resArr[0]) {

                            resObj['engagement'] = resArr[0].totalReviewCount;
                        }
                        if (resArr[1] && resArr[1].locationMetrics[0]) {
                            /* if (resArr[1].locationMetrics[0] && resArr[1].locationMetrics[0].metricValues[0].metric == "VIEWS_SEARCH") {
                                resObj['reach'] = resArr[1].locationMetrics[0].metricValues[0].totalValue.value;
                            } */
                            if (resArr[1].locationMetrics[0] && resArr[1].locationMetrics[0].metricValues[4].metric == "VIEWS_SEARCH") {
                                resObj['reach'] = parseInt(resObj['reach']) + parseInt(resArr[1].locationMetrics[0].metricValues[4].totalValue.value);
                            }
                            if (resArr[1].locationMetrics[0] && resArr[1].locationMetrics[0].metricValues[3].metric == "VIEWS_MAPS") {
                                resObj['reach'] = parseInt(resObj['reach']) + parseInt(resArr[1].locationMetrics[0].metricValues[3].totalValue.value);
                            }
                        }

                        responseArr.push(resObj)

                    }).catch(err => {
                        console.log("err...1..googlemybusiness promise all......", err)
                    })
                }).catch(err => {
                    console.log("err...2..googlemybusiness promise all......", err)
                })
            }

            for (let i = 0; i < doc.length; i++) {
                switch (doc[i].socialMedia.name) {
                    case "linkedin":
                        promiseArr.push(linkedin(doc[i]));
                        break;
                    case "twitter":
                        promiseArr.push(twitter(doc[i]));
                        break;
                    case "facebook":
                        promiseArr.push(facebook(doc[i]));
                        break;
                    case "youtube":
                        promiseArr.push(youtube(doc[i]));
                        break;
                    case "instagram":
                        promiseArr.push(instagram(doc[i]));
                        break;
                    case "googlemybusiness":
                        promiseArr.push(googlemybusiness(doc[i]));
                        break;
                    default:
                        break;
                }
            }

            Promise.all(promiseArr).then(resArr => {
                if (resArr.length > 0) {
                    let data = {}
                    if (responseArr.length > 0) {
                        resolve({ analiticsData: responseArr.flat() })
                    } else {
                        resolve({ analiticsData: responseArr })
                    }
                } else {
                    done('200', {
                        message: "Dashboard Data Not Found",
                        data: {}
                    });
                }
            })
        })
    }

    function schedulePostCount(email) {
        return new Promise(async (resolve, reject) => {
            var today = new Date().setHours(0, 0, 0, 0)
            var tomorrow = new Date().setHours(24, 0, 0, 0)
            let query = []
            query.push({ $match: { 'userId': email } }, { $unwind: '$scheduledPost' })

            let scheduledPostCount = 0;
            scheduledPost.aggregate(query).then((scheduledData) => {
                if (scheduledData && scheduledData.length > 0) {
                    scheduledData.forEach(element => {
                        if (new Date(element.scheduledPost.scheduleTime).getTime() >= new Date(today).getTime() && new Date(element.scheduledPost.scheduleTime).getTime() <= new Date(tomorrow).getTime()) {
                            let postcount = element.scheduledPost.tweetData.length + element.scheduledPost.fbpost.length + element.scheduledPost.linkedInData.length;
                            //scheduledPostCount = scheduledPostCount + 1 ;
                            if (element.scheduledPost.youtubeData && element.scheduledPost.youtubeData.length > 0) {
                                postcount = postcount + element.scheduledPost.youtubeData.length;
                            }
                            if (element.scheduledPost.instagramData && element.scheduledPost.instagramData.length > 0) {
                                postcount = postcount + element.scheduledPost.instagramData.length;
                            }
                            if (element.scheduledPost.gmbData && element.scheduledPost.gmbData.length > 0) {
                                postcount = postcount + element.scheduledPost.gmbData.length;
                            }
                            scheduledPostCount = scheduledPostCount + postcount;
                        }
                    });
                    resolve({
                        scheduledPost: scheduledPostCount
                    });
                } else {
                    resolve({
                        scheduledPost: scheduledPostCount
                    });
                }
            }).catch(err => {
                resolve({
                    scheduledPost: scheduledPostCount
                });
            })
        })
    }

    const recentpost = async (doc, email) => {
        return new Promise(async (resolve, reject) => {
            let responseArr = [];
            let linkedInData = [];
            let linkedInDataArr = [];
            let fbpost = [];
            const promiseArrayRecentpost = [];


            const twitterPost = async (email, socialDoc) => {
                console.log("twitter recent post")
                try {
                    var url = ''
                    var count = 2;
                    if (body && body['count']) {
                        count = body['count']
                    }
                    url = "https://api.twitter.com/1.1/statuses/user_timeline.json?count=" + count + '&tweet.fields=attachments,conversation_id,created_at,geo,public_metrics,referenced_tweets,source,text&expansions=pinned_tweet_id,attachments.media_keys,referenced_tweets.id&media.fields=url,type,preview_image_url&user.fields=public_metrics,name'

                    const request = {
                        url: url,
                        method: 'GET',
                        body: {}
                    }
                    //const authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia.oauth_token, socialDoc.socialMedia.oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
                    const authHeader = AuthHelper.getAuthHeaderForRequest(request, socialDoc.socialMedia.oauth_token, socialDoc.socialMedia.oauth_token_secret, CONSUMERKEY, CONSUMERSECRET);
                    var res1 = await axios.get(encodeURI(url), { headers: authHeader })

                    console.log("res1.data", JSON.stringify(res1.data))

                    if (res1 && res1.data) {
                        let twitIds = [];
                        res1.data.forEach(tweet => {
                            twitIds.push(tweet.id_str);
                        });
                        let request1 = {
                            url: 'https://api.twitter.com/2/tweets?ids=' + twitIds + '&tweet.fields=attachments,created_at,geo,public_metrics,referenced_tweets,source,text&expansions=attachments.media_keys,referenced_tweets.id&media.fields=url,type,media_key,preview_image_url',
                            method: 'GET',
                            body: {}
                        }

                        //const authHeader1 = AuthHelper.getAuthHeaderForRequest(request1, socialDoc.socialMedia.oauth_token, socialDoc.socialMedia.oauth_token_secret, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
                        const authHeader1 = AuthHelper.getAuthHeaderForRequest(request1, socialDoc.socialMedia.oauth_token, socialDoc.socialMedia.oauth_token_secret, CONSUMERKEY, CONSUMERSECRET);
                        var res = await axios.get(encodeURI(request1.url), { headers: authHeader1 })

                        res1.data.forEach(resp => {
                            let resObj = {};
                            let tweetObj = {};
                            resObj.postData = {};
                            resObj.postData.tweetData = [];
                            tweetObj["mediaUrl"] = [];
                            tweetObj['postStatus'] = "Posted";
                            tweetObj['postDate'] = resp.created_at;
                            tweetObj['screen_name'] = resp.user.screen_name;
                            tweetObj['name'] = resp.user.screen_name;
                            tweetObj['mediaType'] = "text";
                            tweetObj["thumbnail"] = '';
                            tweetObj['profileImage'] = socialDoc.socialMedia.userProfileImage || "";
                            tweetObj['userId'] = resp.user.id_str;
                            tweetObj["postId"] = resp.id_str;
                            resObj['createdAt'] = resp.created_at;
                            resObj['userId'] = email;
                            resObj.postData['postTime'] = resp.created_at;
                            resObj.postData['postStatus'] = "Posted";
                            resObj.postData['postData'] = resp.text;
                            if (resObj.postData['postData'].includes(":")) {
                                let splitText = resObj.postData['postData'].split(":");
                                if (splitText[0] && splitText[0].includes('RT')) {
                                    resObj.postData['postData'] = resObj.postData['postData'].split(/:(.+)/)[1].trim()
                                }
                            }
                            if (resp.entities && resp.entities.urls && resp.entities.urls.length > 0) {
                                tweetObj['mediaType'] = "link";
                                //tweetObj["thumbnail"] = '';
                            }
                            if (resp.extended_entities) {
                                if (resp.extended_entities.media && resp.extended_entities.media.length > 0) {
                                    //tweetObj['mediaType'] = resp.extended_entities.media[0].type;

                                    if (resp.extended_entities.media[0].type == 'photo') {
                                        tweetObj['mediaType'] = 'image'
                                        tweetObj["mediaUrl"] = [resp.extended_entities.media[0].media_url]
                                        //tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url;
                                    } else if (resp.extended_entities.media[0].type == 'video' || resp.extended_entities.media[0].type == "animated_gif") {
                                        tweetObj['mediaType'] = 'video'
                                        if (resp.extended_entities.media[0]?.video_info?.variants[0]?.content_type == "video/mp4") {
                                            tweetObj["mediaUrl"] = [resp.extended_entities.media[0].video_info.variants[0].url];
                                            tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url
                                        } else if (resp.extended_entities.media[0]?.video_info?.variants[1]?.content_type == "video/mp4") {
                                            tweetObj["mediaUrl"] = [resp.extended_entities.media[0].video_info.variants[1].url]
                                            tweetObj["thumbnail"] = resp.extended_entities.media[0].media_url;
                                        }
                                    }
                                    /* else if(resp.extended_entities.media[0].type == 'animated_gif'){
    
                                    } */

                                    if (resp.text.includes("https://t.co")) {
                                        var textIndex = resObj.postData['postData'].lastIndexOf(" ");
                                        resObj.postData['postData'] = resObj.postData['postData'].substring(0, textIndex).trim()
                                    }
                                }
                            }
                            if (resp.entities.urls && resp.entities.urls.length > 0) {
                                tweetObj["linkObj"] = resp.entities.urls.map(urlsData => {
                                    if (resObj.postData['postData'].includes(urlsData.url)) {
                                        let textIndex = resObj.postData['postData'].indexOf(urlsData.url)
                                        //resObj.postData['postData'] = resObj.postData['postData'].slice(0, textIndex) + urlsData.display_url + resObj.postData['postData'].slice(textIndex + 1)
                                        //resObj.postData['postData'] = resObj.postData['postData'].slice(0, textIndex) + urlsData.display_url + resObj.postData['postData'].splice(textIndex + resObj.postData['postData'].lastIndexOf(urlsData.url))
                                        resObj.postData['postData'] = resObj.postData['postData'].substring(0, textIndex).trim();
                                    }
                                    delete urlsData["indices"];
                                    return urlsData
                                })
                            }
                            //console.log("res.data.data",JSON.stringify(res.data.data))

                            res.data.data.forEach(elem => {
                                if (elem.id == resp.id_str) {
                                    //resObj['public_metrics'] = res.data.data[0].public_metrics;
                                    resObj['public_metrics'] = elem.public_metrics;
                                }
                                if (resp?.retweeted_status?.id_str && resp.retweeted_status.id_str === elem.id) {
                                    resObj['public_metrics']['like_count'] = resp.retweeted_status.favorite_count;
                                }
                            });
                            resObj.postData.tweetData.push(tweetObj)
                            responseArr.push(resObj)
                        });
                    }

                } catch (error) {
                    console.log("error...recentpost twitter catch...........", error)

                }

            }
            const linkedInPost = async (email, socialDoc) => {

                if (socialDoc.socialMedia.linkedinPages && socialDoc.socialMedia.linkedinPages.length > 0) {

                    var queryStringParameters = "&count=2";
                    if (body && body['count']) {
                        queryStringParameters = "&count=" + body['count']
                    }
                    for await (const linkedinPages of socialDoc.socialMedia.linkedinPages) {
                        try {
                            //var linkedinUrl = "https://api.linkedin.com/v2/shares?q=owners&owners=" + linkedinPages.pageId + "&sortBy=LAST_MODIFIED" + queryStringParameters
                            var linkedinUrl = "https://api.linkedin.com/v2/ugcPosts?q=authors&authors[0]=" + linkedinPages.pageId + queryStringParameters + "&projection=(paging,elements*(name,localizedName,id,firstPublishedAt,vanityName,created,specificContent(reactions,com.linkedin.ugc.ShareContent(shareMediaCategory,shareCommentary,media(*(media~:playableStreams,originalUrl,thumbnails,description,title))))))"
                            var linkedInRes = await axios.get(linkedinUrl, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia.oauth_token } });


                            if (linkedInRes.data && linkedInRes.data.elements && linkedInRes.data.elements.length) {
                                let linkedinIds = '';
                                linkedInRes.data.elements.forEach(post => {
                                    if (linkedinIds === "") {
                                        linkedinIds = "ids=" + post.id;
                                        //linkedinIds.concat("ids=" + post.id)
                                    } else {
                                        //linkedinIds.concat("&ids=" + post.id)
                                        linkedinIds = linkedinIds + "&ids=" + post.id;
                                    }
                                });

                                //var socialActionData = await axios.get('https://api.linkedin.com/v2/socialActions/' + linkedInRes.data.elements[0].activity,
                                if (linkedinIds.length > 0) {
                                    let socialActionUrl = 'https://api.linkedin.com/v2/socialActions?' + linkedinIds;
                                    var socialActionData = await axios.get(socialActionUrl, { headers: { 'Authorization': 'Bearer ' + socialDoc.socialMedia.oauth_token } })
                                }
                                linkedInRes.data.elements.forEach(linkedInresp => {
                                    if (linkedInresp.id) {
                                        let resObj = {};
                                        let linkedInObj = {};
                                        resObj.postData = {};
                                        resObj.postData.linkedInData = [];
                                        resObj['createdAt'] = linkedInresp.created.time;
                                        linkedInObj['postStatus'] = "Posted";
                                        linkedInObj['postDate'] = linkedInresp.created.time;
                                        linkedInObj['userId'] = socialDoc.socialMedia.userId;
                                        linkedInObj['pageId'] = linkedInresp.owner;
                                        linkedInObj['likes'] = 0;
                                        linkedInObj['comments'] = 0;
                                        linkedInObj['mediaType'] = "text";
                                        linkedInObj["thumbnail"] = '';

                                        linkedInObj['name'] = linkedinPages.pageName || "";
                                        linkedInObj['profileImage'] = linkedinPages.pageImage || "";

                                        if (socialActionData && socialActionData.data && socialActionData.data.results) {
                                            linkedInObj['likes'] = socialActionData.data?.results[linkedInresp.id]?.likesSummary?.totalLikes ?? 0;
                                            linkedInObj['comments'] = socialActionData.data?.results[linkedInresp.id]?.commentsSummary?.aggregatedTotalComments ?? 0;
                                        }
                                        // let splitId = linkedInresp.id.split(':');
                                        // linkedInObj["postId"] = "urn:li:share:" + splitId[splitId.length - 1];
                                        linkedInObj["postId"] = linkedInresp.id;
                                        linkedInObj["mediaUrl"] = [];
                                        resObj['userId'] = email;
                                        resObj.postData['fbpost'] = fbpost;
                                        resObj.postData['postTime'] = linkedInresp.created.time;
                                        resObj.postData['postStatus'] = "Posted";
                                        resObj.postData['postData'] = decodeURI(linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary.text);

                                        /* if (linkedInresp.content && linkedInresp.content.contentEntities && linkedInresp.content.contentEntities.length > 0) {
                                            linkedInObj["mediaUrl"] = linkedInresp.content.contentEntities.map(mediaData => {
                                                return mediaData.entityLocation
                                            })
                                        } */
                                        if (linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'IMAGE') {
                                            linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.media?.map(image => {
                                                linkedInObj['mediaType'] = "image";
                                                if (image.originalUrl) {
                                                    linkedInObj["mediaUrl"].push(image.originalUrl)
                                                }
                                            });
                                        } else if (linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'ARTICLE') {
                                            linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.media?.map(link => {
                                                linkedInObj['mediaType'] = "link";
                                                linkedInObj["thumbnail"] = link?.thumbnails[0]?.url
                                                linkedInObj["mediaUrl"] = [link?.originalUrl]
                                            });
                                        } else if (linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'VIDEO' || linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory == 'RICH') {
                                            linkedInresp.specificContent?.['com.linkedin.ugc.ShareContent']?.media[0]?.['media~']?.elements?.map(video => {
                                                if (video?.identifiers[0]?.mediaType == 'video/mp4') {
                                                    if (video?.identifiers[0]?.identifier?.includes('-720p')) {
                                                        linkedInObj['mediaType'] = "video";
                                                        linkedInObj["mediaUrl"] = [video?.identifiers[0]?.identifier]
                                                    }
                                                }
                                            });
                                        }
                                        resObj.postData.linkedInData.push(linkedInObj)
                                        responseArr.push(resObj)
                                    }

                                })

                                //linkedInDataArr.push(linkedInRes.data.elements)
                            }

                        } catch (error) {
                            console.log("error...recentpost linkedin catch...........", error)
                        }
                    }
                    /* if (linkedInDataArr.length > 0) {
                        let flatArr = linkedInDataArr.flat()
                        flatArr.forEach(linkedInresp => {
                            let resObj = {};
                            let linkedInObj = {};
                            resObj.postData = {};
                            resObj.postData.linkedInData = [];
                            resObj['createdAt'] = linkedInresp.created.time;
                            linkedInObj['postStatus'] = "Posted";
                            linkedInObj['postDate'] = linkedInresp.created.time
                            linkedInObj['userId'] = socialDoc.socialMedia.userId;
                            linkedInObj['pageId'] = linkedInresp.owner;

                            linkedInObj['name'] = socialDoc.socialMedia.userProfileImage || "";
                            linkedInObj['profileImage'] = socialDoc.socialMedia.userProfileImage || "";

                            linkedInObj['likes'] = merged.likesSummary.totalLikes || 0;
                            linkedInObj['comments'] = merged.commentsSummary.aggregatedTotalComments || 0;

                            linkedInObj["postId"] = "urn:li:share:" + linkedInresp.id;
                            linkedInObj["mediaUrl"] = [];
                            resObj['userId'] = email;
                            resObj.postData['fbpost'] = fbpost;
                            resObj.postData['postTime'] = linkedInresp.created.time;
                            resObj.postData['postStatus'] = "Posted";
                            resObj.postData['postData'] = linkedInresp.text.text;

                            if (linkedInresp.content && linkedInresp.content.contentEntities && linkedInresp.content.contentEntities.length > 0) {
                                linkedInObj["mediaUrl"] = linkedInresp.content.contentEntities.map(mediaData => {
                                    return mediaData.entityLocation
                                })
                            }
                            resObj.postData.linkedInData.push(linkedInObj)
                            responseArr.push(resObj)
                        });

                    } */
                }
            }
            const facebookPost = async (email, socialDoc) => {

                if (socialDoc.socialMedia.fbpages && socialDoc.socialMedia.fbpages.length > 0) {
                    let fbDataArr = []
                    for await (const fbPages of socialDoc.socialMedia.fbpages) {
                        let limit = "limit=" + 2;
                        if (body && body['count']) {
                            limit = "limit=" + body.count;
                        }
                        let addQueryParams = "";
                        if (fbPages.type == "page") {
                            addQueryParams = ",likes.summary(true),comments.summary(true)"
                        }
                        try {
                            let fbUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&pretty=0&${limit}&fields=location,image,message,created_time,attachments,from,parent_id,story${addQueryParams}`;
                            //let fbUrl = `https://graph.facebook.com/${fbPages.id}/feed?&access_token=${fbPages.access_token}&pretty=0&${limit}&fields=location,message,created_time,attachments,from,parent_id,story,likes.summary(true),comments.summary(true)`;

                            let feed = await axios.get(fbUrl)
                            if (feed.data && feed.data.data) {
                                let feedsData = feed.data.data.map(v => ({ ...v, socialName: fbPages.name, socialType: fbPages.type, profileImage: fbPages.image || "" }))
                                fbDataArr.push(feedsData)
                            }
                        } catch (error) {
                            console.log("error in facebook recent post...", JSON.stringify(error))
                        }

                    }
                    if (fbDataArr.length > 0) {
                        let flatArr = fbDataArr.flat()

                        flatArr.forEach(fbResp => {
                            let resObj = {};
                            let fbObj = {};
                            resObj.postData = {};
                            resObj.postData['fbpost'] = [];
                            resObj['createdAt'] = fbResp.created_time;
                            fbObj['postStatus'] = "Posted";
                            fbObj['postDate'] = fbResp.created_time;
                            fbObj['userId'] = socialDoc.socialMedia.userId;
                            let id = "id";
                            let name = "name";
                            fbObj['like'] = 0
                            fbObj['comments'] = 0
                            fbObj['profileImage'] = fbResp.profileImage || "";

                            if (fbResp.socialType == "page") {
                                if (fbResp.likes && fbResp.likes.summary && fbResp.likes.summary.total_count) {
                                    fbObj['like'] = fbResp.likes.summary.total_count;
                                }
                                if (fbResp.comments && fbResp.comments.summary && fbResp.comments.summary.total_count) {
                                    fbObj['comments'] = fbResp.comments.summary.total_count;
                                }
                                // id = "pageId";
                                // name = "pageName";
                            }
                            //  else if (fbResp.socialType == "group") {
                            //     id = "groupId";
                            //     name = "groupName";
                            // }

                            if (fbResp.socialName) {
                                fbObj[name] = fbResp.socialName;
                            } else {
                                fbObj[name] = fbResp.from.name;
                            }
                            if (fbResp.id.includes('_')) {
                                let splitPostId = fbResp.id.split("_");
                                fbObj[id] = splitPostId[0]
                            } else {
                                fbObj[id] = fbResp.from.id;
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
                            if (fbResp.attachments && fbResp.attachments.data && fbResp.attachments.data[0]
                                && fbResp.attachments.data[0].subattachments && fbResp.attachments.data[0].subattachments.data && fbResp.attachments.data[0].subattachments.data.length > 0) {
                                fbObj['mediaType'] = "image";
                                fbObj["mediaUrl"] = fbResp.attachments.data[0].subattachments.data.flatMap(mediaData => {
                                    if (mediaData.media && mediaData.media.image && mediaData.media.image.src) {
                                        return mediaData.media.image.src
                                    } else {
                                        return []
                                    }
                                })
                            } else if (fbResp.attachments && fbResp.attachments.data && fbResp.attachments.data[0] && !fbResp.attachments.data[0].subattachments) {
                                //fbObj["mediaUrl"] = fbResp.attachments.data.flatMap(mediaData => {
                                fbResp.attachments.data.flatMap(mediaData => {
                                    if (mediaData?.media?.image?.src && (mediaData.type == "share" || mediaData.type == "link")) {
                                        fbObj['mediaType'] = "link";
                                    }
                                    if (mediaData?.media?.image?.src && (mediaData.type == "photo" || mediaData.type == "album")) {
                                        fbObj['mediaType'] = "image";
                                        //fbObj["thumbnail"] = mediaData.media.image.src;
                                        fbObj["mediaUrl"] = [mediaData.media.image.src]
                                    } else if (mediaData?.media?.image?.src && (mediaData.type == "video_inline" || mediaData.type == "video" || mediaData.type == "animated_image_video")) {
                                        fbObj['mediaType'] = "video";
                                        fbObj["thumbnail"] = mediaData.media.image.src;
                                        fbObj["mediaUrl"] = [mediaData.media.source]
                                    }
                                })
                            }
                            resObj.postData['fbpost'].push(fbObj)
                            responseArr.push(resObj);
                        });
                    }
                }

            }

            const instagramPost = async (email, socialDoc) => {

                var limit = 2;
                if (body && body['count']) {
                    limit = "limit=" + body.count;
                }
                try {
                    //let fbUrl = `https://graph.facebook.com/v12.0/${socialDoc.socialMedia.userId}/media?fields=timestamp,business_discovery,media_url,thumbnail_url,media_type,owner,ig_id,comments_count,like_count,is_comment_enabled,media_product_type,username,video_title,children{media_url,thumbnail_url},caption&${limit}&access_token=${socialDoc.socialMedia.oauth_token}`;
                    let fbUrl = `https://graph.facebook.com/v12.0/${socialDoc.socialMedia.userId}/media?fields=profile_picture_url,timestamp,business_discovery,media_url,media_type,owner,ig_id,comments_count,like_count,is_comment_enabled,media_product_type,username,video_title,children{media_url,thumbnail_url},caption&${limit}&access_token=${socialDoc.socialMedia.oauth_token}`;

                    let res = await axios.get(fbUrl)
                    if (res && res.data && res.data.data && res.data.data.length > 0) {
                        res.data.data.forEach(resp => {
                            let resObj = {};
                            let instaobj = {};
                            resObj.postData = {};
                            resObj.public_metrics = {};
                            resObj.postData.instaData = [];
                            resObj['createdAt'] = resp.timestamp;
                            resObj['userId'] = email;
                            // resObj['postTime'] = resp.timestamp;
                            instaobj['postStatus'] = "Posted";
                            instaobj['postDate'] = resp.timestamp;
                            instaobj['userId'] = resp.owner.id;
                            resObj.public_metrics.like_count = resp.like_count;
                            resObj.public_metrics.comment_count = resp.comments_count;
                            // instaobj['like'] = resp.like_count;
                            // instaobj['comments'] = resp.comments_count;
                            instaobj['profileImage'] = socialDoc.socialMedia.userProfileImage;
                            instaobj['name'] = resp.username;
                            instaobj["postId"] = resp.id;
                            instaobj['postData'] = resp.caption
                            instaobj["mediaUrl"] = [resp.media_url];
                            resObj['createdAt'] = resp.timestamp;
                            resObj['userId'] = email;
                            resObj.postData['postTime'] = resp.timestamp;
                            resObj.postData['postStatus'] = "Posted";
                            resObj.postData['postData'] = resp.caption;
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
                            resObj.postData.instaData.push(instaobj)
                            responseArr.push(resObj)
                        });

                    }
                } catch (error) {
                    console.log("error...recentpost instagramPost catch...........", error)
                }
            }
            const youtubePost = async (email, socialDoc) => {
                let promiseArr = [];
                var count = 2;
                if (body && body['count']) {
                    count = body['count']
                }

                let reconnectGoogle = async (refreshtoken) => {
                    return new Promise(async (resolve, reject) => {
                        //const requestBody = `client_secret=${client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${client_id}`;
                        const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}`;
                        const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                        try {
                            let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            resolve({ 'token': result.data.access_token });
                        } catch (error) {
                            console.log("error", JSON.stringify(error.message))
                            reject({ 'token': null });
                        }
                    })
                };

                promiseArr.push(reconnectGoogle(socialDoc.socialMedia.refresh_token));

                await Promise.all(promiseArr).then(async (resArr) => {
                    if (resArr) {
                        let pageToken = '';

                        /* if (body.youtubePagenation && body.youtubePagenation.length > 0) {
                           let pagingObj = body.youtubePagenation.find(obj => obj.id == socialDoc.socialMedia.userId)
                           if (pagingObj.previous) {
                               pageToken = `&pageToken=${pagingObj.previous}`;
                           }
                           if (pagingObj.next) {
                               pageToken = `&pageToken=${pagingObj.next}`;
                           }
                       } */
                        //let ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${socialDoc.socialMedia.userId}&maxResults=${count}&type=video&access_token=${resArr[0].token}${pageToken}`;
                        let ytUrl = `https://youtube.googleapis.com/youtube/v3/search?channelId=${socialDoc.socialMedia.userId}&order=date&maxResults=${count}&type=video&access_token=${resArr[0].token}${pageToken}`;
                        try {
                            let feed = await axios.get(encodeURI(ytUrl), null)
                            if (feed && feed.data) {
                                const videoId = feed.data.items.map(map => map.id.videoId);
                                if (videoId !== '') {
                                    let likeurl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&access_token=${resArr[0].token}&part=snippet,status,statistics`
                                    let videos = await axios.get(likeurl, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                                    let ytResp = videos.data;
                                    if (ytResp.items && ytResp.items.length > 0) {
                                        ytResp.items.forEach(videoRes => {
                                            let resObj = {};
                                            let ytobj = {};
                                            resObj.postData = {};
                                            resObj.postData.youtubeData = [];
                                            resObj.userId = email;
                                            ytobj["mediaUrl"] = [];
                                            ytobj['postStatus'] = "Posted";
                                            ytobj['mediaType'] = "video";
                                            ytobj['userId'] = socialDoc.socialMedia.userId;
                                            ytobj['profileImage'] = socialDoc?.socialMedia?.userProfileImage ?? "";
                                            ytobj["postId"] = videoRes.id;
                                            ytobj["mediaUrl"].push(`https://www.youtube.com/embed/${videoRes.id}`);
                                            ytobj["thumbnail_size"] = ['default.jpg', 'mqdefault.jpg', 'hqdefault.jpg'];
                                            resObj['createdAt'] = videoRes.snippet.publishedAt;
                                            resObj.postData['postData'] = videoRes.snippet.title;
                                            ytobj['postDate'] = videoRes.snippet.publishedAt;
                                            ytobj['channelName'] = videoRes.snippet.channelTitle;
                                            ytobj['name'] = videoRes.snippet.channelTitle;
                                            ytobj["description"] = videoRes.snippet.description;
                                            ytobj["comments"] = videoRes.statistics.commentCount;
                                            ytobj["like"] = videoRes.statistics.likeCount;
                                            ytobj["thumbnail"] = videoRes.snippet.thumbnails.default.url;
                                            //ytobj["mediaUrl"] = [`https://www.youtube.com/watch?v=${videoRes.id.videoId}`];
                                            resObj.postData['youtubeData'].push(ytobj);
                                            responseArr.push(resObj);
                                        });
                                    }
                                }
                                /*  if (ytResp.nextPageToken || ytResp.prevPageToken) {
                                     let youtubePagenObj = {};
                                     youtubePagenObj.id = socialDoc.socialMedia.userId;
                                     youtubePagenObj.previous = ytResp.prevPageToken ? ytResp.prevPageToken : '';
                                     youtubePagenObj.next = ytResp.nextPageToken ? ytResp.nextPageToken : '';
                                     youtubePagenation.push(youtubePagenObj)
                                 } */
                            }
                        } catch (error) {
                            console.log("error..", error.message)
                        }
                    }
                }).catch(err => {
                    console.log("err", JSON.stringify(err.message))
                })
            }

            const googelMyBussinessPost = async (email, socialDoc) => {
                let promiseArr = [];
                var count = 2;
                if (body && body['count']) {
                    count = body['count']
                }

                let reconnectGoogle = async (refreshtoken) => {
                    return new Promise(async (resolve, reject) => {
                        const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
                        //const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}&redirect_uri=${google_redirect_uri}`;
                        const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}&redirect_uri=${google_redirect_uri}`;
                        try {
                            let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            resolve({ 'token': result.data.access_token });
                        }
                        catch (error) {
                            console.log("error", JSON.stringify(error))
                            reject({ 'token': null });
                        }
                    })
                };

                promiseArr.push(reconnectGoogle(socialDoc.socialMedia.refresh_token));

                await Promise.all(promiseArr).then(async (resArr) => {
                    if (resArr && resArr.length > 0) {

                        let gmbUrl = `https://mybusinessaccountmanagement.googleapis.com/v4/accounts/${socialDoc.socialMedia.userId}/locations/${socialDoc.socialMedia.locationId}/localPosts?pageSize=${count}`;
                        //let gmbUrl = `https://mybusinessaccountmanagement.googleapis.com/v4/accounts/${socialDoc.socialMedia.userId}/locations/${socialDoc.socialMedia.locationId}/localPosts`;


                        try {
                            let feed = await axios.get(gmbUrl, { headers: { 'Authorization': 'Bearer ' + resArr[0].token } })
                            let gmbArray = [];
                            feed.data.localPosts.forEach(name => {
                                gmbArray.push(name.name)
                            });
                            let endDate = new Date();
                            let nowDate = new Date();
                            let startDate = new Date(nowDate.setFullYear(nowDate.getFullYear() - 1));
                            let metricReq = {
                                "localPostNames": gmbArray,
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
                            let metricUrl = `https://mybusiness.googleapis.com/v4/accounts/${socialDoc.socialMedia.userId}/locations/${socialDoc.socialMedia.locationId}/localPosts:reportInsights`
                            let insightCount = await axios.post(metricUrl, metricReq, { headers: { 'Authorization': 'Bearer ' + resArr[0].token } })
                            if (feed && feed.data) {
                                let gmbResp = feed.data;
                                if (gmbResp.localPosts && gmbResp.localPosts.length > 0) {
                                    gmbResp.localPosts.forEach(gmbRes => {
                                        let id = gmbRes.name.split('/')
                                        let postId = id[5]
                                        let resObj = {};
                                        let gmbObj = {};
                                        resObj.postData = {};
                                        resObj.postData.gmbData = [];
                                        resObj.userId = email;
                                        gmbObj["mediaUrl"] = [];
                                        gmbObj['postStatus'] = "Posted";
                                        gmbObj["mediaType"] = "";
                                        gmbObj['userId'] = socialDoc.socialMedia.userId;
                                        gmbObj['profileImage'] = socialDoc?.socialMedia?.userProfileImage ?? "";
                                        gmbObj['locationId'] = socialDoc.socialMedia.locationId;
                                        gmbObj["postId"] = postId;
                                        gmbObj["thumbnail"] = "";
                                        resObj['createdAt'] = gmbRes.createTime;
                                        resObj.postData['postData'] = gmbRes.summary;
                                        gmbObj['postDate'] = gmbRes.createTime;
                                        gmbObj['channel_name'] = socialDoc.socialMedia.channel_name;
                                        gmbObj['name'] = socialDoc.socialMedia.channel_name;
                                        gmbObj['postUrl'] = gmbRes.searchUrl;
                                        gmbObj["topicType"] = "";
                                        if (gmbRes.topicType) {
                                            gmbObj["topicType"] = gmbRes.topicType
                                        }

                                        if (gmbRes.callToAction) {
                                            gmbObj["actionType"] = gmbRes.callToAction.actionType
                                            gmbObj["buttonUrl"] = gmbRes.callToAction.url
                                        }

                                        gmbObj['views'] = 0;
                                        gmbObj['clicks'] = 0;

                                        insightCount.data.localPostMetrics.forEach(metricRes => {
                                            if (metricRes.localPostName == gmbRes.name) {
                                                metricRes.metricValues.forEach(insight => {
                                                    if (insight.metric === "LOCAL_POST_VIEWS_SEARCH") {
                                                        gmbObj['views'] = insight.totalValue.value
                                                    }
                                                    if (insight.metric === "LOCAL_POST_ACTIONS_CALL_TO_ACTION") {
                                                        gmbObj['clicks'] = insight.totalValue.value
                                                    }
                                                });
                                            }

                                        });

                                        if (gmbRes.media) {
                                            if (gmbRes.media.length > 1) {
                                                gmbObj["thumbnail"] = gmbRes.media[0].googleUrl;
                                            }
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


                                        resObj.postData['postTime'] = gmbRes.createTime;
                                        resObj.postData['postStatus'] = "Posted"
                                        resObj.postData['gmbData'].push(gmbObj);
                                        responseArr.push(resObj);
                                    });
                                }
                                /*  if (gmbResp.nextPageToken || gmbResp.prevPageToken) {
                                     let gmbPagenObj = {};
                                     gmbPagenObj.id = socialDoc.socialMedia.locationId;
                                     //gmbPagenObj.previous = ytResp.prevPageToken ? ytResp.prevPageToken : '';
                                     gmbPagenObj.next = gmbResp.nextPageToken;
                                     gmbPagenation.push(gmbPagenObj)
                                 } */
                            }
                        }
                        catch (error) {
                            console.log("error..", error)
                        }
                    }
                }).catch(err => {
                    console.log("err...........", JSON.stringify(err))
                })
            }
            for (let i = 0; i < doc.length; i++) {
                switch (doc[i].socialMedia.name) {
                    case "twitter":
                        promiseArrayRecentpost.push(twitterPost(email, doc[i]));
                        break;
                    case "linkedin":
                        promiseArrayRecentpost.push(linkedInPost(email, doc[i]));
                        break;
                    case "facebook":
                        promiseArrayRecentpost.push(facebookPost(email, doc[i]));
                        break;
                    case "youtube":
                        promiseArrayRecentpost.push(youtubePost(email, doc[i]));
                        break;
                    case "instagram":
                        promiseArrayRecentpost.push(instagramPost(email, doc[i]));
                        break;
                    case "googlemybusiness":
                        promiseArrayRecentpost.push(googelMyBussinessPost(email, doc[i]));
                        break;
                    default:
                        break;
                }
            }
            let finalResponse = []

            await Promise.all(promiseArrayRecentpost).then(resArr => {
                if (responseArr.length > 0) {
                    responseArr.sort(function (a, b) {
                        var dateA = new Date(a.createdAt), dateB = new Date(b.createdAt)
                        return dateB - dateA
                    });
                    finalResponse = responseArr.slice(0, 2);
                }
                resolve({ recentpost: finalResponse })
            })
        })
    }

    switch (event.httpMethod) {
        case 'POST':
            console.log('POST Dashboard Called')
            var body = JSON.parse(event.body);
            context.callbackWaitsForEmptyEventLoop = false;
            if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
                event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
                if (email && email !== '') {
                    console.log("email", email)
                    connectorMongodb.then(async () => {
                        subscriptionModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } }).exec(async (err, subscriptionDoc) => {
                            if (!subscriptionDoc || (subscriptionDoc && subscriptionDoc.status == 'cancelled')) {
                                done('200', {
                                    message: `Your Subscription has been cancelled, Please active your Subscription`,
                                    status: false
                                });
                                return;
                            }
                            let userData = await userModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } });
                            if (userData.features.is_DashboardViewAllowed) {
                                let query = [];
                                let data = {};
                                query = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }, { $unwind: "$socialMedia" }];
                                socialModel.aggregate(query).exec(function (err, socialDoc) {
                                    if (socialDoc && socialDoc.length > 0) {
                                        const promiseArray = [];
                                        promiseArray.push(analitics(socialDoc, email));
                                        promiseArray.push(recentpost(socialDoc, email));
                                        promiseArray.push(schedulePostCount(email));
                                        Promise.all(promiseArray).then(resArr => {
                                            if (resArr.length > 0) {
                                                //let data = {};
                                                resArr.forEach(element => {
                                                    if (element.analiticsData) {
                                                        data['analiticsData'] = element.analiticsData
                                                    } else if (element.recentpost) {
                                                        data['recentpost'] = element.recentpost
                                                    }
                                                    if (element.scheduledPost > 0) {

                                                        data['scheduledPost'] = element.scheduledPost
                                                    } else {
                                                        data['scheduledPost'] = 0
                                                    }
                                                });
                                                done('200', {
                                                    message: "Dashboard Data Retrieved",
                                                    status: true,
                                                    data: data
                                                });
                                            } else {
                                                done('200', {
                                                    message: "Dashboard Data Not Found",
                                                    status: false,
                                                    data: data
                                                });
                                            }
                                        }).catch(error => {
                                            console.log("error........final error..........", JSON.stringify(error))
                                            done('200', {
                                                message: "Dashboard Data Retrieving some error accured",
                                                status: true,
                                                data: data
                                            });
                                        })
                                    } else {
                                        /* done('400', {
                                            message: "Social Media Not Available",
                                            data: {}
                                        }); */
                                        done('200', {
                                            message: "Social Media Not Available",
                                            status: false,
                                            data: data
                                        });
                                    }
                                });
                            } else {

                                /* done('405', {
                                    message: `You are not allowed to view dashboard, If you need to access dashboard upgrade your subscription`,
                                    status: false,
                                    data: {}
                                }); */
                                done('200', {
                                    message: `You are not allowed to view dashboard, If you need to access dashboard upgrade your subscription`,
                                    status: false,
                                    data: {}
                                });
                            }
                            // } else {
                            //     done('200', {
                            //         message: `Your Subscription has been cancelled, Please active your Subscription`,
                            //         status: false
                            //     });
                            // }
                        })
                    },
                        () => { console.log('Connection Error'); });
                }
            } else {
                done('403', {
                    status: false,
                    message: "Unauthorized"
                });
            }
            break;
        default:
            done(new Error(`Unsupported method ${event.httpMethod}`));
    }
};
