//const { google } = require('googleapis');
var mongoose = require('mongoose');
var axios = require('axios');
//var async = require('async');
var socialModel = require('./SocialModel.js');
var userModel = require('./userModel.js');
//const { json } = require('node:stream/consumers');
const moment = require('moment');

exports.handler = (event, context, callback) => {
	const done = (err, res) => callback(null, {
		statusCode: err ? err : '400',
		body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		},
	});

	var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
	//var connectorMongodb = mongoose.connect('mongodb+srv://storefries:CH8U1ZXGyeILqFWy@storefries.76ocf.mongodb.net/SocialMediaPublisher?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

	var google_client_id = event.stageVariables['Google_ClientId'];
	var google_client_secrets = event.stageVariables['Google_ClientSecret']
	var google_redirect_uri = event.stageVariables['Manage_ProfilePage']

	switch (event.httpMethod) {
		case 'POST':
			console.log('analytics')
			var body = JSON.parse(event.body);
			context.callbackWaitsForEmptyEventLoop = false;
			if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {

				event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;
				const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
				const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
				if (email && email !== '') {
					//try {
					console.log('email...............', JSON.stringify(email))
					connectorMongodb.then(async () => {
						let userData = await userModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } });
						console.log('userData...............', JSON.stringify(userData))
						if (userData) {
							var pageToken = '';
							let timeLine = [];
							let userData = {};
							let linkedinTimeLine = [];
							let linkedinUserData = {};
							//let mdQuery = { 'email': { $regex: new RegExp("^" + email, "i") } };
							if (!body.socialMedia) {
								done('422', {
									message: 'socialMedia is required',
									status: false
								});
								return;
							}

							let socialDoc = (qry) => {
								return new Promise(async (resolve, reject) => {
									socialModel.aggregate(qry).exec(async (err, doc) => {
										console.log('err.............', JSON.stringify(err))
										if (doc && doc.length > 0) {
											resolve({ status: true, doc: doc[0] })
										} else {
											reject({ status: false, doc: {} })
										}
										//console.log('doc.............', JSON.stringify(doc))
										console.log('qry...............', JSON.stringify(qry))
									})
								})
							}

							let twitterTimeline = async (twitDoc, dateFilter) => {
								//console.log("twitterTimeline")
								//return new Promise(async (resolve, reject) => {

								/* let url = `https://api.twitter.com/2/users/${twitDoc.userId}/tweets?max_results=99${dateFilter}
								&expansions=attachments.poll_ids,attachments.media_keys,author_id,geo.place_id,in_reply_to_user_id,referenced_tweets.id,entities.mentions.username,referenced_tweets.id.author_id
								&tweet.fields=attachments,author_id,context_annotations,conversation_id,created_at,entities,geo,id,in_reply_to_user_id,possibly_sensitive,public_metrics,referenced_tweets,reply_settings,source,text
								&user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,public_metrics,url,username,verified
								&media.fields=duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width
								&place.fields=contained_within,country,country_code,full_name,geo,id,name,place_type`; */
								let url = `https://api.twitter.com/2/users/${twitDoc.userId}/tweets?max_results=10${dateFilter}&expansions=attachments.poll_ids,attachments.media_keys,author_id,geo.place_id,in_reply_to_user_id,referenced_tweets.id,entities.mentions.username,referenced_tweets.id.author_id&tweet.fields=attachments,author_id,context_annotations,conversation_id,created_at,entities,geo,id,in_reply_to_user_id,lang,possibly_sensitive,public_metrics,referenced_tweets,reply_settings,source,text,withheld&user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,public_metrics,url,username,verified,withheld&media.fields=duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width&place.fields=contained_within,country,country_code,full_name,geo,id,name,place_type${pageToken}`;
								//console.log("twitter url", url)
								//try {
								//console.log("try url", url)
								let userTL = await axios.get(url, { headers: { 'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAABJRMAEAAAAAZCgIiNjUIBEmshoYJVkZsYV6Nc0%3DJtWFMmKy7Bz0CqFZI0xU9reKrJqYuHzpxW0fNgf9ptWDEskYRH' } });

								if (userTL.data && userTL.data.data.length > 0) {
									timeLine.push(userTL.data.data);
									userData = userTL.data.includes.users[0];
								}

								if (userTL.data && userTL.data.meta.next_token) {
									//console.log("next_token")
									pageToken = `&pagination_token=${userTL.data.meta.next_token}`;
									return twitterTimeline(twitDoc, dateFilter);
								} else {
									//console.log("else resolve")
									//resolve({ status: true, data: userTL.data });
									return { status: true };
								}
								//resolve({ status: true, data: userTL.data });

								// } catch (error) {
								// 	console.log("error video", JSON.stringify(error.message))
								// 	resolve({ status: false, data: [] });
								// }

								//})
							}

							let linkedinTimeline = async (socialdoc, linkedinPages, dateFilter) => {
								console.log("socialdoc", JSON.stringify(socialdoc))

								return new Promise(async (resolvelink, rejectlink) => {
									console.log("linkedinTimeline")
									// //let linkedinUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors[0]=${linkedinDoc.linkedinPages[0].pageId}&projection=(paging,elements*(name,localizedName,author,id,firstPublishedAt,vanityName,created,specificContent(reactions,com.linkedin.ugc.ShareContent(shareMediaCategory,shareCommentary,media(*(media~:playableStreams,originalUrl,thumbnails,description,title))))))`
									// let linkedinUrl = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${linkedinDoc.linkedinPages[0].pageId}${dateFilter}`

									// console.log("linkedinUrll", linkedinUrl)
									// var linkedInRes = await axios.get(linkedinUrl, { headers: { 'Authorization': 'Bearer ' + linkedinDoc.oauth_token } })
									// console.log("linkedInRes", JSON.stringify(linkedInRes.data))
									// if (linkedInRes.data && linkedInRes.data.elements && linkedInRes.data.elements.length > 0) {

									// 	linkedinTimeLine.push(linkedInRes.data)
									// }
									let linkedinPromiseArr = [];
									let linkedInRes = async () => {
										return new Promise((resolve, reject) => {
											axios.get(`https://api.linkedin.com/v2/networkSizes/${linkedinPages.pageId}?edgeType=CompanyFollowedByMember${dateFilter}`,
												//axios.get(`https://api.linkedin.com/v2/networkSizes/${linkedinPages.pageId}?edgeType=CompanyFollowedByMember`,
												{ headers: { 'Authorization': 'Bearer ' + socialdoc.oauth_token } }).then((resp) => {
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
											axios.get({ headers: { 'Authorization': 'Bearer ' + socialdoc.oauth_token } }).then((statRes) => {
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
										console.log("linkedInPostRes.....")
										let linkedinPostPromiseArr = [];
										//let linkedinUrl = `https://api.linkedin.com/v2/shares?q=owners&owners=${linkedinPages.pageId}&sortBy=LAST_MODIFIED&sharesPerOwner=100&count=50&${postRequestCount}`;
										let linkedinUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors[0]=${linkedinPages.pageId}&sortBy=LAST_MODIFIED&count=50&${postRequestCount}`;

										let linkedinPost = async (linkedinUrl, oauth_token) => {
											return new Promise((resolve, reject) => {
												axios.get(linkedinUrl, { headers: { 'Authorization': 'Bearer ' + oauth_token } }).then((response) => {
													//console.log("linkedInStatRes.....", JSON.stringify(response.data))
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
										linkedinPostPromiseArr.push(linkedinPost(linkedinUrl, socialdoc.oauth_token))

										let postRes = await Promise.all(linkedinPostPromiseArr);
										//console.log("linkedInPostRes.....", JSON.stringify(postRes[0].data.elements))
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
										resObj['userId'] = socialdoc.userId;
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
												console.log("linkedInPostPost_count", linked.postRes)
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
										resolvelink(resObj)
									}).catch(err => {
										console.log("err linkedin promiseArr.all ......");
									})
								}).catch(err => {
									rejectlink({})
									console.log("err..2...youtube promise all......")
								});

							}

							const googlemybusiness = async (socialdoc, startDate, endDate) => {

								return new Promise(async (resolveGmb, rejectGmb) => {
									let reconnectGoogle = async (refreshtoken) => {
										return new Promise(async (resolve, reject) => {
											const reqUrl = `https://www.googleapis.com/oauth2/v4/token`;
											//const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}&redirect_uri=${google_redirect_uri}`;
											const requestBody = `client_secret=${google_client_secrets}&grant_type=refresh_token&refresh_token=${refreshtoken}&client_id=${google_client_id}&redirect_uri=${google_redirect_uri}`;
											try {
												let result = await axios.post(reqUrl, requestBody, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
												console.log("result.data.access_token", result.data.access_token)
												resolve({ 'token': result.data.access_token });
											}
											catch (error) {
												console.log("error", JSON.stringify(error))
												reject({ 'token': null });
											}
										})
									};

									let promiseGmb = []

									promiseGmb.push(reconnectGoogle(socialdoc.refresh_token));

									await Promise.all(promiseGmb).then(async (token) => {

										let insight = async () => {

											return new Promise((resolve, reject) => {
												let gmbUrl = `https://mybusiness.googleapis.com/v4/accounts/${socialdoc.userId}/locations/${socialdoc.locationId}/reviews`;
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
											console.log("gmb insights 1")
											return new Promise((resolve, reject) => {
												// let endDate = new Date();
												// let nowDate = new Date();
												// let startDate = new Date(nowDate.setFullYear(nowDate.getFullYear() - 1));
												metricReq = {
													"locationNames": [
														`accounts/${socialdoc.userId}/locations/${socialdoc.locationId}`
													],
													"basicRequest": {
														"metricRequests": [
															{
																"metric": "ALL",
																"options": [
																	"AGGREGATED_TOTAL", "AGGREGATED_DAILY"
																]
															}
														],
														"timeRange": {
															"startTime": startDate,
															"endTime": endDate
														}
													}
												}

												//let metricUrl = `https://mybusiness.googleapis.com/v4/accounts/${socialdoc.socialMedia.userId}/locations/${socialdoc.locationId}/reviews`;
												let metricUrl = `https://mybusiness.googleapis.com/v4/accounts/${socialdoc.userId}/locations:reportInsights`;
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

										let question = async () => {
											return new Promise((resolve, reject) => {
												let gmbUrl = `https://mybusinessqanda.googleapis.com/v1/locations/${socialdoc.locationId}/questions`;
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

										let promisefunc = [];
										promisefunc.push(insight())
										promisefunc.push(metric())
										promisefunc.push(question())
										let resObj = {};
										let google_search = [];
										//let owners = [];
										let google_maps = [];
										//let customerAction = [];
										let direct = [];
										let discovery = [];
										//let queriesChain = [];
										let website_visits = [];
										let phone_no = [];
										let directions = [];
										let owners = [];
										let customers = [];
										let localPostViewsSearch = [];
										let localPostActionsCallToAction = [];

										let google_search_total = 0;
										let customers_total = 0;
										let localPostViewsSearchTotal = 0;
										let localPostActionsCallToActionTotal = 0;
										//let totalPhotoViewsTotal = 0;
										let google_maps_total = 0;
										//let customerActionTotal = 0;
										let direct_total = 0;
										let discovery_total = 0;
										//let queriesChainTotal = 0;
										let website_visits_total = 0;
										let phone_no_total = 0;
										let directions_total = 0;
										let owners_total = 0;

										await Promise.all(promisefunc).then((resArr) => {
											resObj['userId'] = socialdoc.userId;
											resObj['locationId'] = socialdoc.locationId;
											resObj['name'] = socialdoc.channel_name;
											resObj['profileImage'] = socialdoc.userProfileImage;
											resObj['socialMedia'] = 'googlemybusiness';
											resObj['followers_count'] = 0;
											resObj['following_count'] = 0;
											resObj['review_count'] = 0;
											resObj['average_rating'] = 0;
											resObj['photo_views'] = 0;
											resObj['total_search'] = 0;
											resObj['total_views'] = 0;
											resObj['customer_action'] = 0;
											resObj['questions_count'] = 0;
											let metricProArr = [];
											if (resArr[0]) {
												resObj['review_count'] = resArr[0].totalReviewCount;
												resObj['average_rating'] = resArr[0].averageRating;
											}
											// if (resArr[2] && resArr[2]) {
											// 	resObj['questions_count'] = resArr[2];
											// 	console.log('resArr....222222.......', JSON.stringify(resArr[2]))
											// }
											if (resArr[1] && resArr[1].locationMetrics[0]) {
												/////////console.log("resArr[1] && resArr[1].locationMetrics[0]",JSON.stringify(resArr[1] && resArr[1].locationMetrics[0]))

												// if (resArr[1].locationMetrics[0] && resArr[1].locationMetrics[0].metricValues[0].metric == "VIEWS_SEARCH") {
												// 	resObj['reach'] = resArr[1].locationMetrics[0].metricValues[0].totalValue.value;
												// }
												// if (resArr[1].locationMetrics[0] && resArr[1].locationMetrics[0].metricValues[4].metric == "VIEWS_SEARCH") {
												// 	resObj['reach'] = parseInt(resObj['reach']) + parseInt(resArr[1].locationMetrics[0].metricValues[4].totalValue.value);
												// }
												// if (resArr[1].locationMetrics[0] && resArr[1].locationMetrics[0].metricValues[3].metric == "VIEWS_MAPS") {
												// 	resObj['reach'] = parseInt(resObj['reach']) + parseInt(resArr[1].locationMetrics[0].metricValues[3].totalValue.value);
												// }
												const metricFunc = async (metricArr, newArr) => {
													return new Promise((resolve, reject) => {
														metricArr.forEach(dateRangeVal => {
															let obj = {};
															obj.date = dateRangeVal.timeDimension.timeRange.startTime;
															obj.value = dateRangeVal?.value ? parseInt(dateRangeVal.value) : 0;
															obj.mode = "daily";
															newArr.push(obj);
														});
														resolve(newArr);
													})
												}
												//console.log('resArr[1] && resArr[1].locationMetrics[0].metricValues', JSON.stringify(resArr[1] && resArr[1].locationMetrics[0].metricValues))
												resArr[1] && resArr[1].locationMetrics[0].metricValues.forEach(dimVal => {
													if (dimVal.metric === "VIEWS_SEARCH") {
														if (dimVal.totalValue) {
															google_search_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, google_search));
														}
													}
													// if (dimVal.metric === "PHOTOS_VIEWS_MERCHANT") {
													// 	if (dimVal.totalValue) {
													// 		totalPhotoViewsTotal = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;        
													// 	} else {
													// 		metricProArr.push(metricFunc(dimVal.dimensionalValues, owners));
													// 	}
													// }
													if (dimVal.metric === "VIEWS_MAPS") {
														if (dimVal.totalValue) {
															google_maps_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, google_maps));
														}
													}
													// if (dimVal.metric === "PHOTOS_VIEWS_CUSTOMERS") {
													// 	if (dimVal.totalValue) {
													// 		customerActionTotal = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
													// 	} else {
													// 		metricProArr.push(metricFunc(dimVal.dimensionalValues, customers));
													// 	}
													// }
													if (dimVal.metric === "QUERIES_DIRECT") {
														if (dimVal.totalValue) {
															direct_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, direct));
														}
													}
													if (dimVal.metric === "QUERIES_INDIRECT") {
														if (dimVal.totalValue) {
															discovery_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, discovery));
														}
													}
													// if (dimVal.metric === "QUERIES_CHAIN") {
													// 	if (dimVal.totalValue) {
													// 		queriesChainTotal = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
													// 	} else {
													// 		metricProArr.push(metricFunc(dimVal.dimensionalValues, queriesChain));
													// 	}
													// }
													if (dimVal.metric === "ACTIONS_WEBSITE") {
														if (dimVal.totalValue) {
															website_visits_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, website_visits));
														}
													}
													if (dimVal.metric === "ACTIONS_PHONE") {
														if (dimVal.totalValue) {
															phone_no_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, phone_no));
														}
													}
													if (dimVal.metric === "ACTIONS_DRIVING_DIRECTIONS") {
														if (dimVal.totalValue) {
															directions_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, directions));
														}
													}
													if (dimVal.metric === "PHOTOS_COUNT_MERCHANT") {
														if (dimVal.totalValue) {
															owners_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, owners));
														}
													}
													if (dimVal.metric === "PHOTOS_COUNT_CUSTOMERS") {
														if (dimVal.totalValue) {
															customers_total = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, customers));
														}
													}
													if (dimVal.metric === "LOCAL_POST_VIEWS_SEARCH") {
														if (dimVal.totalValue) {
															localPostViewsSearchTotal = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, localPostViewsSearch));
														}
													}
													if (dimVal.metric === "LOCAL_POST_ACTIONS_CALL_TO_ACTION") {
														if (dimVal.totalValue) {
															localPostActionsCallToActionTotal = dimVal?.totalValue?.value ? parseInt(dimVal.totalValue.value) : 0;
														} else {
															metricProArr.push(metricFunc(dimVal.dimensionalValues, localPostActionsCallToAction));
														}
													}
												});
											}
											Promise.all(metricProArr).then((result) => {
												//console.log("result...............................", JSON.stringify(result))
												// resObj.google_search = google_search;
												// //resObj.totalPhotoViews = totalPhotoViews;
												// resObj.google_maps = google_maps;
												// //resObj.customerAction = customerAction;
												// resObj.direct = direct;
												// resObj.discovery = discovery;
												// //resObj.queriesChain = queriesChain;
												// resObj.website_visits = website_visits;
												// resObj.phone_no = phone_no;
												// resObj.directions = directions;
												// resObj.owners = owners;
												// resObj.customers = customers;
												//console.log('customers............',JSON.stringify(customers))
												resObj['total_views'] = parseInt(google_search_total) + parseInt(google_maps_total);
												resObj['photo_views'] = parseInt(owners_total) + parseInt(customers_total);
												resObj['total_search'] = parseInt(direct_total) + parseInt(discovery_total);
												resObj['customer_action'] = parseInt(website_visits_total) + parseInt(phone_no_total) + parseInt(directions_total);
												resObj['local_post_actions_call_to_action'] = parseInt(localPostActionsCallToActionTotal)
												resObj['local_post_views_search_total'] = parseInt(localPostViewsSearchTotal)


												resObj['local_post_actions_call_to_action'] = {
													localPostActionsCallToAction: {
														total: parseInt(localPostViewsSearchTotal),
														dateRage: localPostActionsCallToAction
													}
												}
												resObj['local_post_views_search_total'] = {
													localPostViewsSearchTotal: {
														total: parseInt(localPostViewsSearchTotal),
														dateRage: localPostViewsSearchTotal
													}
												}

												resObj['total_views_details'] = {
													google_search: {
														total: parseInt(google_search_total),
														dateRage: google_search
													},
													google_maps: {
														total: parseInt(google_maps_total),
														dateRage: google_maps
													}
												}
												resObj['photo_views'] = {
													owners: {
														total: parseInt(owners_total),
														dateRage: owners
													},
													customers: {
														total: parseInt(customers_total),
														dateRage: customers
													}

												}
												resObj['total_search'] = {
													direct: {
														total: parseInt(direct_total),
														dateRage: direct
													},
													discovery: {
														total: parseInt(discovery_total),
														dateRage: discovery
													}
												}
												resObj['customer_action'] = {
													website_visits: {
														total: parseInt(website_visits_total),
														dateRage: website_visits
													},
													phone_no: {
														total: parseInt(phone_no_total),
														dateRage: phone_no
													},
													directions: {
														total: parseInt(directions_total),
														dateRage: directions
													}
												}

												// resObj.localPostViewsSearch = localPostViewsSearch;
												// resObj.localPostActionsCallToAction = localPostActionsCallToAction;
												resolveGmb(resObj)

											})
										}).catch(err => {
											resolveGmb(resObj)
											console.log("err...1..googlemybusiness promise all......", err)
										})
									}).catch(err => {
										rejectGmb({})
										console.log("err...2..googlemybusiness promise all......", err)
									})
								})
							}

							const youtube = async (socialdoc, dateFilter, postFilter) => {
								return new Promise(async (resolveYt, rejectYt) => {
									let reconnectGoogle = async (refreshtoken) => {
										return new Promise(async (resolve, reject) => {
											//let redirct_url = event.stageVariables['Google_redirctUrl'];
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

									promiseArr.push(reconnectGoogle(socialdoc.refresh_token));
									await Promise.all(promiseArr).then(async (token) => {
										console.log('token[0].token.....................', JSON.stringify(token[0].token));
										console.log('socialdoc.userId.....................', JSON.stringify(socialdoc.userId));
										console.log('dateFilter.....................', JSON.stringify(dateFilter));


										let metricFunction = async () => {
											return new Promise((resolve, reject) => {
												let metrics = 'views,comments,likes,dislikes,shares,estimatedMinutesWatched,subscribersGained,subscribersLost,cardClicks,cardTeaserClicks,cardTeaserImpressions,cardImpressions';
												let url = `https://youtubeanalytics.googleapis.com/v2/reports?dimensions=day&access_token=${token[0].token}&ids=channel%3D%3D${socialdoc.userId}&metrics=${metrics}&sort=-day${dateFilter}`;
												console.log('metrics......................', JSON.stringify(metrics));
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
												let ytUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,id,contentDetails,brandingSettings,localizations,status,topicDetails&id=${socialdoc.userId}&access_token=${token[0].token}${pageToken}`;
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

												let ytPostCountUrl = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&channelId=${socialdoc.userId}${postFilter}&order=date&access_token=${token[0].token}`;
												axios.get(ytPostCountUrl, null).then((resp) => {
													if (resp.data) {
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
										let resObj = {};
										await Promise.all(promisefunc).then((resArr) => {
											console.log("resArr............youtube...........", JSON.stringify(resArr));
											let commentCount = 0;
											let shareCount = 0;
											let likeCount = 0;
											let dislikeCount = 0;
											let shares = 0;
											let viewsCount = 0;
											let minits_watched = 0;


											let total_card_teaser_impressions = 0;
											let cardImpressions = 0;
											let total_card_teaser_clicks = 0;
											let total_card_clicks = 0;
											//let end_screen_element_clicks = 0;
											//let end_screen_element_impressions = 0;

											let total_views_details = [];
											let total_engagement_details = [];
											let new_subscribers = 0;
											let subscriber_lost = 0;


											resObj['userId'] = socialdoc.userId;
											resObj['name'] = socialdoc.channel_name;
											resObj['profileImage'] = '';
											resObj['socialMedia'] = 'youtube';
											resObj['post_count'] = 0;
											resObj['view_count'] = 0;
											resObj['minits_watched'] = 0;
											resObj['total_subscribers'] = 0;
											resObj['new_subscribers'] = 0;
											resObj['subscriber_lost'] = 0;
											resObj['engagement'] = 0;


											if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].snippet.thumbnails.default.url) {
												resObj['profileImage'] = resArr[0].postRes.items[0].snippet.thumbnails.default.url;
											}
											console.log("resArr[1].metricRes.rows..........", JSON.stringify(resArr[1].metricRes.rows))

											if (resArr && resArr.length > 0 && resArr[1] && resArr[1].metricRes.rows) {
												resArr[1].metricRes.rows.forEach((element, index) => {
													let obj = {};
													obj.data = element[0];
													//obj.views = element[1];
													obj.minits_watched = element[6];
													obj.mode = "daily";
													viewsCount = viewsCount + element[1]
													total_views_details.push(obj);

													/* obj.data = element[0];
													obj.views = element[1];
													obj.minits_watched = element[5];
													obj.mode = "daily";
													newArr.push(obj); */

													new_subscribers = new_subscribers + element[7]
													subscriber_lost = subscriber_lost + element[8]
													total_card_clicks = total_card_clicks + element[9]
													total_card_teaser_clicks = total_card_teaser_clicks + element[10]
													total_card_teaser_impressions = total_card_teaser_impressions + element[11]
													cardImpressions = cardImpressions + element[12]
													//end_screen_element_clicks = end_screen_element_clicks + element[13]
													//end_screen_element_impressions = end_screen_element_impressions + element[14]
													//obj.total_engagement_details = commentCount + shareCount + likeCount + dislikeCount;
													//resObj['minits_watched'] = resObj['minits_watched'] + element[5]
													obj.engagement = element[2] + element[3] + element[4] + element[5];
													total_engagement_details.push(obj);
													commentCount = commentCount + element[2]
													likeCount = likeCount + element[3]
													dislikeCount = dislikeCount + element[4]
													shareCount = shareCount + element[5]
													//total_end_screen_impressions = total_end_screen_impressions + element[7]
													//total_card_impressions = total_card_impressions + element[9]
													//total_end_screen_clicks = total_end_screen_clicks + element[10]

													//resObj['engagement'] = resObj['engagement'] + element[4]
													//shares = shares + element[5]

												});

												console.log(' element[12].................', JSON.stringify(cardImpressions))

												console.log('engagement..............', JSON.stringify(total_engagement_details))

												resObj['engagement'] = commentCount + shareCount + likeCount + dislikeCount;
												resObj['total_engagement_details'] = total_engagement_details;

											}
											// if (resArr && resArr.length > 0 && resArr[1] && resArr[1].metricRes.rows) {
											// 	resArr[1].metricRes.rows.forEach((element, index) => {

											// 		let obj = {};
											// 		obj.data = element[0];

											// 		obj.mode = "daily";
											// 		engagement.push(obj);
											// 		commentCount = commentCount + element[2]
											// 		likeCount = likeCount + element[3]
											// 		dislikeCount = dislikeCount + element[4]
											// 		shareCount = shareCount + element[5]
											// 		resObj['engagement'] = resObj['engagement'] + element[4]
											// 	})
											// }
											resObj['view_count'] = viewsCount;
											resObj['new_subscribers'] = new_subscribers;
											resObj['subscriber_lost'] = subscriber_lost;
											//resObj['end_screen_element_impressions'] = end_screen_element_impressions;

											if (resArr && resArr[2] && resArr[2].postCount.items && resArr[2].postCount.items.length > 0) {
												resObj['post_count'] = resArr[2].postCount.items.length;
											}
											// if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.viewsCount) {
											// }
											// if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.new_subscribers) {
											// 	resObj['new_subscribers'] = resArr[0].postRes.items[0].statistics.new_subscribers;
											// }
											// if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.subscriber_lost) {
											// 	resObj['subscriber_lost'] = resArr[0].postRes.items[0].statistics.subscriber_lost;
											// }
											// if (resArr && resArr[0] && resArr[0].postRes.items[0] && resArr[0].postRes.items[0].statistics.subscriberCount) {
											// 	resObj['total_subscribers'] = resArr[0].postRes.items[0].statistics.total_subscribers;
											// }

											console.log('new_subscribers...........', JSON.stringify(new_subscribers))
											console.log('subscriber_lost...........', JSON.stringify(subscriber_lost))


											resObj['total_card_teaser_impressions'] = total_card_teaser_impressions;
											//resObj['total_end_screen_impressions'] = total_end_screen_impressions;
											//resObj['total_card_impressions'] = total_card_impressions;
											//resObj['total_end_screen_clicks'] = total_end_screen_clicks;
											resObj['total_card_teaser_clicks'] = total_card_teaser_clicks;
											resObj['total_card_clicks'] = total_card_clicks;
											resObj['cardImpressions'] = cardImpressions;


											// resObj['engagement'] = {
											// 	likeCount: {
											// 		dateRage: likeCount
											// 	},
											// 	commentCount: {
											// 		dateRage: commentCount
											// 	},
											// 	dislikeCount: {
											// 		dateRage: dateRage
											// 	},
											// 	shareCount: {
											// 		dateRage: shareCount
											// 	}
											// }

											//responseArr.push(resObj)
											resolveYt(resObj)
										})
									}).catch(err => {
										rejectYt({})
										console.log("err..2...youtube promise all......", err)
									});

								})
							};

							const facebook = async (fbPage, dateFilter) => {
								return new Promise(async (resolveFb, rejectFb) => {
									//const reqUrl = 'https://api.linkedin.com/v2/search?q=companiesV2&baseSearchParams.keywords=LinkedIn';
									let facebookPromiseArr = [];
									// if (socialdoc.socialMedia.fbpages && socialdoc.socialMedia.fbpages.length > 0) {
									// 	console.log('fffffffffffffffbbbbbbbbbbbbbbbbbb1')
									// 	if (fbPage.type == "page") {
									let fbUrl1 = `https://graph.facebook.com/${fbPage.id}?fields=id,followers_count,engagement,feed&access_token=${fbPage.access_token}`
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
									let metrics = '_unique,page_fan_adds_unique,page_fan_removes_unique,page_fans,page_views_total,page_total_actions,page_posts_impressions_frequency_distribution,';
									let fbUrl = `https://graph.facebook.com/${fbPage.id}/insights?metric=${metrics}&period=day&access_token=${fbPage.access_token}${dateFilter}`
									console.log("fbUrl.............", fbUrl)
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
									let postUrl = `https://graph.facebook.com/${fbPage.id}/feed?&access_token=${fbPage.access_token}&fields=created_time,from,likes.summary(true),comments.summary(true),shares&limit=50${dateFilter}`
									console.log("yyyyyyyyyyyyyyyyyyyyy.............")
									let facebookPostCount = async () => {
										let facebookPostPromiseArr = [];
										try {
											facebookPostPromiseArr.push(axios.get(postUrl));
											console.log("11111.............");

											let postResult = await Promise.all(facebookPostPromiseArr);
											if (postResult[0] && postResult[0].data && postResult[0].data.data && postResult[0].data.data.length > 0) {

												//console.log('post............', JSON.stringify(postResult[0] && postResult[0].data && postResult[0].data.data && postResult[0].data.data.length))
												console.log("2222.............");

												postResult[0].data.data.forEach(feedData => {
													console.log("bbbbbbbbbbbbbbbbbbbbbbbbb.............")

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
													console.log("fbEngageCount.............");

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
									console.log("bbbbbbbbbbbbbbbbbbbbbbbbb.............")

									await Promise.all(facebookPromiseArr).then(fbResult => {
										let resObj = {};
										let new_likes = 0;
										let likes_lost = 0;
										let total_page_likes = 0;
										let page_impresstion = 0;
										let page_profile_views = 0;

										resObj['userId'] = fbPage.userId;
										resObj['pageId'] = fbPage.id;
										resObj['name'] = fbPage.name;
										resObj['socialMedia'] = 'facebook';
										resObj['following_count'] = 0;
										resObj['folowers_count'] = 0;
										resObj['profileImage'] = '';
										resObj['post_count'] = 0;
										resObj['reach'] = 0;
										resObj['engagement'] = 0;


										//resolveFb(resObj)
										if (fbPage.image) {
											resObj['profileImage'] = fbPage.image;
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
												console.log("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.............")

											}
											if (result.feedRes && result.feedRes.data && result.feedRes.data[0] && result.feedRes.data[0].values && result.feedRes.data[0].values.length > 0) {
												result.feedRes.data[0].values.forEach(fbReach => {
													resObj['reach'] = resObj['reach'] + fbReach.value;
												})
											}

										})

										if (fbResult && fbResult.length > 0 && fbResult[2] && fbResult[2].feedRes) {
											console.log('......................', JSON.stringify(fbResult[2].feedRes))

											fbResult[2].feedRes.forEach((element, index) => {
												let obj = {};
												obj.data = element[0];
												obj.mode = "daily"
												obj.new_likes = new_likes + element[2];
												obj.likes_lost = likes_lost + element[3];
												obj.total_page_likes = total_page_likes + element[4];
												obj.page_impresstion = page_impresstion + element[5];
												obj.page_profile_views = page_profile_views + element[6];

												console.log('element[3]...........................', JSON.stringify(element[3]))

												console.log('element[3]...........................', JSON.stringify(element[5]))

												console.log('element[3]...........................', JSON.stringify(element[6]))



											})
										}
										resObj['new_likes'] = new_likes;
										resObj['likes_lost'] = likes_lost;
										resObj['total_page_likes'] = total_page_likes;
										resObj['page_impresstion'] = page_impresstion;
										resObj['page_profile_views'] = page_profile_views;


										//responseArr.push(resObj)
										resolveFb(resObj);
									}).catch(err => {
										console.log("err facebook promise all ...", err)
									})
									// 	}
									// }
								}).catch(err => {
									rejectFb({})
									console.log("err..2...youtube promise all......", err)
								});
							}

							const instagram = async (socialdoc, dateFilter) => {
								//console.log("socialdoc", JSON.stringify(socialdoc));
								return new Promise(async (resolveIns, rejectIns) => {
									let insightUrl = `https://graph.facebook.com/v12.0/${socialdoc.userId}/media?fields=username,insights.metric(engagement),timestamp,media_type,media_url,comments_count,like_count&limit=50${dateFilter}&access_token=${socialdoc.oauth_token}}`;
									let followersUrl = `https://graph.facebook.com/v12.0/${socialdoc.userId}?fields=media_count,profile_picture_url,name,username,followers_count,follows_count${dateFilter}&access_token=${socialdoc.oauth_token}}`;
									let instagrampostUrl = `https://graph.facebook.com/v12.0/${socialdoc.userId}/media?username,media_count,insights.metric(reach,engagement,impressions),comments_count,like_count&limit=50&${dateFilter}&access_token=${socialdoc.oauth_token}`;
									let instagramUrl = `https://graph.facebook.com/${socialdoc.userId}/insights?metric=impressions,reach,profile_views,follower_count&period=day&${dateFilter}&access_token=${socialdoc.oauth_token}`;
									console.log("followersUrl.........", followersUrl)

									let reach = 0;
									let engagement = 0;
									let instaPostCount = 0;
									let impression = 0;
									let profile_views = 0;
									let top_post = {};

									let post_details = [];
									let reach_details = [];
									let engagement_details = [];
									let impressions_details = [];
									let profile_views_details = [];

									let instagramInsight = async (postUrl) => {
										//console.log("postUrl........", postUrl)
										let igInsightPromiseArr = [];
										var maxValue = Number.MIN_VALUE;
										igInsightPromiseArr.push(axios.get(postUrl));
										let insightRes = await Promise.all(igInsightPromiseArr);
										if (insightRes[0] && insightRes[0].data && insightRes[0].data.data && insightRes[0].data.data.length > 0) {
											instaPostCount = instaPostCount + insightRes[0].data.data.length;

											engagement_details = insightRes[0].data.data.reduce((igData, item) => {

												if (item?.insights?.data?.[0].name == "engagement") {
													console.log(".....................")
													let mediaType = item.media_type.toLowerCase();
													if (item.media_type == 'CAROUSEL_ALBUM') {
														mediaType = "carousel";
													}
													let find = igData.find(i => {
														if (i.mediaType == mediaType && i.date.substring(0, 10) === item.timestamp.substring(0, 10)) {
															return i;
														}
													});
													engagement = engagement + item?.insights?.data?.[0].values[0].value;

													if (item?.insights?.data?.[0].values[0].value > maxValue) {
														maxValue = item?.insights?.data?.[0].values[0].value;
														top_post = item;
													}

													let obj = {};
													obj.mode = "day";
													obj.mediaType = mediaType;
													obj.date = item.timestamp;
													obj.value = item?.insights?.data?.[0].values[0].value ?? 0

													let _d = {
														...obj
													}

													if (find) {
														find.value += item?.insights?.data?.[0].values[0].value;
													} else {
														igData.push(_d)
													}



													//find ? (find.value += item?.insights?.data?.[0].values[0].value) : igData.push(_d);
													return igData;
												}

											}, []);

											post_details = insightRes[0].data.data.reduce((igData, item) => {
												if (item?.insights?.data?.[0].name == "engagement") {
													let find = igData.find(i => {
														if (i.date.substring(0, 10) === item.timestamp.substring(0, 10)) {
															return i;
														}
													});

													let obj = {};
													obj.mode = "day";
													obj.date = item.timestamp;
													obj.engagementCount = item?.insights?.data?.[0].values[0].value ?? 0;
													obj.postCount = 1;

													let _d = {
														...obj
													}

													if (find) {
														find.engagementCount += item?.insights?.data?.[0].values[0].value;
														find.postCount += 1;
													} else {
														igData.push(_d)
													}

													return igData;
												}
											}, []);

											if (insightRes[0].data.paging && insightRes[0].data.paging.next) {
												postUrl = insightRes[0].data.paging.next;
												return instagramInsight(postUrl);
											} else {
												return {
													top_post: top_post,
													engagement: engagement,
													engagement_details: engagement_details,
													instaPostCount: instaPostCount,
													post_details: post_details
												};
											}
										}
										return {
											top_post: top_post,
											engagement: engagement,
											engagement_details: engagement_details,
											instaPostCount: instaPostCount,
											post_details: post_details
										};
										//});
									}

									//console.log('instagramUrl', JSON.stringify(instagramUrl))
									let instagramInsightOne = async (instagramUrl) => {
										let instagramPromiseArr = [];
										//console.log('instagramUrl.................', JSON.stringify(instagramUrl))
										try {

											instagramPromiseArr.push(axios.get(instagramUrl));
											let insight = await Promise.all(instagramPromiseArr);
											if (insight[0] && insight[0].data && insight[0].data.data && insight[0].data.data.length > 0) {
												console.log("insightRes[0].data.data.......", JSON.stringify(insight[0].data))


												insight[0].data.data.forEach(insight => {
													//console.log("insight.......", JSON.stringify(insight))

													// let timestamp = igData.timestamp;
													// let date = igData.timestamp.substring(0, 10);
													// console.log("date................", date)
													// let mediaType = igData.media_type.toLowerCase();
													// if (igData.media_type == 'CAROUSEL_ALBUM') {
													// 	mediaType = "carousel";
													// }

													if (insight.name == "reach") {
														for (let i = 0; i < insight.values.length; i++) {
															const reachVal = insight.values[i];
															let obj = {};
															obj.mode = "day";
															obj.date = reachVal.end_time;
															//obj.mediaType = mediaType;
															obj.value = reachVal.value ?? 0;
															reach = reach + reachVal.value;
															reach_details.push(obj);
														}
													}
													if (insight.name == "impressions") {
														for (let i = 0; i < insight.values.length; i++) {
															const impressionVal = insight.values[i];
															let obj = {};
															obj.mode = "day";
															obj.date = impressionVal.end_time;
															// obj.mediaType = mediaType;
															obj.value = impressionVal.value ?? 0;
															impression = impression + impressionVal.value;
															impressions_details.push(obj)
														}
													}
													if (insight.name == "profile_views") {
														for (let i = 0; i < insight.values.length; i++) {
															const profileViewVal = insight.values[i];
															let obj = {};
															obj.mode = "day";
															obj.date = profileViewVal.end_time;
															// obj.mediaType = mediaType;
															obj.value = profileViewVal.value;
															profile_views = profile_views + profileViewVal.value;
															profile_views_details.push(obj)
														}
													}

												});

												if (insight[0].data.paging && insight[0].data.paging.next) {
													instagramUrl = insight[0].data.paging.next;
													return instagramInsightOne(instagramUrl);
												} else {
													return { 
														profile_views: profile_views, 
														impression: impression, 
														reach: reach, 
														reach_details: reach_details, 
														impressions_details: impressions_details, 
														profile_views_details: profile_views_details 
													};
												}
											}
											return { 
												profile_views: profile_views, 
												impression: impression, 
												reach: reach, 
												reach_details: reach_details, 
												impressions_details: impressions_details, 
												profile_views_details: profile_views_details 
											};  //profile_views:profile_views
										}
										catch (error) {
											console.log("...........error............", JSON.stringify(error))
											return { 
												profile_views: profile_views, 
												impression: impression, 
												reach: reach, 
												reach_details: reach_details, 
												impressions_details: impressions_details, 
												profile_views_details: profile_views_details 
											};  //profile_views:profile_views
										}
									}

									const instagramFollower = async (url) => {
										return new Promise(async (resolve, reject) => {
											axios.get(url).then(res => {
												console.log('res.data...', JSON.stringify(res.data))
												if (res?.data) {
													resolve({ status: true, data: res.data })
												} else {
													resolve({ status: false, data: {} })
												}
											}).catch(err => {
												resolve({ status: false, data: {} })
											})
										})
									}

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

									//console.log('insssss`11111')
									let promiseAllArr = [];
									promiseAllArr.push(instagramInsight(insightUrl));
									promiseAllArr.push(instagramFollower(followersUrl));
									promiseAllArr.push(instagramInsightOne(instagramUrl));
									//promiseAllArr.push(instagramPostCount())
									console.log('instagram`3333')
									await Promise.all(promiseAllArr).then(igResult => {
										let resObj = {};
										resObj['userId'] = socialdoc.userId;
										resObj['name'] = igResult[1].data.username;
										resObj['socialMedia'] = 'instagram';
										resObj['following_count'] = igResult[1]?.data.follows_count ?? 0;
										resObj['followers_count'] = igResult[1]?.data.followers_count ?? 0;
										resObj['profileImage'] = igResult[1]?.data.profile_picture_url ?? "";
										resObj['post_count'] = igResult[0]?.instaPostCount ?? 0;
										resObj['reach_details'] = 0;
										resObj['reach'] = igResult[2]?.reach ?? 0;
										resObj['engagement'] = igResult[0]?.engagement ?? 0;
										resObj['impression'] = igResult[2]?.impression ?? 0;
										resObj['engagement_details'] = [];
										resObj['impressions_details'] = [];
										resObj['profile_views'] = igResult[2]?.profile_views ?? 0;
										resObj['profile_views_details'] = [];
										resObj['top_post'] = [];
										resObj['post_count_details'] = [];
										//console.log("resObj['impression']", JSON.stringify(resObj['impression']))

										// console.log("igResult", JSON.stringify(igResult[0]))

										if (igResult[2].reach_details) {
											resObj['reach_details'] = igResult[2].reach_details
										}
										if (igResult[0].engagement_details) {
											resObj['engagement_details'] = igResult[0].engagement_details
										}
										if (igResult[2].impressions_details) {
											resObj['impressions_details'] = igResult[2].impressions_details
										}

										if (igResult[2].profile_views_details) {
											resObj['profile_views_details'] = igResult[2].profile_views_details
										}
										if (igResult[0].top_post) {
											resObj['top_post'] = igResult[0].top_post
										}
										if (igResult[0].post_details) {
											resObj['post_details'] = igResult[0].post_details
										}
										//console.log("impressions",JSON.stringify(resObj['impressions'] ))
										// console.log("impressions", JSON.stringify(resObj['impressions_details']))
										resolveIns(resObj);
									})
										.catch(err => {
											resolveIns({});
											console.log("err   instagram promise all", JSON.stringify(err))
										})
								}).catch(err => {
									rejectIns({})
									console.log("err..2...instagram promise all......", JSON.stringify(err))
								});
							};

							switch (body.socialMedia) {
								case "twitter":

									console.log("............................twitter..................................")
									if (!body.userId) {
										done('422', {
											message: 'userId is required',
											status: false
										});
										return;
									}

									let twittQuery = [];
									twittQuery = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }, { $unwind: "$socialMedia" }];
									twittQuery.push({ $match: { 'socialMedia.name': 'twitter', 'socialMedia.userId': body.userId } });
									twittQuery.push({
										$project: {
											'_id': '$_id',
											'socialId': '$socialMedia._id',
											'name': '$socialMedia.name',
											'userId': '$socialMedia.userId',
											'oauth_token': '$socialMedia.oauth_token',
											'oauth_token_secret': '$socialMedia.oauth_token_secret',
											'screenName': '$socialMedia.screenName',
											'userName': '$socialMedia.screenName',
											'userProfileImage': '$socialMedia.userProfileImage',
											'email': '$socialMedia.email'
										}
									});

									console.log('twittQuery...................', JSON.stringify(twittQuery))


									socialDoc(twittQuery).then(async (sm) => {

										console.log('sm..................', JSON.stringify(sm))
										let dateNow = new Date();
										let currentdate = new Date();
										var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));

										if (body?.dateFilterType) {
											switch (body.dateFilterType) {
												case '7days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 7));
													break;
												case '14days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 14));
													break;
												case '90days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 90));
													break;
												case '180days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 180));
													break;
												default:
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));
													break;
											}
										}

										let dateFilter = `&start_time=${startDate.toISOString()}&end_time=${dateNow.toISOString()}`;
										if (body && body.dateFilterType && body.dateFilterType == 'custom') {
											if (!body.toDate) {
												done('422', {
													message: "To date Required",
													status: false
												})
												return;
											}
											if (!body.fromDate) {
												done('422', {
													message: "From date Required",
													status: false
												})
												return;
											}
											if (parseInt(body.fromDate) > parseInt(body.toDate)) {
												done('422', {
													message: "From date must be less then To date",
													status: false
												})
												return;
											}
											dateFilter = `&start_time=${new Date(parseInt(body.fromDate)).toISOString()}&end_time=${new Date(parseInt(body.toDate)).toISOString()}`
										}

										let promiseArray = [];
										//promiseArray.push(twitterTimeline(sm.doc, dateFilter));
										promiseArray.push(twitterTimeline(sm.doc, dateFilter));

										await Promise.all(promiseArray).then(allData => {
											let resObj = {};
											let tweetObj = {};
											resObj.tweetData = [];
											let timeLineArr = timeLine.flat();
											console.log("timeLineArr", timeLineArr.length)


											tweetObj.postCount = timeLineArr.length
											tweetObj.followers_count = userData.public_metrics.followers_count
											tweetObj.following_count = userData.public_metrics.following_count
											resObj.tweetData.push(tweetObj)
											console.log("allData...........", JSON.stringify(allData))
											done('200', {
												data: resObj,
												userData: userData,
												message: 'Analytics Data Retrieved.',
												status: true
											});
										}).catch(err => {
											console.log('err.......111111111,,', JSON.stringify(err))
											done('200', {
												data: [],
												message: 'Account Retrieved',
												status: false
											});
										})
									}).catch(err => {
										console.log('err.......,22222222222222,,,', JSON.stringify(err))
										done('200', {
											message: 'Social Media Not Available.',
											status: false
										});
									})
									break;
								case "linkedin":
									if (!body.userId) {
										done('422', {
											message: 'userId is required',
											status: false
										});
										return;
									}

									let linkedinQuery = [];
									linkedinQuery = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }, { $unwind: "$socialMedia" }];
									linkedinQuery.push({ $match: { 'socialMedia.name': 'linkedin', 'socialMedia.userId': body.userId } });
									linkedinQuery.push({
										$project: {
											'_id': '$_id',
											'socialId': '$socialMedia._id',
											'name': '$socialMedia.name',
											'oauth_token': '$socialMedia.oauth_token',
											'token_expiry': '$socialMedia.token_expiry',
											'token_validity': '$socialMedia.token_validity',
											'userId': '$socialMedia.userId',
											'linkedinPages': '$socialMedia.linkedinPages',
											'linkedinProfile': '$socialMedia.linkedinProfile',
											'email': '$socialMedia.email'
										}
									});

									socialDoc(linkedinQuery).then(async (link) => {
										console.log("linkedinQuery.............", JSON.stringify(linkedinQuery))

										console.log("link.............", JSON.stringify(link.doc))
										let dateNow = new Date();
										let endDate = dateNow.getTime()
										let currentdate = new Date();
										var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));
										let backDate = parseInt((startDate.getTime()).toFixed(0));
										if (body?.dateFilterType) {
											switch (body.dateFilterType) {
												case '7days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 7));
													backDate = parseInt((startDate.getTime()).toFixed(0));
													break;
												case '14days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 14));
													backDate = parseInt((startDate.getTime()).toFixed(0));
													break;
												case '90days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 90));
													backDate = parseInt((startDate.getTime()).toFixed(0));
													break;
												case '180days':
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 180));
													backDate = parseInt((startDate.getTime()).toFixed(0));
													break;
												default:
													currentdate = new Date();
													startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));
													backDate = parseInt((startDate.getTime()).toFixed(0));
													break;
											}
										}


										let dateFilter = `&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${backDate}&timeIntervals.timeRange.end=${endDate}`

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

											dateFilter = `&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${body.fromDate}&timeIntervals.timeRange.end=${body.toDate}`
										}

										let promiseArray = [];

										promiseArray.push(linkedinTimeline(link.doc, dateFilter));

										await Promise.all(promiseArray).then(allData => {
											console.log("allData")
											let resObj = {};
											let linkedinObj = {}

											resObj.linkedinData = [];
											let timeLineArr = linkedinTimeLine.flat();
											//console.log("timeLineArr", JSON.stringify(timeLineArr))

											timeLineArr[0].elements.forEach(insight => {
												//console.log("insight", JSON.stringify(insight))
												let clickCount = 0
												let likeCount = 0
												let impressionCount = 0
												let uniqueImpressionsCount = 0
												if (insight.totalShareStatistics.clickCount) {
													clickCount = insight.totalShareStatistics.clickCount
												}
												if (insight.totalShareStatistics.likeCount) {
													likeCount = insight.totalShareStatistics.likeCount
												}
												if (insight.totalShareStatistics.impressionCount) {
													impressionCount = insight.totalShareStatistics.impressionCount
												}
												if (insight.totalShareStatistics.uniqueImpressionsCount) {
													uniqueImpressionsCount = insight.totalShareStatistics.uniqueImpressionsCount
												}
												linkedinObj.clickCount = clickCount
												linkedinObj.likeCount = likeCount
												linkedinObj.impression = impressionCount
												linkedinObj.uniqueImpressionsCount = uniqueImpressionsCount
											});
											resObj.linkedinData.push(linkedinObj)
											done('200', {
												data: allData,
												message: 'Analytics Data Retrieved.',
												status: true
											});
										})
										//.catch(err => {
										// 	console.log('errrrr1',JSON.stringify(err));
										// 	done('200', {
										// 		data: [],
										// 		message: 'Account Retrieved',
										// 		status: false
										// 	});
										// })

									}).catch(err => {
										done('200', {
											message: 'link Social Media Not Available.',
											status: false
										});
									})

									break;
								case "facebook":
									console.log("............................facebook..................................")

									if (!body.userId) {
										done('422', {
											message: 'userId is required',
											status: false
										});
										return;
									};
									if (!body.pageId) {
										done('422', {
											message: 'pageId is required',
											status: false
										});
										return;
									}
									console.log('fbbbbbbbbbbbbbbbbbbb');
									let fbQuery = [];
									fbQuery = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }];
									fbQuery.push({ $unwind: "$socialMedia" })
									fbQuery.push({ $match: { 'socialMedia.name': 'facebook', 'socialMedia.userId': body.userId } });
									fbQuery.push({ $unwind: "$socialMedia.fbpages" })
									fbQuery.push({ $match: { "socialMedia.fbpages.id": body.pageId } })
									fbQuery.push({
										$project: {
											_id: 0,
											"access_token": "$socialMedia.fbpages.access_token",
											"id": "$socialMedia.fbpages.id",
											"userId": "$socialMedia.userId",
											"name": "$socialMedia.fbpages.name",
											"image": "$socialMedia.fbpages.image",
											"type": "$socialMedia.fbpages.type"
										}
									})

									console.log('body.userId', JSON.stringify(body.userId))
									console.log('fbQuery', JSON.stringify(fbQuery))
									socialDoc(fbQuery).then(async (sm) => {
										console.log('sm', JSON.stringify(sm));
										let dateNow = new Date().getTime() / 1000;
										let currentdate = new Date();
										var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30)) / 1000;
										var startDate = parseInt(((new Date().getTime()) / 1000).toFixed(0));

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
											console.log('body.Date.........', JSON(body.toDate))
											console.log('body.fromDate........', JSON(body.fromDate))
											dateFilter = `&since=${from.toFixed(0)}&until=${to.toFixed(0)}`;
										}
										// console.log('dateFilter.........',JSON(dateFilter))
										let fbPromiseArr = [];
										let fromDate = body.fromDate;
										let toDate = body.toDate;
										fbPromiseArr.push(facebook(sm.doc, dateFilter))
										await Promise.all(fbPromiseArr).then(resultArr => {
											done('200', {
												status: true,
												message: "FB Data retrieved successfully.",
												data: resultArr,
											})
										})
									}).catch(err => {
										console.log('err.......,22222222222222,,,', JSON.stringify(err))
										done('200', {
											message: 'Social Media Not Available.',
											status: false
										});
									})
									// let dateNow = new Date().getTime() / 1000;
									// let currentdate = new Date();
									// var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30)) / 1000;

									// //var startDate =parseInt(((new Date().getTime()) / 1000).toFixed(0));

									// if (body && body.dateFilterType && body.dateFilterType == '7days') {
									// 	currentdate = new Date();
									// 	startDate = new Date(currentdate.setDate(currentdate.getDate() - 7)) / 1000;
									// }
									// if (body && body.dateFilterType && body.dateFilterType == '14days') {
									// 	currentdate = new Date();
									// 	startDate = new Date(currentdate.setDate(currentdate.getDate() - 14)) / 1000;
									// }

									// let dateFilter = `&since=${parseInt(startDate.toFixed(0))}&until=${parseInt(dateNow.toFixed(0))}`;
									// if (body && body.dateFilterType && body.dateFilterType == 'custom') {
									// 	if (!body.toDate) {
									// 		done('422', {
									// 			message: "To date Required"
									// 		})
									// 		return;
									// 	}
									// 	if (!body.fromDate) {
									// 		done('422', {
									// 			message: "From date Required"
									// 		})
									// 		return;
									// 	}
									// 	if (parseInt(body.fromDate) > parseInt(body.toDate)) {
									// 		done('422', {
									// 			message: "From date must be less then To date"
									// 		})
									// 		return;
									// 	}
									// 	let from = parseInt(body.fromDate) / 1000;
									// 	let to = parseInt(body.toDate) / 1000;

									// 	dateFilter = `&since=${from.toFixed(0)}&until=${to.toFixed(0)}`;
									// }
									// let fbPromiseArr = [];
									// let fromDate = body.fromDate;
									// let toDate = body.toDate;
									// fbPromiseArr.push(facebook(sm.doc, startDate, endDate))

									// Promise.all(fbPromiseArr).then(resultArr => {
									// 	//console.log('.....resultArr.....', JSON.stringify(resultArr))

									// }).catch(err => {
									// 	console.log('err.2.........', JSON.stringify(err))
									// 	done('200', {
									// 		message: 'error1',
									// 		data: {}
									// 	})
									// 	// }).catch(err => {
									// 	// 	console.log('err1..........', JSON.stringify(err))
									// 	// 	done('200', {
									// 	// 		message: 'error2',
									// 	// 		data: {}
									// 	// 	})
									// 	// })
									break;
								case "youtube":
									if (!body.userId) {
										done('422', {
											message: 'userId is required',
											status: false
										});
										return;
									}

									let youtubeQuery = [];
									youtubeQuery = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }];
									youtubeQuery.push({ $unwind: "$socialMedia" })
									youtubeQuery.push({ $match: { 'socialMedia.name': 'youtube', 'socialMedia.userId': body.userId } });
									youtubeQuery.push({
										$project: {
											'socialId': '$socialMedia._id',
											'name': '$socialMedia.name',
											'userId': '$socialMedia.userId',
											'userName': '$socialMedia.channel_name',
											'channel_name': '$socialMedia.channel_name',
											'oauth_token': '$socialMedia.oauth_token',
											'refresh_token': '$socialMedia.refresh_token',
											'userProfileImage': '$socialMedia.userProfileImage',
											'email': '$socialMedia.email'
										}

									});

									socialDoc(youtubeQuery).then(async (sm) => {

										console.log("............sm......", JSON.stringify(sm));

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
										let promiseArr = [];
										promiseArr.push(youtube(sm.doc, dateFilter, postFilter))
										Promise.all(promiseArr).then(resultArr => {
											done('200', {
												status: true,
												message: "Youtube Data retrieved successfully.",
												data: resultArr
											})

										}).catch(err => {
											done('200', {
												message: 'error',
												data: {}
											})
										})
									})

									break;
								case "instagram":
									if (!body.userId) {
										done('422', {
											message: 'userId is required',
											status: false
										});
										return;
									}

									let instagramQuery = [];
									instagramQuery = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }];
									instagramQuery.push({ $unwind: "$socialMedia" })
									instagramQuery.push({ $match: { 'socialMedia.name': 'instagram', 'socialMedia.userId': body.userId } });
									instagramQuery.push({
										$project: {
											'socialId': '$socialMedia._id',
											'name': '$socialMedia.name',
											'userId': '$socialMedia.userId',
											'oauth_token': '$socialMedia.oauth_token',
											'refresh_token': '$socialMedia.refresh_token',
											'userProfileImage': '$socialMedia.userProfileImage',
											'type': '$socialMedia.type',
											'screen_name': '$socialMedia.screen_name'
										}
									});
									socialDoc(instagramQuery).then(async (sm) => {
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
										let promiseArray = [];
										promiseArray.push(instagram(sm.doc, dateFilter))
										await Promise.all(promiseArray).then(resultArr => {
											done('200', {
												status: true,
												message: "ins Data retrieved successfully.",
												data: resultArr,
											})
										})
									}).catch(err => {
										console.log('err.......,22222222222222,,,', JSON.stringify(err))
										done('200', {
											message: 'Social Media Not Available.',
											status: false
										});
									})
									// await Promise.all(promiseArray).then(allData => {
									// 	let resObj = {};
									// 	let instaObj = {};
									// 	resObj.instaObj = [];
									// 	// let timeLineArr = timeLine.flat();
									// 	// console.log("timeLineArr", timeLineArr.length)
									// 	// instaObj.postCount = timeLineArr.length
									// 	instaObj.followers_count = userData.public_metrics.followers_count
									// 	instaObj.following_count = userData.public_metrics.following_count
									// 	resObj.instaObj.push(instaObj)
									// 	console.log('allData..................', JSON.stringify(allData))
									//userData: userData,
									// done('200', {
									// 	data: sm,
									// 	message: 'insta Data Retrieved.',
									// 	status: true
									// });
									// })
									// }).catch(err => {
									// 	console.log('err.......111111111,,', JSON.stringify(err))
									// 	done('200', {
									// 		data: [],
									// 		message: 'Account Retrieved',
									// 		status: false
									// 	});

									break;
								case "googlemybusiness":
									if (!body.userId) {
										done('422', {
											message: 'userId is required',
											status: false
										});
										return;
									}
									if (!body.locationId) {
										done('422', {
											message: 'locationId is required',
											status: false
										});
										return;
									}
									let gmbQuery = [];
									gmbQuery = [{ $match: { 'email': { $regex: new RegExp("^" + email, "i") } } }];
									gmbQuery.push({ $unwind: "$socialMedia" })
									gmbQuery.push({ $match: { 'socialMedia.name': 'googlemybusiness', 'socialMedia.userId': body.userId, 'socialMedia.locationId': body.locationId } });
									gmbQuery.push({
										$project: {
											'socialId': '$socialMedia._id',
											'name': '$socialMedia.name',
											'userId': '$socialMedia.userId',
											'locationId': '$socialMedia.locationId',
											'userName': '$socialMedia.channel_name',
											'channel_name': '$socialMedia.channel_name',
											'oauth_token': '$socialMedia.oauth_token',
											'refresh_token': '$socialMedia.refresh_token',
											'userProfileImage': '$socialMedia.userProfileImage',
											'email': '$socialMedia.email'
										}
									});
									console.log('gmbQuery.............', JSON.stringify(gmbQuery))
									socialDoc(gmbQuery).then(async (sm) => {
										console.log('sm.............', JSON.stringify(sm))
										let dateNow = new Date();
										let currentdate = new Date();
										var startDate = new Date(currentdate.setDate(currentdate.getDate() - 30));
										var endDate = new Date()
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
										let promiseArr = [];
										console.log('startDate..........', JSON.stringify(startDate))
										console.log('endDate..........', JSON.stringify(endDate))

										promiseArr.push(googlemybusiness(sm.doc, startDate, endDate))

										Promise.all(promiseArr).then(resultArr => {
											//console.log('.....resultArr.....', JSON.stringify(resultArr))
											done('200', {
												status: true,
												message: "GMB Data retrieved successfully.",
												data: resultArr,
											})
										}).catch(err => {
											done('200', {
												message: 'error2',
												data: {}
											})
										})
									}).catch(err => {

										console.log('err..........', JSON.stringify(err))

										done('200', {
											message: 'error1',
											data: {}
										})
									})
									break;
								default:
									break;
							}
						} else {
							done('200', {
								status: false,
								message: 'User not found.'
							});
						}
					}).catch((error) => {
						console.log('error.....', (error));
						done('200', {
							message: 'Connection Error1',
							status: false
						});
					});
				}
				else {
					done('200', {
						message: "Unauthorized",
						status: false
					});
				}
			}
			else {
				done('200', {
					message: "Unauthorized",
					status: false
				});
			}
			break;
		default:
			done(new Error(`Unsupported method "${event.httpMethod}"`));
	}
};
