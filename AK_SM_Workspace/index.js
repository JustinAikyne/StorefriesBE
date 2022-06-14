var mongoose = require('mongoose');
var userModel = require('./userModel.js');
var workspaceModel = require('./workspaceModel.js');
var jwt = require('jsonwebtoken');
var fs = require('fs');
const jwt_decode = require('jwt-decode');
var aws = require("aws-sdk");
var axios = require("axios");

exports.handler = (event, context, callback) => {
	console.log('Received event:', JSON.stringify(event));



	var done = (err, res) => callback(null, {
		statusCode: err ? err : '400',
		body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		},
	});

	var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}`, { useNewUrlParser: true, useUnifiedTopology: true });
	//var connectorMongodb = mongoose.connect('mongodb+srv://storefries:OEo4ydiRIYRP7Pdk@storefries.76ocf.mongodb.net/SocialMediaPublisher', { useNewUrlParser: true, useUnifiedTopology: true });
	context.callbackWaitsForEmptyEventLoop = false;
	const audience = event.stageVariables['oauth_audience'];
	const issuer = event.stageVariables['oauth_issuer'];
	aws.config.update({ region: event.stageVariables['aws_region'] });
	const s3 = new aws.S3();
	const bucketName = `${event.stageVariables['s3_bucket_name']}`

	/* let createWorkspace = async(params) =>{



	} */

	if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {

		console.log("....................start.......................")

		event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;
		const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
		const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
		if (email && email !== '') {
			/* let token = event.headers.authorization ? event.headers.authorization : event.headers.Authorization;

			var options = {
				method: 'GET',
				url: 'https://aikyne1.eu.auth0.com/api/public',
				headers: {authorization: `Bearer ${tokenCrop}`}
			  };
			axios.request(options).then(function (response) {
				done('200', {
					status: true,
					message: 'JWT',
					data: null
				});
				//return  decodedToken;
				return;
			  }).catch(function (error) {
				done('200', {
					status: false,
					message: 'JWT',
					data: null
				});
				//return  decodedToken;
				return;
			  }) */

			// var decoded = jwt.decode(tokenCrop,{complete: true});
			// //var decoded = jwt.verify(tokenCrop, 'c5vxDExYm6QvZMAx_Wz7UejeaRiLqK53de8iDWPlf8ih5VsW5-9SnuLfenrRmkxa');

			// const decodedToken = jwt.verify(tokenCrop, pemCert, { algorithm: 'RS256' });

			connectorMongodb.then(async () => {
				switch (event.httpMethod) {
					case 'POST':


						break;
					case 'GET':
						console.log('Get workspace started')

						if (event.headers && event.headers.userauthdata) {
							const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
							const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
							if (email && email !== '') {
								console.log("email", email);
								connectorMongodb.then(async () => {
									let userQuery = { 'email': { $regex: new RegExp("^" + email, "i") } };
									userModel.findOne(userQuery).exec(function (err, userDetails) {
										if (userDetails) {
											if (userDetails.status !== "active") {
												done('200', {
													message: "User not activeted their profile.",
													status: false
												});
												return;
											}

											let workspaceQry = [];

											workspaceQry.push({
												$lookup: {
													"from": "workspaces",
													"let": { "userId": "$_id", "role": "$role" },
													pipeline: [
														{
															"$match": {
																"$expr": {
																	"$in": ["$$userId", "$users.userId"],
																},
															},
														},
														{
															"$project": {
																"_id": 1,
																"workspaceStatus": "$status",
																"workspaceDisplayName": 1,
																"superAdmin": 1,
																"workspaceLogo": 1,
																"team": {
																	$cond: {
																		if: { $eq: ['$$role', "superAdmin"] }, then: '$users', else: 0
																	}
																}
															}
														}
													],
													as: "workspace"
												},
											},
											{
												"$project": {
													"_id": 1,
													"features": 1,
													"workspace": "$workspace",
													"status": 1
												}
											})
											/* workspaceQry.push({
												"$project": {
													"_id": 1,
													"password": 0,
													"firstName": 1,
													"lastName": 1,
													"features": 1,
													"status": 1
												}
											}) */

											console.log("workspaceQry", JSON.stringify(workspaceQry))

											userModel.aggregate(workspaceQry).exec(function (err, userDetails) {

												console.log("userDetails", JSON.stringify(userDetails))



												done('200', {
													status: true,
													message: 'Workspace retrieved successfully.',
													data: userDetails
												});

											});
										} else {
											done('200', {
												message: "User Not Found",
												status: false
											});
										}
									});
								}).catch((error) => {
									done('200', {
										message: 'Connection Error',
										status: false
									});
								});
							} else {
								done('200', {
									message: "Unauthorized",
									status: false
								});
							}
						} else {
							done('200', {
								message: "Unauthorized",
								status: false
							});
						}
						break;
					default:
						done('200', {
							message: `Unsupported method "${event.httpMethod}"`,
							status: false
						});
				}
			}).catch((error) => {
				done('200', {
					message: 'Connection Error',
					status: false
				});
			});
		} else {
			done('200', {
				message: "Unauthorized",
				status: false
			});
		}
	} else {
		done('200', {
			message: "Unauthorized",
			status: false
		});
	}
};
