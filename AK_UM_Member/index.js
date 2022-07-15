var mongoose = require('mongoose');
var ObjectId = require('mongoose').Types.ObjectId;
var userModel = require('./userModel.js');
var workspaceModel = require('./workspaceModel.js');
var aws = require("aws-sdk");

exports.handler = (event, context, callback) => {
	var done = (err, res) => callback(null, {
		statusCode: err ? err : '400',
		body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		},
	});

	const getRandomString = (length) => {
		var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		var result = '';
		for (var i = 0; i < length; i++) {
			result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
		}
		return result;
	}

	var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}`, { useNewUrlParser: true, useUnifiedTopology: true });
	//var connectorMongodb = mongoose.connect('mongodb+srv://storefries:OEo4ydiRIYRP7Pdk@storefries.76ocf.mongodb.net/SocialMediaPublisher', { useNewUrlParser: true, useUnifiedTopology: true });
	context.callbackWaitsForEmptyEventLoop = false;
	const audience = event.stageVariables['oauth_audience'];
	const issuer = event.stageVariables['oauth_issuer'];
	aws.config.update({ region: event.stageVariables['aws_region'] });
	const s3 = new aws.S3();
	const bucketName = `${event.stageVariables['s3_bucket_name']}`
	const sender_email = event.stageVariables['sender_email'];
	const confirm_endPoint = event.stageVariables['confirm_endPoint'];


	if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
		event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;
		const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
		const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
		if (email && email !== '') {

			connectorMongodb.then(async () => {

				let userQuery = { 'email': { $regex: new RegExp("^" + email, "i") } };
				userModel.findOne(userQuery).exec(async (err, userDetails) => {
					if (userDetails) {

						switch (event.httpMethod) {
							case 'POST':
								var body = JSON.parse(event.body);
								if (event.resource === "/user/addUser") {
									try {

										//let workspacedetail = await workspaceModel.findOne({ 'workspaceId': { $regex: new RegExp("^" + body.workspaceId, "i") } });
										let workspaceDetail = await workspaceModel.findOne({ "_id": new ObjectId(body.workspaceId) })

										if (workspaceDetail) {
											for (let i = 0; i < workspaceDetail.users.length; i++) {
												const user = workspaceDetail.users[i];
												if (user.email == body.email) {
													done('409', {
														status: false,
														message: "Member already exist.",
													})
													return;
												}
											}
											let userDetail = await userModel.findOne({ 'email': { $regex: new RegExp("^" + body.email, "i") } }).exec();
											let workspaceObj = {};

											if (userDetail) {

												workspaceObj.email = userDetail.email;
												workspaceObj.name = userDetail.firstName + " " + userDetail.lastName;
												workspaceObj.role = body.role;
												workspaceObj.userId = userDetail._id;
												workspaceObj.status = "added";
												workspaceDetail.users.push(workspaceObj)
												await workspaceDetail.save()
												done('200', {
													message: "Member added successfully",
													status: true
												});

											}
											else {

												//send email....................................................


												var user = new userModel();
												user.email = body.email.toLowerCase();
												//user.role = body.role;
												const actString = getRandomString(10);
												user.activationString = actString;
												user.status = 'invited';
												user.invitedBy = workspaceDetail._id;

												user.save(async (err, docs) => {

													const emailLink = `${confirm_endPoint}confirmEmail?email=${body.email}&actCode=${actString}`;
													const mailBody = `Hello , Kindly click on the following link to activate your storefries.com account. `

													const htmlMailBody = `<html> <head></head> <body style="width: 80%; text-align: justify; margin: auto; box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19); padding-top: 2%; padding-bottom: 2%;padding-right: 2%; padding-left: 2%;"> <div> <div><a href="http://www.storefries.com/" style="display:inline-block" target="_blank"><img src="https://d21ji477fyr6w.cloudfront.net/emailasset/storefries_logo.png" style="display:block;height:60px;width:160px"></img></a></div></div><div style="padding:20px 0 0 0;font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>Dear ,</b></div><div style="font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>We're super happy to have you onboard!</b></div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">To start your Social Media Marketing journey with Storefries please confirm your email with this Confirm Account button: <br><br></div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><a style="text-decoration:none;color:#3282C9;display:inline-block;border-top:14px solid #3282C9;border-right:40px solid #3282C9;border-bottom:14px solid #3282C9;border-left:40px solid #3282C9;font-size:16px;font-weight:600;font-family:'Open Sans','Trebuchet MS',sans-serif;color:#ffffff;background-color:#3282C9" href="${emailLink}" target="_blank"><span class="il">Confirm</span> Account</a></div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">If you have any questions regarding your Storefries account, Please contact us at <a href="mailto:support@storefries.com" style="color:#2696eb;text-decoration:none" target="_blank">support@storefries.com</a>. Our technical support team will assist you with anything you need. </div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">Enjoy yourself, and welcome to Storefries. </div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">Regards,</div><div style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>Storefries Team</b><br></div><div style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><a href="http://www.storefries.com/" style="color:#2696eb;text-decoration:none" target="_blank">www.storefries.com</a></div><div style="border-bottom:3px solid #3282C9"></div><br>This email is generated from storefries with your request of account activation. Please add us to your address Book or Whitlist us <a href="mailto:support@storefries.com" style="color:#0091ff;text-decoration:none" target="_blank">support@storefries.com</a>.</div></body></html>`;

													var params = {
														Destination: {
															ToAddresses: [body.email],
														},
														Message: {
															Body: {
																Html: {
																	Data: htmlMailBody,
																	Charset: "UTF-8"
																}
															},
															Subject: { Data: "Account activation : Storefries.com" },
														},
														Source: sender_email,
													};


													var sendPromise = await new aws.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();

													// sendPromise.then(
													// 	function (data) {
													// 		done('201', {
													// 			status: 'User inserted',
													// 			data: {
													// 				id: docs.id,
													// 				firstName: docs.firstName,
													// 				lastName: docs.lastName,
													// 				email: body.email,
													// 				subscriptionHostedData: subscriptionData
													// 				//res: res.data
													// 			}
													// 		})
													// 	}).catch(
													// 		function (err) {
													// 			console.error(err, err.stack);
													// 			done('422', {
													// 				status: 'Error in sending mail'
													// 			});
													// 		});

													workspaceObj.email = body.email;
													workspaceObj.role = body.role;
													workspaceObj.status = "pending";
													workspaceObj.userId = new ObjectId(docs._id)
													workspaceDetail.users.push(workspaceObj)
													await workspaceDetail.save()

													done('200', {
														message: "Member added successfully",
														status: true
													});
												})
											}


										} else {
											done('404', {
												message: "Workspace not available",
												status: false
											});
										}
									} catch (error) {
										done('200', {
											status: false,
											message: 'Member adding failed.',
										})
									}

								} else if (event.resource === "/user/regMember") {

									const schema = Joi.object({
										password: Joi.string().pattern(new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')).required(),
										confirmPassword: Joi.string().pattern(new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')).required(),
										firstName: Joi.string().required(),
										lastName: Joi.string().required(),
										userId: Joi.string().required()
									})

									try {
										const value = await schema.validateAsync(body);
									} catch (err) {
										if (err.details && err.details[0] && err.details[0].message) {
											done('422', {
												message: err.details[0].message.replace(/\r?\"|\r/g, "")
											});
										} else {
											done('400', {
												err: err
											});
										}
										return;
									}
									if (body.password !== body.confirmPassword) {
										done('401', {
											message: 'Password and confirm Password does not Match',
											status: false
										});
										return;
									}
									let userDetail = await userModel.findOne({ "_id": body.userId });
									console.log('......userDetail............', JSON.stringify(userDetail));
									if (userDetail) {
										if (userDetail.status !== 'invited') {
											done('403', {
												message: 'User not invited',
												status: false
											});
											return;
										}

										let workspaceDetail = await workspaceModel.findOne({ "_id": userDetail.invitedBy });

										if (workspaceDetail) {

											let updateObj = {};

											updateObj.status = "active";
											updateObj.activationString = null;
											updateObj.firstName = body.firstName;
											updateObj.lastName = body.lastName;

											var salt = bcrypt.genSaltSync(10);
											var hash = bcrypt.hashSync(body.password, salt);
											updateObj.password = hash;

											await userModel.findOneAndUpdate({ "_id": body.userId }, { $set: updateObj }, { new: true });

											//let workspaceDetail = await workspaceModel.findOne({ "_id": new ObjectId() })

											let members = [];
											let loop = 0;
											console.log("workspaceDetail.users.length", workspaceDetail.users.length)
											
											for (let i = 0; i < workspaceDetail.users.length; i++) {
												const user = workspaceDetail.users[i];
												if (user.userId == body.userId) {
													user.name = body.firstName + " " + body.lastName;
													user.status = "added";
												}
												members.push(user);
												loop++
											}

											if (loop === workspaceDetail.users.length) {
												workspaceDetail.users = members;
												await workspaceDetail.save();
												done('200', {
													message: "Registered successfully",
													status: true
												});
											}
										} else {
											done('404', {
												message: 'Workspace not found',
												status: false
											});
											return;
										}
									} else {
										done('403', {
											message: 'User not invited',
											status: false
										});
										return;
									}
								} else {
									done('404', {
										message: "Path not available",
										status: false
									});
								}
								break;
							case 'DELETE':

								let workspaceDetail = await workspaceModel.findOne({ "_id": new ObjectId(event.pathParameters.workspaceId) })
								if (workspaceDetail) {
									if (workspaceDetail.users.length == 1) {
										done('405', {
											status: false,
											message: "Atleast One member should be there.",
										})
										return
									}


									for (let i = 0; i < workspaceDetail.users.length; i++) {
										const user = workspaceDetail.users[i];
										event.pathParameters.email

										if (user.email == event.pathParameters.email) {

											if (user.role === 'super_admin') {
												done('405', {
													status: false,
													message: "Super Admin could not be remove",
												})
												return
											} else {
												workspaceDetail.users.splice(i, 1)
												await workspaceDetail.save();
											}
											break;

										}
									}

									done('200', {
										status: true,
										message: "Member removed succesfully.",
									})
								} else {
									done('404', {
										message: "Workspace not available",
										status: false
									});
								}
								break;
							case 'GET':
								console.log('GET details')
								if (!event.pathParameters.workspaceId) {
									done('200', {
										message: "workspaceId is required.",
										status: false
									})
									return;
								}
								let workspaceDetails = await workspaceModel.findOne({ "_id": event.pathParameters.workspaceId })
								console.log('11111111111', event.pathParameters.workspaceId)
								if (workspaceDetails) {
									done('200', {
										status: true,
										message: "Members retrived succesfully.",
										data: workspaceDetails.users
									})
								}
								else {
									done('404', {
										status: false,
										message: "Workspace not available.",
									})
								}
								break;
							case 'PUT':

								var body = JSON.parse(event.body);
								let workspace = await workspaceModel.findOne({ "_id": event.pathParameters.workspaceId })

								if(workspace){
									let userArray=[];
									for (let i = 0; i < workspace.users.length; i++) {
										const user = workspace.users[i];
										if (user.email == body.email) {
											user.role = body.role
										}
										userArray.push(user)
									}
									workspace.users = userArray;
									workspace.save()
									done('200', {
										message: "Member updated succesfully",
										status: true
									});

								}else{
									done('404', {
										message: "Workspace not available",
										status: false
									});
								}
								break;
							default:
								done('200', {
									message: `Unsupported method "${event.httpMethod}"`,
									status: false
								});

								break
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
				message: "Unauthorized1",
				status: false
			});
		}
	} else {
		done('200', {
			message: "Unauthorized2",
			status: false
		});
	}
};