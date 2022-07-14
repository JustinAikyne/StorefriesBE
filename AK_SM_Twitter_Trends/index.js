var mongoose = require('mongoose');
var axios = require('axios');
var AuthHelper = require('./AuthHelper.js');
var userModel = require('./userModel.js');
//var async = require('async');


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
	const itemCount = 20;

	switch (event.httpMethod) {
		case 'POST':
			console.log('Twitter sign in step 2')
			var body = JSON.parse(event.body);
			context.callbackWaitsForEmptyEventLoop = false;
			if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
				event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;
				const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
				const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
				console.log("email.......", email)
				if (email && email !== '') {
					connectorMongodb.then(() => {
						const mdQueryRet = { 'email': { $regex: new RegExp("^" + email, "i") } };
						userModel.findOne(mdQueryRet, { 'firstName': 1, 'lastName': 1, 'email': 1, 'location': 1 }).exec(async (err, doc) => {
							console.log("doc....",JSON.stringify(doc))
							if (doc) {
								let woeid = 1
								if (doc.location && doc.location.lat && doc.location.lng) {
									let url = `https://api.twitter.com/1.1/trends/closest.json?lat=${doc.location.lat}&long=${doc.location.lng}`
									const request = {
										url: url,
										method: 'GET',
										body: {}
									}
									//let authHeader = AuthHelper.getAuthHeaderForRequest(request, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
									let authHeader = AuthHelper.getAuthHeaderForRequest(request, CONSUMERKEY, CONSUMERSECRET);
									var res = await axios.get(encodeURI(request.url), { headers: authHeader })

									if (res && res.data && res.data.length > 0) {
										woeid = res.data[0].woeid;
									}
								}
								if (body && body.lat && body.lng) {
									let url = `https://api.twitter.com/1.1/trends/closest.json?lat=${body.lat}&long=${body.lng}`
									const request = {
										url: url,
										method: 'GET',
										body: {}
									}
									//let authHeader = AuthHelper.getAuthHeaderForRequest(request, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
									let authHeader = AuthHelper.getAuthHeaderForRequest(request, CONSUMERKEY, CONSUMERSECRET);
									var res = await axios.get(encodeURI(request.url), { headers: authHeader })
									if (res && res.data && res.data.length > 0) {
										woeid = res.data[0].woeid;
									}
								}

								console.log("woeid............", woeid);

								const request1 = {
									url: `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`,
									method: 'GET',
									body: {}
								}
								//let authHeader = AuthHelper.getAuthHeaderForRequest(request1, event.stageVariables['Twitter_ConsumerKey'], event.stageVariables['Twitter_ConsumerSecret']);
								let authHeader = AuthHelper.getAuthHeaderForRequest(request1, CONSUMERKEY, CONSUMERSECRET);
								var resp = await axios.get(encodeURI(request1.url), { headers: authHeader })
								if (resp && resp.data && resp.data.length > 0) {
									let trends = resp.data[0].trends.slice(0, (resp.data[0].trends.length > itemCount ? itemCount : resp.data[0].trends.length));
									resp.data[0].trends = trends;

									done('200', {
										data: resp.data[0]
									})
								} else {
									done('400', {
										message: "Trends not available"
									});
								}
							} else {
								done('400', {
									message: "User not Found"
								});
							}
						})
					}).catch((error) => {
						done('400', {
							status: "Connection Error",
							message: error
						})

					})
				} else {
					done('403', {
						message: "Unauthorized"
					});
				}
			} else {
				done('403', {
					message: "Unauthorized"
				});
			}
			break;
		default:
			done(new Error(`Unsupported method "${event.httpMethod}"`));
	}
};
