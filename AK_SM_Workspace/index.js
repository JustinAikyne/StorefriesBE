var mongoose = require('mongoose');
var ObjectId = require('mongoose').Types.ObjectId;
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

				let userQuery = { 'email': { $regex: new RegExp("^" + email, "i") } };
				userModel.findOne(userQuery).exec(async (err, userDetails) =>{
					if (userDetails) {
						if (userDetails.status !== "active") {
							done('200', {
								message: "User not activeted their profile.",
								status: false
							});
							return;
						}

						switch (event.httpMethod) {
							case 'POST':
								console.log('Post called')
								try {
									let body = JSON.parse(event.body);

									let workspaceCount = await workspaceModel.countDocuments({ 'workspaceName': { $regex: new RegExp("^" + body.workspaceName, "i") } });
									if (workspaceCount > 0) {
										done('409', {
											status: false,
											message: "Workspace name already exist, try different name."
										});
									}
									let workspace = new workspaceModel();

									workspace.workspaceName = body.workspaceName.toLowerCase();
									workspace.workspaceDisplayName = body.workspaceName;
									workspace.superAdmin = body.email.toLowerCase();
									if (body.workspaceLogo) {
										workspace.workspaceLogo = body.workspaceLogo;
									}
									let workspaceData = await workspace.save()

									done('200', {
										status: true,
										message: 'Workspace register successfully.',
									})
								} catch (error) {
									done('200', {
										status: false,
										message: 'Workspace create failed.',
									})
								}

								break;
							case 'GET':
								console.log('Get workspace started')

								console.log("email", email);


								let workspaceQry = [];
								var collection = userModel;

								workspaceQry.push({
									$lookup: {
										"from": "workspaces", "let": { "userId": "$_id", "role": "$role" },
										pipeline: [
											{ "$match": { "$expr": { "$in": ["$$userId", "$users.userId"], }, }, },
											{
												"$project": {
													"_id": 1, "workspaceStatus": "$status", "workspaceDisplayName": 1, "superAdmin": 1, "workspaceLogo": 1,
													//"team": { $cond: { if: { $eq: ['$$role', "superAdmin"] }, then: '$users', else: 0 } }
												}
											}
										], as: "workspace"
									},
								},
									{
										"$project": { "_id": 1, /* "features": 1, */ "workspace": "$workspace", /* "status": 1 */ }
									})

								console.log("workspaceQry", JSON.stringify(workspaceQry))

								if (event.queryStringParameters && event.queryStringParameters.workspaceId) {
									collection = workspaceModel;
									workspaceQry = [
										{ "$match": { _id: new ObjectId(event.queryStringParameters.workspaceId) } },
										{
											"$project": {
												"_id": 1, "status": 1, "workspaceDisplayName": 1, "superAdmin": 1,
												"team": {
													"$filter": {
														input: "$users",
														as: "user",
														cond: { $ne: ["$$user.role", "approver"] }
													}
												}
											}
										}
									]
								}

								collection.aggregate(workspaceQry).exec(function (err, userDetails) {
									if (userDetails && userDetails.length > 0 && userDetails[0]?.workspace && userDetails[0].workspace.length > 0) {
										done('200', {
											status: true,
											message: 'Workspace retrieved successfully.',
											data: userDetails[0].workspace
										});
									} else {
										done('200', {
											status: true,
											message: 'Workspace not available.',
											data: []
										});
									}
								});
								break;
							case 'PUT':

								let body = JSON.parse(event.body);

								console.log("Workspace edit");

								if (!event.pathParameters || !event.pathParameters.workspaceId) {
									done('422', {
										status: false,
										message: "workspaceIdis required."
									});
									return;
								}

								let workspaceId = event.pathParameters.workspaceId;

								let promiseArr = [];

								const getWorkspaceById = (workspaceId) => {
									return new Promise(async (resolve, reject) => {
										try {
											console.log("workspaceId", workspaceId)
											let workspaceCount = await workspaceModel.countDocuments({ '_id': new ObjectId(workspaceId) });
											if (workspaceCount < 1) {
												done('404', {
													status: false,
													message: "Workspace not found."
												});
												return
											}else{
												resolve({status:true, message: "Success"})
											}

										} catch (error) {
											reject({
												status: false,
												message: error.message
											})
										}
									})
								}
								const getWorkspaceByName = (workspaceName) => {
									return new Promise(async (resolve, reject) => {
										try {
											let workspaceCount = await workspaceModel.countDocuments({ 'workspaceName': { $regex: new RegExp("^" + workspaceName, "i") } });
											if (workspaceCount > 0) {
												done('404', {
													status: false,
													message: "Workspace not found."
												});
												return
											}else{
												resolve({status: true, message: "Success"})
											}
										} catch (error) {
											reject({
												status: false,
												message: error.message
											})
										}

									})
								}

								promiseArr.push(getWorkspaceById(event.pathParameters.workspaceId));
								if (body.workspaceName) {
									promiseArr.push(getWorkspaceByName(body.workspaceName));
								}

								Promise.all(promiseArr).then((result) => {

									console.log("result", JSON.stringify(result))

									let updateObj = {};

									if (body.workspaceTimezone) {
										updateObj.workspaceTimezone = body.workspaceTimezone;
									}
									if (body.workspaceName) {
										updateObj.workspaceName = body.workspaceName;
									}
									if (body.workspaceDisplayName) {
										updateObj.workspaceDisplayName = body.workspaceDisplayName;
									}
									if (body.workspaceLogo) {
										updateObj.workspaceLogo = body.workspaceLogo;
									}
									if (body.default) {
										updateObj.default = body.default;
									}

									if (Object.keys(updateObj).length > 0) {
										workspaceModel.findOneAndUpdate({ '_id': new ObjectId(workspaceId) }, { $set: updateObj }, { new: true }).then(updateRes => {
											done('200', {
												status: true,
												message: "Workspace Updated Successfully."
											});

										}).catch(error => {
											done('400', {
												status: false,
												message: error.message
											});
										})
									} else {
										done('200', {
											status: true,
											message: "Workspace fields not provided."
										});
									}
								}).catch((error) => {
									done('400', {
										status: false,
										message: error.message
									});
								})

								break;
							case 'DELETE':
								if (!event.pathParameters.workspaceId) {
									done('200', {
										message: "WorkspaceId is required",
										status: false
									})
									return;
								}
								workspaceModel.remove({ _id: event.pathParameters.workspaceId }).exec().then(result => {
									//console.log(event.pathParameters.workspaceId);
									done('200', {
										status: true,
										message: 'workspace deleted successfully.',

									})
								}).catch(err => {
									console.log(err);
									done('400', {
										message: 'workspace delete failed',
										status: false,
									});
								});
								break;
							default:
								done('200', {
									message: `Unsupported method "${event.httpMethod}"`,
									status: false
								});
						}
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
};