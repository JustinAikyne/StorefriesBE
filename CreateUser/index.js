var mongoose = require('mongoose');
var ObjectId = require('mongoose').Types.ObjectId;
var bcrypt = require('bcryptjs');
var aws = require("aws-sdk");
var userModel = require('./userModel.js');
var workspaceModel = require('./workspaceModel.js');
var planModel = require('./plansModel.js');
var deletedUsers = require('./deletedUsers.js');
var subscriptionModel = require('./subscriptionModel.js');
var chargebee = require("chargebee");
var axios = require('axios')
const Joi = require('joi');
var ipInfo = require("ip-info-finder");


// Set the region 

exports.handler = (event, context, callback) => {

    console.log('Received event:', JSON.stringify(event));
    chargebee.configure({
        site: event.stageVariables['chargebee_site'],
        api_key: event.stageVariables['chargebee_api_key']
    });
    /* chargebee.configure({
        site: "storefries-test",
        api_key: "test_xM2e2ia5BpizgyKcqISEg9CJScWLwcucU"
    }); */

    const done = (err, res) => callback(null, {
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

    try {
        var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
    } catch (error) {
        done('404', {
            message: "connection error",
            status: false
        });
    }

    //var connectorMongodb = mongoose.connect('mongodb+srv://storefries:CH8U1ZXGyeILqFWy@storefries.76ocf.mongodb.net/SocialMediaPublisher', { useNewUrlParser: true, useUnifiedTopology: true });
    aws.config.update({ region: event.stageVariables['aws_region'] });
    const sender_email = event.stageVariables['sender_email'];
    const confirm_endPoint = event.stageVariables['confirm_endPoint'];
    //const lifetime_plan_enable = event.stageVariables['lifetime_plan_enable'];
    //const lifetime_plan_enable = "no";

    // aws.config.update({ region: "ap-south-1" });
    // const sender_email = "dev@aikyne.com";
    // const confirm_endPoint = "https://e9a45i8ip3.execute-api.ap-south-1.amazonaws.com/Dev/aikyne/";

    switch (event.httpMethod) {
        case 'POST':
            console.log('POST Called')
            context.callbackWaitsForEmptyEventLoop = false;
            var body = JSON.parse(event.body);
            //console.log("body", JSON.stringify(event))

            connectorMongodb.then(async () => {
                const schema = Joi.object({
                    email: Joi.string().email().required(),
                    password: Joi.string().pattern(new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')).required(),
                    firstName: Joi.string().required(),
                    lastName: Joi.string().required(),
                    planId: Joi.string().optional(),
                    userType: Joi.string().optional(),
                    phone: Joi.string().optional(),
                    location: Joi.object().optional(),
                    subscription: Joi.object().optional(),
                    workspaceName: Joi.string().required(),
                    workspaceLogo: Joi.string().optional()
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

                /* if (event.stageVariables['email_validation_check'] && event.stageVariables['email_validation_check'] == "yes") {
 
                    let validationUrl = `${event.stageVariables['email_validation_url']}${event.stageVariables['email_validation_api_key']}?email=${body.email}`;
                    let email_validation = await axios.get(validationUrl)
 
                    console.log("email_validation", JSON.stringify(email_validation.data));
 
                    if (email_validation.data && email_validation.data.disposable && email_validation.data.disposable !== false
                        && email_validation.data.is_reachable !== "safe") {
 
                        done('422', {
                            message: "Enter Valid Email"
                        });
                        return
                    }
                } */

                if (event.stageVariables['email_validation_check'] && event.stageVariables['email_validation_check'] == "yes") {

                    let validationUrl = `${event.stageVariables['email_validation_url']}${event.stageVariables['email_validation_api_key']}&email=${body.email}&ip_address=`;
                    console.log("validationUrl....", validationUrl)
                    try {
                        let email_validation = await axios.get(validationUrl)
                        console.log("email_validation", JSON.stringify(email_validation.data));
                        if(email_validation.data && email_validation.data.smtp_provider && email_validation.data.smtp_provider !== "google"){
                            if (email_validation && email_validation.data && email_validation.data.status && email_validation.data.status !== 'valid') {    
                                done('422', {
                                    message: "Enter Valid Email"
                                });
                                return
                            }
                        }
                    } catch (error) {
                        console.log("Email validation api not working")
                    }
                }
                const mdQuery = { 'email': { $regex: new RegExp("^" + body.email, "i") } };

                let deletedUserCount = await deletedUsers.countDocuments(mdQuery)
                console.log("deletedUserCount", deletedUserCount)
                if (deletedUserCount == 0) {
                    let userCount = await userModel.countDocuments(mdQuery);
                    let workspaceCount = await workspaceModel.countDocuments({'workspaceName': { $regex: new RegExp("^" + body.workspaceName, "i")}});
                    if(workspaceCount > 0){
                        done('409', {
                            status: false,
                            message: "Workspace name already exist, try different name."
                        });
                        return
                    }
                    if (userCount === 0) {
                        let subscriptionCount = await subscriptionModel.countDocuments(mdQuery)
                        if (subscriptionCount === 0) {
                            if (body.userType == 'social') {
                                body.password = null;
                            } else {
                                var salt = bcrypt.genSaltSync(10);
                                var hash = bcrypt.hashSync(body.password, salt);
                                body.password = hash;
                            }
                            body.email = body.email.toLowerCase()
                            var user = new userModel(body);
                            user.status = 'inactive'
                            const actString = getRandomString(10);
                            user.activationString = actString
                            if (body.lng) {
                                user.location.lng = body.lng;
                            }
                            if (body.lat) {
                                user.location.lat = body.lat;
                            }
                            if (body.formatted_address) {
                                user.formatted_address = body.formatted_address;
                            }
                            //try {

                                let customer = {}
                                let subscription = {}
                                let subscriptionData = null;
                                let planId = '';
                                if (body.planId === (null || undefined) || body.planId) {
                                    if (body.planId === (null || undefined)) {
                                        body.planId = "FreePlan-USD-Yearly"
                                        planId = "FreePlan-USD-Yearly"
                                    } else {
                                        planId = body.planId
                                        /* if (planId.includes('Lifetimeplan') && lifetime_plan_enable == 'no') {
                                            console.log("lifetime_plan_enable........................")
                                            done('200', {
                                                message: 'Plan Not Applicable.',
                                                status: false
                                            });
                                            return;
                                        } */
                                    }

                                    user.ipInfo = {};
                                    let currency = 'USD';
                                    if (event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp) {
                                        let ip_address = event.requestContext.identity.sourceIp;
                                        //let ip_address = "117.214.92.208";
                                        //await ipInfo.getIPInfo(ip_address).then(data => {
                                        let ipUrl = `https://ipapi.co/${ip_address}/json/`;
                                        await axios.get(ipUrl).then(async (ipRes) => {
                                            console.log("data............", JSON.stringify(ipRes.data))

                                            user.ipInfo = ipRes.data;
                                            user.ipInfo.zip = ipRes.data.postal;
                                            user.ipInfo.regionName = ipRes.data.region;
                                            user.ipInfo.country = ipRes.data.country_name;
                                            user.ipInfo.countryCode = ipRes.data.country_code;
                                            user.ipInfo.lat = ipRes.data.latitude;
                                            user.ipInfo.lon = ipRes.data.longitude;
                                            user.ipInfo.ip_address = ip_address;

                                            // user.ipInfo = data;
                                            // user.ipInfo.ip_address = ip_address;
                                            if (ipRes.data.currency) {
                                                currency = ipRes.data.currency;
                                            }
                                            /* let splitPlan = planId.split('-');
                                            splitPlan[1] = currency;
                                            planId = splitPlan.join('-') */
                                            if (currency != 'USD') {
                                                planId = planId.replace('USD', currency);
                                            }
                                        }).catch(err=>{
                                            console.log("err.....ipinfo login.......",err)
                                        })
                                    }

                                    console.log("planId...........",planId)

                                    var planData = await planModel.findOne({ 'planId': planId })
                                    console.log("planData.........", JSON.stringify(planData))

                                    if (!planData || !planData.planId) {
                                        done('200', {
                                            message: 'Plan not available.',
                                            planId: body.planId,
                                            status: false
                                        });
                                        return;
                                    }

                                    //if (planData) {

                                    let customerData = {}
                                    if (body.firstName) {
                                        customerData.first_name = body.firstName;
                                    }
                                    if (body.lastName) {
                                        customerData.last_name = body.lastName;
                                    }
                                    customerData.email = body.email;
                                    customerData.locale = "en-IN";

                                    customer = await chargebee.customer.create(customerData).request();

                                    let subscription_items = [
                                        {
                                            item_price_id: planData.planId,
                                            unit_price: planData.price,
                                            quantity: 1
                                        }
                                    ]
                                    if (customer && customer.customer && customer.customer.id) {
                                        //if (planData && ((planData.trial_period && planData.trial_period_unit) || (body.planId == "FreePlan-USD-Yearly"))) {
                                        if ((planData && planData.trial_period && planData.trial_period_unit) || (planData && planData.itemId == "Free")) {
                                            let subscriptionData = await chargebee.subscription.create_with_items(customer.customer.id, { subscription_items }).request();
                                            subscription = subscriptionData.subscription;
                                            if (subscription && subscription.id) {
                                                var subsModel = new subscriptionModel(subscription);
                                                subsModel.email = body.email;
                                                subsModel.planId = planData.planId;
                                                if (planData.planName) {
                                                    subsModel.planName = planData.planName;
                                                }
                                                if (planData.externalName) {
                                                    subsModel.customerPlanName = planData.externalName;
                                                }
                                                subsModel.subscriptionId = subscription.id;
                                                subsModel.save();
                                                user.features = planData.features;
                                                user.features.currentSocialChannel = 0;
                                                user.features.currentUploadSize = 0;
                                                user.features.currentSchedulePostCount = 0;
                                                user.features.currentRssFeedCount = 0;
                                                user.features.currentPostCount = 0;
                                                user.features.currentDraftPostCount = 0;
                                            } else {
                                                done('400', {
                                                    message: 'Subscription creation failed'
                                                });
                                                return;
                                            }
                                        } else {
                                            if (planData.type === "charge") {

                                                let hosted_request = {
                                                    customer: {
                                                        id: customer.customer.id
                                                    },
                                                    item_prices: [
                                                        {
                                                            item_price_id: planData.planId,
                                                            unit_price: planData.price
                                                        }],
                                                        currency_code: planData.currency_code
                                                    //redirect_url: event.stageVariables['site_url'],
                                                    //cancel_url: event.stageVariables['site_url']
                                                    //redirect_url: "https://dg94t44146fd3.cloudfront.net/"
                                                }

                                                console.log("hosted_request",JSON.stringify(hosted_request))
                                                
                                                let hostedResult = await chargebee.hosted_page.checkout_one_time_for_items(hosted_request).request();
                                                if (hostedResult) {
                                                    console.log("hostedResult",JSON.stringify(hostedResult))
                                                    subscriptionData = hostedResult.hosted_page;
                                                }
                                            } else {
                                                let hosted_request = {
                                                    customer: {
                                                        id: customer.customer.id
                                                    },
                                                    subscription_items: [
                                                        {
                                                            item_price_id: planData.planId,
                                                            quantity: 1,
                                                            unit_price: planData.price
                                                        }],
                                                    //redirect_url: event.stageVariables['site_url'],
                                                    //cancel_url: event.stageVariables['site_url']
                                                    //redirect_url: "https://dg94t44146fd3.cloudfront.net/"
                                                }

                                                let hostedResult = await chargebee.hosted_page.checkout_new_for_items(hosted_request).request();
                                                if (hostedResult) {
                                                    subscriptionData = hostedResult.hosted_page;
                                                }
                                            }
                                        }
                                    } else {
                                        done('400', {
                                            message: 'Customer creation failed'
                                        });
                                        return;
                                    }
                                    //}
                                }


                                let workspace = new workspaceModel();

                                workspace.workspaceName = body.workspaceName.toLowerCase();
                                workspace.workspaceDisplayName = body.workspaceName;
                                workspace.superAdmin = body.email.toLowerCase();
                                if(body.workspaceLogo){
                                    workspace.workspaceLogo = body.workspaceLogo;
                                }
                                let workspaceData = await workspace.save();

                                user.workspaceIds.push(workspaceData._id);
                                user.role = "superAdmin";

                                user.save(async (err, docs) =>{
                                    let members = [];
                                    members.push({
                                        userId: docs._id,
                                        role: "superAdmin",
                                        email: docs.email,
                                        status: "added"
                                    })
                                    console.log("workspaceData........",JSON.stringify(workspaceData));
                                    console.log("members........",JSON.stringify(members));
                                    let updateWorkspace = await workspaceModel.updateOne({_id: new ObjectId(workspaceData._id)},{$set: {users : members}});
                                    // send email

                                    console.log("updateWorkspace",JSON.stringify(updateWorkspace));

                                    //const emailLink = `https://e9a45i8ip3.execute-api.ap-south-1.amazonaws.com/Dev/aikyne/confirmEmail?email=${body.email}&actCode=${actString}`;
                                    const emailLink = `${confirm_endPoint}confirmEmail?email=${body.email}&actCode=${actString}`;
                                    const mailBody = `Hello ${body.firstName}, Kindly click on the following link to activate your storefries.com account. `

                                    const htmlMailBody = `<html> <head></head> <body style="width: 80%; text-align: justify; margin: auto; box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19); padding-top: 2%; padding-bottom: 2%;padding-right: 2%; padding-left: 2%;"> <div> <div><a href="http://www.storefries.com/" style="display:inline-block" target="_blank"><img src="https://d21ji477fyr6w.cloudfront.net/emailasset/storefries_logo.png" style="display:block;height:60px;width:160px"></img></a></div></div><div style="padding:20px 0 0 0;font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>Dear ${body.firstName},</b></div><div style="font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>We're super happy to have you onboard!</b></div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">To start your Social Media Marketing journey with Storefries please confirm your email with this Confirm Account button: <br><br></div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><a style="text-decoration:none;color:#3282C9;display:inline-block;border-top:14px solid #3282C9;border-right:40px solid #3282C9;border-bottom:14px solid #3282C9;border-left:40px solid #3282C9;font-size:16px;font-weight:600;font-family:'Open Sans','Trebuchet MS',sans-serif;color:#ffffff;background-color:#3282C9" href="${emailLink}" target="_blank"><span class="il">Confirm</span> Account</a></div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">If you have any questions regarding your Storefries account, Please contact us at <a href="mailto:support@storefries.com" style="color:#2696eb;text-decoration:none" target="_blank">support@storefries.com</a>. Our technical support team will assist you with anything you need. </div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">Enjoy yourself, and welcome to Storefries. </div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">Regards,</div><div style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>Storefries Team</b><br></div><div style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><a href="http://www.storefries.com/" style="color:#2696eb;text-decoration:none" target="_blank">www.storefries.com</a></div><div style="border-bottom:3px solid #3282C9"></div><br>This email is generated from storefries with your request of account activation. Please add us to your address Book or Whitlist us <a href="mailto:support@storefries.com" style="color:#0091ff;text-decoration:none" target="_blank">support@storefries.com</a>.</div></body></html>`;

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
                                    done('201', {
                                        status: 'User inserted',
                                        data: {
                                            id: docs.id,
                                            firstName: docs.firstName,
                                            lastName: docs.lastName,
                                            email: body.email,
                                            subscriptionHostedData: subscriptionData
                                            //res: res.data
                                        }
                                    })

                                    // var sendPromise = new aws.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
                                    // sendPromise.then(
                                    //     function (data) {
                                    //         done('201', {
                                    //             status: 'User inserted',
                                    //             data: {
                                    //                 id: docs.id,
                                    //                 firstName: docs.firstName,
                                    //                 lastName: docs.lastName,
                                    //                 email: body.email,
                                    //                 subscriptionHostedData: subscriptionData
                                    //                 //res: res.data
                                    //             }
                                    //         })
                                    //     }).catch(
                                    //         function (err) {
                                    //             console.error(err, err.stack);
                                    //             done('422', {
                                    //                 status: 'Error in sending mail'
                                    //             });
                                    //         });
                                });

                            /* } catch (error) {
                                done('401', {
                                    message: error.message
                                });
                            } */
                        } else {
                            done('409', {
                                message: 'User Account already Subscribed'
                            });
                        }
                    } else {
                        done('409', {
                            status: 'User already exists',
                            data: body
                        });
                    }
                } else {
                    done('401', {
                        message: 'User Account has been deleted, please contact support team to Reregister'
                    });
                }
            }).catch(err => {
                console.log('Connection Error');
                done('501', {
                    message: err.message
                });
            })
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
