var mongoose = require('mongoose');
var aws = require("aws-sdk");
var userModel = require('./UserModel.js');

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err !== '200' ? err.message ? err.message: JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });
    
    var connectorMongodb =  mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
    aws.config.update({ region: event.stageVariables['aws_region'] });
    const sender_email = event.stageVariables['sender_email'];

    switch (event.httpMethod) {
        case 'GET':
            console.log('Authenticate POST Called')
            context.callbackWaitsForEmptyEventLoop = false;
            
             console.log(event.queryStringParameters)
             const email = event.queryStringParameters['email'];
             const actCode = event.queryStringParameters['actCode'];
            
            const mdQuery = { 'email': { $regex: new RegExp("^" +email , "i") }, 'status':'inactive'};

              connectorMongodb.then(() => {
                  userModel.findOne(mdQuery, (err, doc) => {
                      if(doc && doc.activationString == actCode){
                          doc.activationString = null;
                          doc.status = 'active';
                          if (doc.tempPlan) {
                            doc.tempPlan = undefined;
                          }
                          doc.save();
                          
                          
                           const response = {
                            statusCode: 301,
                            headers: {
                              //Location: 'https://qa.storefries.com/login',
                              //Location: 'https://d11t8uau16i0n7.cloudfront.net/login',
                              Location: `${event.stageVariables['site_url']}`,
                            }
                          };
                          
                          console.log('start email')
                          
                          callback(null, response);
                          
                          //const htmlMailBody = `<html> <head> <style> ul#menu li { display:inline; text-decoration: underline;} </style> </head> <body style="width: 80%; text-align: justify; font-family: Arial; margin: auto; box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19); padding-top: 2%; padding-bottom: 2%;padding-right: 2%; padding-left: 2%;"> <div> <div> <a href="http://www.storefries.com/" style="display:inline-block" target="_blank"> <img src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/Storefries-logo.png" style="display:block;height:60px;width:160px"> </img> <a style="text-decoration:none;color:#3282C9;display:inline-block;border-top:14px solid #3282C9;border-right:40px solid #3282C9;border-bottom:14px solid #3282C9;border-left:40px solid #3282C9;font-size:16px;font-weight:600;color:#ffffff;background-color:#3282C9;float:right;" href="https://app.storefries.com/login" target="_blank"><span class="il">Log</span> In</a> </a> </div> </div> <div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center;"> <img src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/img1.png" style="width:75%"></img> </div> <div style="font-size:24px;line-height:48px;text-align: center;"> <b>Welcome to Storefries, ${doc.firstName}!</b> </div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Your free trail starts today.</div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Congratualtions on starting your journey with Storefries.</div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> We are excited you're here and can't wait to help you get started on your entreprenurial journey</div> <!--<div style="padding:20px 0 0 0;font-size:14px;line-height:24px;"> <a style="text-decoration:none;color:#3282C9;display:inline-block;border-top:14px solid #3282C9;border-right:40px solid #3282C9;border-bottom:14px solid #3282C9;border-left:40px solid #3282C9;font-size:16px;font-weight:600;color:#ffffff;background-color:#3282C9" href="https://app.storefries.com/confirm" target="_blank"><span class="il">Confirm</span> Account</a> </div>--> <div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center;"> <img src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/img4.png" style="width:75%"></img> </div> <div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center;"> <a href="https://app.storefries.com/login"><img src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/img3.png" style="width:75%"></img></a> </div> <div style="padding:20px 200px 0 200px;font-size:14px;line-height:24px;text-align: center;"> If you have any questions regarding your Storefries account, please contact us at <a href="" style="color:#2696eb;text-decoration:none" target="_blank">support@storefries.com</a> Our technical support team will assist you with anything you need. </div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Enjoy yourself, and welcome to Storefries. </div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Regards, </div> <div style="font-size:14px;line-height:24px;text-align: center;"> <b>STOREFRIES TEAM</b><br> </div> <div style="font-size:14px;line-height:24px;text-align: center;"> <a href="http://www.storefries.com/" style="color:#2696eb;text-decoration:none" target="_blank">www.storefries.com</a> </div> <div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center; background-color:#f6f6f6"> <b>Get tips and tutorial to help you build your profile</b> </div> <div style="padding:20px 0 20px 0;font-size:14px;line-height:24px;text-align: center;background-color:#f6f6f6"> <ul id="menu"> <li>Contact Us</li>&nbsp; &nbsp; &nbsp; &nbsp; <li>Guides</li>&nbsp; &nbsp; &nbsp; &nbsp; <li>Blogs</li>&nbsp; &nbsp; &nbsp; &nbsp; <li>Help Center</li>&nbsp; &nbsp; &nbsp; &nbsp; </ul> </div><div style="padding:20px 200px 0 200px;font-size:14px;line-height:24px;text-align: center;"> <a href="" style="display: inline-block; margin: 2px"><img height="35" src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/twitter.png" width="35"></a>&nbsp; &nbsp; <a href="" style="display: inline-block; margin: 2px"><img height="35" src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/instagram.png" width="35"></a>&nbsp; &nbsp; <a href="" style="display: inline-block; margin: 2px"><img height="35" src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/whatsapp.png" width="35"></a>&nbsp; &nbsp; <a href="" style="display: inline-block; margin: 2px"><img height="35" src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/youtube.png" width="35"></a>&nbsp; &nbsp; <div style="color: #999999 ;font-size: 12px; line-height: 16px; text-align: center; padding-left: 5%;"> This email was intended for ${doc.firstName}, because you requested for Storefries | <span style="font-family:arial,helvetica neue,helvetica,sans-serif;"> The links in this email will always direct to <a href="http://app.storefries.com" style="color:#3282c9; text-decoration:none;">https://app.storefries.com</a><br> © Aikyne Technology Pvt Ltd. </span> </div> </div> </body> </html>`;
                          const htmlMailBody = `<html> <head> <style>ul#menu li{display:inline; text-decoration: underline;}</style> </head> <body style="width: 80%; text-align: justify; font-family: Arial; margin: auto; box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19); padding-top: 2%; padding-bottom: 2%;padding-right: 2%; padding-left: 2%;"> <div> <div> <a href="http://www.storefries.com/" style="display:inline-block" target="_blank"> <img src="https://d21ji477fyr6w.cloudfront.net/emailasset/storefries_logo.png" style="display:block;height:60px;width:160px"> </img> <a style="text-decoration:none;color:#3282C9;display:inline-block;border-top:14px solid #3282C9;border-right:40px solid #3282C9;border-bottom:14px solid #3282C9;border-left:40px solid #3282C9;font-size:16px;font-weight:600;color:#ffffff;background-color:#3282C9;float:right;" href="https://app.storefries.com/login" target="_blank"><span class="il">Log</span> In</a> </a> </div></div><div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center;"> <img src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/img1.png" style="width:75%"></img> </div><div style="font-size:24px;line-height:48px;text-align: center;"> <b>Welcome to Storefries, ${doc.firstName}!</b> </div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Your free trail starts today.</div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Congratualtions on starting your journey with Storefries.</div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> We are excited you're here and can't wait to help you get started on your entreprenurial journey</div><div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center;"> <img src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/img4.png" style="width:75%"></img> </div><div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center;"> <a href="https://app.storefries.com/login" target="_blank"><img src="https://aikyne-mediafiles.s3.ap-south-1.amazonaws.com/email-images/img3.png" style="width:75%"></img></a> </div><div style="padding:20px 200px 0 200px;font-size:14px;line-height:24px;text-align: center;"> If you have any questions regarding your Storefries account, please contact us at <a href="mailto:support@storefries.com" style="color:#2696eb;text-decoration:none" target="_blank">support@storefries.com</a> Our technical support team will assist you with anything you need. </div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Enjoy yourself, and welcome to Storefries. </div><div style="padding:20px 0 0 0;font-size:14px;line-height:24px;text-align: center;"> Regards, </div><div style="font-size:14px;line-height:24px;text-align: center;"> <b>STOREFRIES TEAM</b><br></div><div style="font-size:14px;line-height:24px;text-align: center;"> <a href="http://www.storefries.com/" style="color:#2696eb;text-decoration:none" target="_blank">www.storefries.com</a> </div><div style="padding:20px 0 0 0;font-size:24px;line-height:48px; text-align: center; background-color:#f6f6f6"> <b>Get tips and tutorial to help you build your profile</b> </div><div style="padding:20px 0 20px 0;font-size:14px;line-height:24px;text-align: center;background-color:#f6f6f6"> <ul id="menu"> <a href="https://www.storefries.com/contactus.html" target="_blank">Contact Us</a> &nbsp; &nbsp; &nbsp; &nbsp; <a href="https://www.storefries.com/hc/helppage.html" target="_blank">Guides</a> &nbsp; &nbsp; &nbsp; &nbsp; <a href="https://www.storefries.com/customer.html" target="_blank">Blogs</a> &nbsp; &nbsp; &nbsp; &nbsp; <a href="https://www.storefries.com/hc/helpcenter.html" target="_blank">Help Center</a> &nbsp; &nbsp; &nbsp; &nbsp; </ul> </div><div style="padding:20px 200px 0 200px;font-size:14px;line-height:24px;text-align: center;"> <a href="https://twitter.com/Storefries1" style="display: inline-block; margin: 2px" target="_blank"><img height="35" src="https://d21ji477fyr6w.cloudfront.net/emailasset/Twitterlogo.png" width="35"></a>&nbsp; &nbsp; <a href="https://www.instagram.com/storefries/" style="display: inline-block; margin: 2px" target="_blank"><img height="35" src="https://d21ji477fyr6w.cloudfront.net/emailasset/instalogo.png" width="35"></a>&nbsp; &nbsp; <a href="https://www.facebook.com/Storefries-100521589230785" style="display: inline-block; margin: 2px" target="_blank"><img height="35" src="https://d21ji477fyr6w.cloudfront.net/emailasset/facebook.png" width="50"></a>&nbsp; &nbsp; <a href="https://www.linkedin.com/company/storefries/" style="display: inline-block; margin: 2px" target="_blank"><img height="35" src="https://d21ji477fyr6w.cloudfront.net/emailasset/Linkedinlogo.png" width="35"></a>&nbsp; &nbsp; <div style="color: #999999 ;font-size: 12px; line-height: 16px; text-align: center; padding-left: 5%;"> This email was intended for ${doc.firstName}, because you requested for Storefries | <span style="font-family:arial,helvetica neue,helvetica,sans-serif;"> The links in this email will always direct to <a href="http://app.storefries.com" style="color:#3282c9; text-decoration:none;" target="_blank">https://app.storefries.com</a><br>© Aikyne Technology Pvt Ltd. </span> </div></div></body></html>`;

                            var params = {
                                Destination: {
                                    ToAddresses: [email],
                                },
                                Message: {
                                    Body: {
                                        Html: {
                                            Data: htmlMailBody,
                                            Charset: "UTF-8"
                                        }
                                    },
                                    Subject: { Data: `${doc.firstName}, Welcome to Storefries` },
                                },
                                Source: sender_email,
                            };
                            console.log('start email1')
                            //var sendPromise = new aws.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
                            // console.log('end email')
                            // sendPromise.then(
                            //     function (data) {
                            //         console.log("Email sent successfully")
                            //         //done('200', { status: 'User inserted' })
                            //         callback(null, response);
                            //     }).catch( function (err) {
                            //             console.log("Email is sending failed")
                            //             //done(err, { status: 'Error in sending mail' });
                            //             callback(null, response);
                            //         });
                                    

                        /* axios.post(event.stageVariables['authTokenURL'], {
                                    id: doc.id,
                                    firstName: doc.firstName,
                                    lastName: doc.lastName,
                                    client_id:event.stageVariables['oauth_clientId'],
                                    client_secret:event.stageVariables['oauth_clientSecret'],
                                    audience:event.stageVariables['oauth_audience'],
                                    grant_type:"client_credentials"
                        }).then((res) => {
                            done(err, {
                                status:'Successfully authenticated',
                                token: res.data.access_token,
                                data: {
                                    id: doc.id,
                                    firstName: doc.firstName,
                                    lastName: doc.lastName,
                                    email: body.username,
                                    changePassword: doc.changePassword,
                                    //res: res.data
                                }
                            });
                        })
                        .catch((error) => {
                            console.error(error);
                            done(error, {
                                status:'HTTP call failed',
                             });
                        })*/
                     
                    
                       
                      } else {
                          const response = {
                            statusCode: 301,
                            headers: {
                              //Location: 'https://qa.storefries.com/login',
                              //Location: 'https://d11t8uau16i0n7.cloudfront.net/login',
                              Location: `${event.stageVariables['site_url']}`,
                            }
                          }
                          callback(null, response);
                          /*done('400', {
                                    status:'Invalid Activation attempt',
                            });*/
                    }
                  })
            },
            (err) => { console.log('Connection Error'); });
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
