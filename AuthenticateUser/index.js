var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var axios = require('axios')
//const Joi = require("joi");
var subscriptionModel = require('./subscriptionModel.js');
var workspaceModel = require('./workspaceModel.js');
var userModel = require('./userModel.js');
var socialModel = require('./SocialModel.js');
var onBoarding = require('./onBoarding.js');
var aws = require("aws-sdk");

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? err : '400',
        body: err ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
    aws.config.update({ region: event.stageVariables['aws_region'] });
    const notification_email = event.stageVariables['notification_email'];

    switch (event.httpMethod) {
        case 'POST':
            console.log('Authenticate POST Called')
            context.callbackWaitsForEmptyEventLoop = false;
            var body = JSON.parse(event.body);

            const mdQuery = { 'email': { $regex: new RegExp("^" + body.username, "i") } };

            connectorMongodb.then(() => {
                userModel.findOne(mdQuery, async (err, doc) => {
                    console.log("doc..............", JSON.stringify(doc))
                    if (!doc) {
                        done('404', {
                            status: 'No account exists with your provided email address.'
                        });
                        return;
                    }
                    if (doc && doc.userType && doc.userType == 'social') {
                        if (doc.socialLogin && doc.socialLogin == 'google') {
                            done('401', {
                                status: 'User registered with Google Account'
                            });
                            return;
                        } else if (doc.socialLogin && doc.socialLogin == 'facebook') {
                            done('401', {
                                status: 'User registered with Facebook Account'
                            });
                            return;
                        } else {
                            done('401', {
                                status: 'User registered with Social Account'
                            });
                            return;
                        }
                    } else {
                        if (!body.username) {
                            done('422', {
                                message: 'Username is required'
                            });
                            return;
                        }
                        try {
                            body.email = body.username;
                            // let subscriptionData = await subscriptionModel.countDocuments(mdQuery);
                            // if (subscriptionData == 0) {
                            //     done('402', {
                            //         status: 'You are not made subscription yet',
                            //         subscriptionStatus: false
                            //     });
                            //     return;
                            // }
                            //if (doc && doc.status && doc.status == 'active') {
                            if (doc && doc.status) {
                                if (doc && doc.password !== null && bcrypt.compareSync(body.password, doc.password)) {

                                    let onBoardStatus = false;
                                    let workspaceAvailable = true;
                                    let expiredSM = [];
                                    let promiseArr = [];

                                    let ip_address = event.requestContext.identity.sourceIp;
                                    //let ip_address = "27.5.182.192";

                                    const getOnboard = async () => {
                                        return new Promise(async (resolve, reject) => {
                                            try {
                                                let onBoardingCount = await onBoarding.countDocuments({ 'email': { $regex: new RegExp("^" + body.username, "i") } })
                                                if (onBoardingCount > 0) {
                                                    onBoardStatus = true;
                                                }
                                                resolve({ status: true, count: onBoardingCount })
                                            } catch (error) {
                                                resolve({ status: false, count: 0 })
                                            }
                                        })
                                    }

                                    const getWorkspace = async () => {
                                        return new Promise(async (resolve, reject) => {
                                            try {
                                                let workspaceQry = [
                                                    { "$match": { 'email': { $regex: new RegExp("^" + body.username, "i") } } },
                                                    {
                                                        "$lookup": {
                                                            "from": "workspaces", "let": { "userId": "$_id" }, pipeline: [{ "$match": { "$expr": { "$in": ["$$userId", "$users.userId"] } }, }], as: "workspace"
                                                        }
                                                    },
                                                    { "$unwind": { path: "$workspace", preserveNullAndEmptyArrays: false } },
                                                    { "$project": { "_id": "$_id", "workspaceId": "$workspace._id", "members": "$workspace.users" } }
                                                ];

                                                let userWorkspace = await userModel.aggregate(workspaceQry);
                                                if (userWorkspace.length < 1) {
                                                    workspaceAvailable = false;
                                                }
                                                resolve({ status: true, workspaceAvailable: workspaceAvailable })

                                            } catch (error) {
                                                resolve({ status: false, workspaceAvailable: false })
                                            }
                                        })
                                    }

                                    const getSocialMedia = async () => {
                                        return new Promise(async (resolve, reject) => {
                                            //try {

                                            let smQry = [];
                                            smQry.push(
                                                { "$match": { 'email': { $regex: new RegExp("^" + body.username, "i") } } },
                                                { "$unwind": { path: "$socialMedia", preserveNullAndEmptyArrays: false } },
                                                { "$unwind": { path: "$socialMedia.fbpages", preserveNullAndEmptyArrays: true } },
                                                { "$unwind": { path: "$socialMedia.linkedinPages", preserveNullAndEmptyArrays: true } },
                                                {
                                                    "$project": {
                                                        "_id": "$_id", "email": "$email", "userId": "$socialMedia.userId", "name": "$socialMedia.name", "oauth_token": "$socialMedia.oauth_token",
                                                        "oauth_token_secret": "$socialMedia.oauth_token_secret", "locationEnable": "$socialMedia.locationEnable", "screenName": "$socialMedia.screenName",
                                                        "channel_name": "$socialMedia.channel_name", "token_expiry": "$socialMedia.token_expiry", "token_validity": "$socialMedia.token_validity",
                                                        "userProfileImage": "$socialMedia.userProfileImage", "fbpages": "$socialMedia.fbpages", "linkedinPages": "$socialMedia.linkedinPages",
                                                        "linkedinProfile": "$socialMedia.linkedinProfile"
                                                    }
                                                },
                                                { "$unwind": { path: "$fbpages", preserveNullAndEmptyArrays: true } },
                                            );
                                            let socialMedia = await socialModel.aggregate(smQry);
                                            if (socialMedia.length > 0) {
                                                let dateNow = new Date().getTime();
                                                dateNow = dateNow / 1000;

                                                socialMedia.forEach(sm => {
                                                    if ((sm.token_expiry && sm.token_expiry <= dateNow && sm.name != 'googlemybusiness' && sm.name != 'youtube' && sm.name != 'twitter')) {
                                                        let smObj = {};
                                                        smObj.socialMedia = sm.name;
                                                        smObj.userProfileImage = sm?.userProfileImage ?? '';
                                                        smObj.userId = sm.userId;
                                                        smObj.name = sm?.screenName ?? '';
                                                        smObj.status = 'expried';
                                                        if (sm.name === 'facebook' && sm?.fbpages?.id) {
                                                            smObj.name = sm.fbpages.name;
                                                            smObj.type = sm.fbpages.type;
                                                            smObj.pageId = sm.fbpages.id;
                                                            smObj.userProfileImage = sm.fbpages.image;
                                                            expiredSM.push(smObj);
                                                        }
                                                        else if (sm.name === 'linkedin' && sm?.linkedinPages?.pageId) {
                                                            if (sm.name === 'linkedin' && sm?.linkedinProfile?.userId) {
                                                                let smObj1 = {}
                                                                smObj1.name = sm.linkedinProfile.userName;
                                                                smObj1.userId = sm.userId;
                                                                smObj1.socialMedia = sm.name;
                                                                smObj1.type = 'profile';
                                                                smObj1.status = 'expried';
                                                                smObj1.userProfileImage = sm?.linkedinProfile?.userImage ?? '';
                                                                if (expiredSM.some(el => el.userId === sm.userId) === false) {
                                                                    expiredSM.push(smObj1);
                                                                }
                                                            }
                                                            smObj.name = sm.linkedinPages.pageName;
                                                            smObj.type = 'page';
                                                            smObj.pageId = sm.linkedinPages.pageId;
                                                            smObj.userProfileImage = sm?.linkedinPages?.pageImage ?? '';
                                                            expiredSM.push(smObj);
                                                        } else if (sm.name === 'linkedin' && sm?.linkedinProfile?.userId) {
                                                            //let smObj1 = {}
                                                            smObj.name = sm.linkedinProfile.userName;
                                                            smObj.type = 'profile';
                                                            smObj.userProfileImage = sm?.linkedinProfile?.userImage;
                                                            if (expiredSM.some(el => el.userId === sm.userId) === false) {
                                                                expiredSM.push(smObj);
                                                            }
                                                        }
                                                        else {
                                                            expiredSM.push(smObj);
                                                        }
                                                    }
                                                });
                                            }
                                            resolve({ status: true, expiredSM: expiredSM })

                                            /*  } catch (error) {
                                                 console.log("error",JSON.stringify(error))
                                                 resolve({ status: false, expiredSM: expiredSM })
                                             } */
                                        })
                                    }

                                    const getIpinfo = async () => {
                                        return new Promise(async (resolve, reject) => {
                                            

                                            //await ipInfo.getIPInfo(ip_address).then(async (data) => {
                                            let ipUrl = `https://ipapi.co/${ip_address}/json/`
                                            axios.get(ipUrl).then(async (ipRes) => {
                                                console.log("data............", JSON.stringify(ipRes.data))
                                                resolve({ status: true, data: ipRes.data })
                                            }).catch(err => {
                                                console.log("err.................", JSON.stringify(err))
                                                resolve({ status: false })
                                            })
                                        })
                                    }

                                    promiseArr.push(getOnboard());
                                    promiseArr.push(getWorkspace());
                                    //promiseArr.push(getSocialMedia());
                                    if (event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp) {
                                        promiseArr.push(getIpinfo());
                                    }

                                    Promise.all(promiseArr).then((result) => {

                                        axios.post(event.stageVariables['authTokenURL'], {
                                            id: doc.id,
                                            firstName: doc.firstName,
                                            lastName: doc.lastName,
                                            client_id: event.stageVariables['oauth_clientId'],
                                            client_secret: event.stageVariables['oauth_clientSecret'],
                                            audience: event.stageVariables['oauth_audience'],
                                            grant_type: "client_credentials"
                                        }).then(async (res) => {

                                            console.log("result", JSON.stringify(result))

                                            const sendmail = async () => {
                                                return new Promise(async (resolve, reject) => {
                                                    try {
                                                        //const htmlMailBody = `<html> <head></head> <body style="width: 80%; text-align: justify; margin: auto; box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19); padding-top: 2%; padding-bottom: 2%;padding-right: 2%; padding-left: 2%;"> <div> <div style="padding:20px 0 0 0;font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"></div><div style="font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>Login Alert!</b></div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">You are loggedin with different location. If not you Kindly contact support team. <br><br><b>Storefries Team</b><br></div><div style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><a href="http://www.storefries.com/" style="color:#2696eb;text-decoration:none" target="_blank">www.storefries.com</a></div><div style="border-bottom:3px solid #3282C9"></div><div style="padding:10px 0 10px 0;font-size:12px;color:#333333;line-height:22px;font-family:'Open Sans','Trebuchet MS',sans-serif">Aikyne Technology, #4, 3rd floor, Akshaya HQ, Kazhipattur, Padur, Chennai - 603103, INDIA.<br>Phone : 9999999999 Fax: 9999999999<br>This e-mail is generated from Storefries. If you think this is SPAM, please report to <a href="mailto:support@aikyne.com" style="color:#0091ff;text-decoration:none" target="_blank">support@aikyne.com</a> for immediate action.</div></body></html>`;
                                                        //const htmlMailBody = `<html> <head> <link href="css/bootstrap.min.css" rel="stylesheet" type="text/css"/> <style>.content{width: 25%; height: 50vh; margin-left: auto; margin-right: auto; border: solid 1px #dadce0; margin-top: 100px; border-radius: 10px;}.center{text-align: center; margin-top: 30px;}.center img{width: 100px; height: 60px;}.center .head{margin-top: 10px;font-size: 24px;font-weight: 400;}hr{width: 90%; margin: auto;}.button{background-color: #4184f3; border: none; color: white; padding: 8px 32px; text-align: center; text-decoration: none; display: inline-block; font-size: 16px; margin: 4px 2px; cursor: pointer; width: 180px; border-radius: 5px; height: 40px;}.bottom{text-align: center; margin-top: 10px; margin-left: auto; margin-right: auto; width: 25%;}</style> </head><body> <div class=""> <div class="content"> <div class="center"> <img src="https://d21ji477fyr6w.cloudfront.net/asset/Storefries_logo.png" ><br><p class="head"> New sign-in to your linked account</p><p>${body.email}</p><hr><br><p>We noticed a new sing-in to your google account on a windows device. if this was you, you dont't need to do anything.if not, we'll help you secure your account </p><br><a role="button" class="button" href="https://app.storefries.com/EarlySignup" target="_blank">Check activity</a><br><br><small>You can also see security activity at <br>https://myaccount.google.com/notifications</small> </div></div><div class="bottom"> <small>This email was intended for Justin, because you requested for Storefries | The links in this email will always direct to http://app.storefries.com?? Storefries inc </small> </div></div></body></html>`;
                                                        const htmlMailBody = `<html> <head> <style>.head{text-align: center; font-size: 24px; font-weight: 400;}.button{background-color: #4CAF50; border: none; color: blue; padding: 15px 32px; text-align: center; text-decoration: none; font-size: 16px; cursor: pointer; border-radius: 10px; height: 15px;}</style> </head> <body> <div style="box-shadow: 0 4px 8px 0; width: 50%;margin:auto;"> <div style="padding: 0px 15px 0px 15px;"> <div style="padding: 40px 40px 0px 40px;"> <div class="row"> <div class="col"> <a href="http://storefries.com" target="_blank"> <img src="https://d21ji477fyr6w.cloudfront.net/emailasset/storefries_logo.png" width="150" style="vertical-align: middle;"></img></a> </div><div class="col"> <div class="user-name" style="float: right;"> </div></div></div></div><div style="font: 16px/22px 'Helvetica Neue', Arial, 'sans-serif'; line-height: 28px; vertical-align: top; padding: 50px 40px 0px 40px;"> </div><p class="head"> New sign-in to your linked account</p><p style="text-align: center;">${body.email}</p><div height="1" style="padding:20px 40px 5px;" valign="top"> <div style="border-top:1px solid #e4e4e4;"></div></div><div style="font: 16px/22px 'Helvetica Neue', Arial, 'sans-serif';text-align: left;color: #888888;padding: 40px 40px 0px 40px;"> <span style="font-size: 14px; line-height: 22px; color: #62646A; font-weight: 500; border-radius: 3px; background-color: #F5F5F5;"> <div> <p>We noticed a new sign-in to your storefries account on a windows device. If this was you, you don't need to do anything. If not, we'll help you secure your account. </p><br><a role="button" type="button" class="button" target="_blank" href="https://app.storefries.com/login" style="text-align: center; color:white">Check activity</a> </div><div style="font-weight: 500"> <div style="background:none; height:20px;"></div><div>Thanks,<br><span style="font-weight: 500; color: #222325">The Storefries Team. </span></div></div></span> </div><div valign="top" height="45"></div></div><div style="padding: 20px 0px;"> <div style="width: 100%; margin: auto;"> <div> <div style="width: 600px; margin: auto;"> <div style="text-align: center; padding:10px 10px 10px 10px;"><a href="https://twitter.com/Storefries1" style="display: inline-block; margin: 2px" target="_blank"> <img height="40" src="https://d21ji477fyr6w.cloudfront.net/emailasset/Twitterlogo.png" width="40"></a><a href="https://www.facebook.com/Storefries-100521589230785" style="display: inline-block; margin: 2px" target="_blank"><img height="40" src="https://d21ji477fyr6w.cloudfront.net/emailasset/facebook.png" width="50"></a> <a href="https://www.linkedin.com/company/storefries/" style="display: inline-block; margin: 2px" target="_blank"><img height="40" src="https://d21ji477fyr6w.cloudfront.net/emailasset/Linkedinlogo.png" width="40"></a><a href="https://www.instagram.com/storefries/" style="display: inline-block; margin: 2px" target="_blank"><img height="40" src="https://d21ji477fyr6w.cloudfront.net/emailasset/instalogo.png" width="40"></a></div><div style="color: #999999 ;font-size: 12px; line-height: 16px; text-align: center; padding-left: 5%;">This email was intended for ${doc.firstName}, because you requested for Storefries | <span style="font-family:arial,helvetica neue,helvetica,sans-serif;">The links in this email will always direct to <a href="http://app.storefries.com" style="color:#3282c9; text-decoration:none;">http://app.storefries.com</a> <br>?? storefries</span></div><div style="text-align: center; padding:10px 10px 20px 10px;"> </a></div></div></div></div></div></div></body></html>`;
                                                        var params = {
                                                            Destination: { ToAddresses: [body.email], },
                                                            Message: { Body: { Html: { Data: htmlMailBody, Charset: "UTF-8" } }, Subject: { Data: "Alert : Login location!" } },
                                                            Source: notification_email,
                                                        };
                                                        var sendPromise = await new aws.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
                                                        resolve({ status: true })
                                                    } catch (error) {
                                                        resolve({ status: false })
                                                    }
                                                })
                                            }

                                            const updateUser = async (upData) => {
                                                return new Promise(async (resolve, reject) => {
                                                    userModel.findOneAndUpdate(mdQuery, { $set: upData }, { new: true }, (err, updatedDoc) => {
                                                        resolve({ status: true })
                                                    })
                                                })
                                            }

                                            let tokenExpiry = (res.data.expires_in * 1000) + new Date().getTime();
                                            const date = new Date();
                                            let updateData = {};
                                            updateData.lastLogin = date;

                                            let lastLoginIpInfo = {};
                                            let pArr = [];

                                            if (result?.[3] && result?.[3].status === true) {
                                                let ipRes = result?.[3];
                                                lastLoginIpInfo = ipRes.data;
                                                lastLoginIpInfo.zip = ipRes.data.postal;
                                                lastLoginIpInfo.regionName = ipRes.data.region;
                                                lastLoginIpInfo.country = ipRes.data.country_name;
                                                lastLoginIpInfo.countryCode = ipRes.data.country_code;
                                                lastLoginIpInfo.lat = ipRes.data.latitude;
                                                lastLoginIpInfo.lon = ipRes.data.longitude;
                                                lastLoginIpInfo.ip_address = ip_address;
                                                if (!doc.ipInfo || (doc.ipInfo && !doc.ipInfo.zip)) {
                                                    updateData.ipInfo = {};
                                                    updateData.ipInfo = lastLoginIpInfo;
                                                }

                                                if (event.requestContext.identity.sourceIp) {
                                                    updateData.lastLoginIpInfo = {};
                                                    updateData.lastLoginIpInfo = lastLoginIpInfo;
                                                }
                                                if (doc.ipInfo && doc.ipInfo.zip && ipRes.data.zip && (doc.ipInfo.zip != ipRes.data.zip)) {
                                                    console.log("email trigger............")
                                                    pArr.push(sendmail())
                                                }
                                            }
                                            console.log("...updateData..",JSON.stringify(updateData))

                                            pArr.push(updateUser(updateData))
                                            Promise.all(pArr).then((finalResult) => {
                                                done('200', {
                                                    status: 'Successfully authenticated',
                                                    token: 'Bearer ' + res.data.access_token,
                                                    tokenExpiry: tokenExpiry,
                                                    data: {
                                                        id: doc.id,
                                                        firstName: doc.firstName,
                                                        lastName: doc.lastName,
                                                        email: doc.email,
                                                        changePassword: doc.changePassword,
                                                        onBoarding: onBoardStatus,
                                                        workspaceAvailable: workspaceAvailable,
                                                        //expiredSocialMedia: expiredSM
                                                    }
                                                });
                                            }).catch(err => {
                                                done('200', {
                                                    status: 'Successfully authenticated',
                                                    token: 'Bearer ' + res.data.access_token,
                                                    tokenExpiry: tokenExpiry,
                                                    data: {
                                                        id: doc.id,
                                                        firstName: doc.firstName,
                                                        lastName: doc.lastName,
                                                        email: doc.email,
                                                        changePassword: doc.changePassword,
                                                        onBoarding: onBoardStatus,
                                                        workspaceAvailable: workspaceAvailable,
                                                        //expiredSocialMedia: expiredSM
                                                    }
                                                });
                                            });
                                            //await userModel.findOneAndUpdate(mdQuery, { $set: updateData }, { new: true }, (err, updatedDoc) => { });

                                        }).catch((error) => {
                                            console.log("error", error);
                                            done('400', {
                                                status: 'HTTP call failed',
                                            });
                                        })
                                    }).catch(err => {
                                        done('400', {
                                            status: 'HTTP call failed',
                                        });
                                    })

                                } else {
                                    done('401', {
                                        status: 'Authentication failed'
                                    });
                                }

                            } else {
                                done('400', {
                                    status: 'You are not activated your profile'
                                });
                            }
                        } catch (error) {
                            done('401', {
                                message: error.message
                            });
                        }
                    }
                })
            },
                (err) => { console.log('Connection Error'); });
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
