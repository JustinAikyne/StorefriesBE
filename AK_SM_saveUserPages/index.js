var mongoose = require('mongoose');
var axios = require('axios');
var socialModel = require('./SocialModel.js');
var userModel = require('./userModel.js');

exports.handler = (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event));

  const done = (err, res) => callback(null, {
    statusCode: err ? err : '400',
    body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
  });


  var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });

  switch (event.httpMethod) {
    case 'POST':
      console.log('Facebook pages registration')
      context.callbackWaitsForEmptyEventLoop = false;
      if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
        event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;
        var body = JSON.parse(event.body);
        const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
        const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
        if (email && email !== '') {

          if (!body || !body.userId) {
            done('422', {
              status: false,
              message: "userId is required."
            });
            return;
          }
          if (!body.type) {
            done('422', {
              status: false,
              message: "type is required."
            });
            return;
          }
          if (!body.oauth_token) {
            done('422', {
              status: false,
              message: "oauth_token is required."
            });
            return;
          }
          if (!body.profiles || body.profiles.length < 1) {
            done('422', {
              status: false,
              message: "Atleast One profile need to be selected."
            });
            return;
          }

          body.profiles = body.profiles.flatMap(fbPro => {
            if (fbPro.selected === true) {
              return fbPro;
            }
            else {
              return [];
            }
          });

          if (body.profiles && body.profiles.length > 0) {

            connectorMongodb.then(() => {
              let userQuery = { 'email': { $regex: new RegExp("^" + email, "i") } }
              userModel.findOne(userQuery).exec(function (err, userDetails) {
                if (userDetails) {
                  //console.log("socialChannel", socialChannel)
                  console.log("userDetails.features", userDetails.features)
                  console.log("userDetails.features.totalSocialChannel", userDetails.features.totalSocialChannel)
                  //if ((userDetails.features && !userDetails.features.totalSocialChannel)) {
                  let sixty_days = 5184000;
                  const today = new Date().getTime();
                  let expiry_time = parseInt((today / 1000) + sixty_days).toFixed(0);
                  let token_expiry = parseInt(expiry_time);
                  let token_validity = true;
                  let currentSocialChannel = 0;
                  let mQry = { 'email': { $regex: new RegExp("^" + email, "i") } };
                  socialModel.findOne(mQry, async (err, doc) => {
                    console.log("err, doc",JSON.stringify(err), JSON.stringify(doc));

                    if (!doc || (doc && doc.socialMedia && doc.socialMedia.length == 0)) {
                      if (!doc) {
                        var socialDetails = new socialModel();
                        //let sm = socialDetails.socialMedia;
                        socialDetails.email = email;
                        socialDetails.socialMedia = [{
                          'name': 'facebook',
                          'oauth_token': body.oauth_token,
                          'userId': body.userId,
                          'token_expiry': token_expiry,
                          'token_validity': token_validity,
                          'fbpages': body.profiles
                        }];
                        await socialDetails.save();
                        
                      } else {
                        // let smEmail  = doc.email;
                        // smEmail = email;
                        let sm = doc.socialMedia;
                        let fbObj = {};
                        fbObj.userId = body.userId;
                        fbObj.name = 'facebook';
                        fbObj.oauth_token = body.oauth_token;
                        fbObj.token_expiry = token_expiry;
                        fbObj.token_validity = token_validity;
                        fbObj.fbpages = [];
                        fbObj.fbpages = body.profiles;
                        sm.push(fbObj);
                        await doc.save();                        
                      }

                      socialModel.findOne({ 'email': email }, async (err, docs) => {
                        docs.socialMedia.forEach(channel => {
                          if (channel.name == 'facebook' && channel.fbpages && channel.fbpages.length > 0) {
                            currentSocialChannel = currentSocialChannel + channel.fbpages.length;
                          }
                          if (channel.linkedinPages && channel.linkedinPages.length > 0) {
                            currentSocialChannel = currentSocialChannel + channel.linkedinPages.length;
                          }
                          if (channel.name == 'twitter' || channel.name == 'instagram' || channel.name == 'youtube' || channel.name == 'googlemybusiness') {
                            currentSocialChannel += 1;
                          }

                          if (channel.name == 'linkedin' && channel.linkedinProfile) {
                            currentSocialChannel += 1;
                          }
                        });
                        await userModel.findOneAndUpdate({ 'email': email }, { $set: { 'features.currentSocialChannel': currentSocialChannel } }, { new: true }, (err, updatedDoc) => { })
                        done('200', {
                          message: `Facebook ${body.type} integrated successfull`,
                          status: true
                        });
                      });
                    }
                    else {
                      let mdQuery = { 'email': { $regex: new RegExp("^" + email, "i") }, 'socialMedia.name': 'facebook', 'socialMedia.userId': body.userId };
                      socialModel.findOne(mdQuery, { socialMedia: { $elemMatch: { name: "facebook", userId: body.userId } } }).exec(async (err, fbDetails) => {
                        console.log("...............", JSON.stringify(err, fbDetails))
                        if (fbDetails) {
                          let sm = doc.socialMedia;
                          let acntExists = false;
                          for (var i = 0; i < sm.length; i++) {
                            if (sm[i].name == 'facebook' && sm[i].userId == body.userId) {
                              // this account already exists
                              acntExists = true;
                              let updatePage = [];
                              sm[i]['oauth_token'] = body.oauth_token;
                              sm[i]['token_expiry'] = token_expiry;
                              sm[i]['token_validity'] = token_validity;
                              //sm[i]['fbpages'] = [];

                              updatePage = body.profiles;
                              let fbIds = body.profiles.map(page => page.id);

                              /*body.profiles.forEach(fbProfile => {
                                console.log("fbProfile",JSON.stringify(fbProfile));
                                sm[i]['fbpages'].forEach(page => {
                                  if (fbProfile.id == page.id) {
                                    //page = fbProfile
                                    fbProfile = page;
                                  }
                                  if (body.type !== page.type) {
                                    fbProfile = page;
                                  }
                                });
                                console.log("fbProfile",JSON.stringify(fbProfile));
                                updatePage.push(fbProfile);
                              });*/
                              sm[i]['fbpages'].forEach(page => {
                                if (!fbIds.includes(page.id)) {
                                  updatePage.push(page);
                                }
                              });

                              console.log("updatePage", JSON.stringify(updatePage));

                              sm[i]['fbpages'] = updatePage;
                              //sm[i]['fbpages'] = body.profiles;
                            }
                          }
                          await doc.save();
                        }
                        else {
                          let sm = doc.socialMedia;
                          let fbObj = {};
                          fbObj.userId = body.userId;
                          fbObj.name = 'facebook';
                          fbObj.oauth_token = body.oauth_token;
                          fbObj.token_expiry = token_expiry;
                          fbObj.token_validity = token_validity;
                          fbObj.fbpages = [];
                          fbObj.fbpages = body.profiles;
                          sm.push(fbObj);
                          await doc.save();
                        }

                        socialModel.findOne({ 'email': email }, async (err, docs) => {
                          docs.socialMedia.forEach(channel => {
                            if (channel.name == 'facebook' && channel.fbpages && channel.fbpages.length > 0) {
                              currentSocialChannel = currentSocialChannel + channel.fbpages.length;
                            }
                            if (channel.linkedinPages && channel.linkedinPages.length > 0) {
                              currentSocialChannel = currentSocialChannel + channel.linkedinPages.length;
                            }
                            if (channel.name == 'twitter' || channel.name == 'instagram' || channel.name == 'youtube' || channel.name == 'googlemybusiness') {
                              currentSocialChannel += 1;
                            }

                            if (channel.name == 'linkedin' && channel.linkedinProfile) {
                              currentSocialChannel += 1;
                            }
                          });
                          await userModel.findOneAndUpdate({ 'email': email }, { $set: { 'features.currentSocialChannel': currentSocialChannel } }, { new: true }, (err, updatedDoc) => { })
                          done('200', {
                            message: `Facebook ${body.type} integrated successfull`,
                            status: true
                          });
                        });
                      })
                    }
                  })
                  /* } else {
                    done('405', {
                      message: `You can add ${userDetails.features.totalSocialChannel} Social Channel Only, If you want to add more Please upgrade your plan`,
                      status: false
                    });
                    return;
                  } */
                }
                else {
                  done('400', {
                    message: "User Not Found",
                    status: false
                  });
                }
              })
            },
              (err) => { console.log('Connection Error'); });
          }
          else {
            done('422', {
              status: false,
              message: "Atleast One profile need to be selected."
            });
          }
        }
        else {
          done('404', {
            status: false,
            message: "Incorrect data"
          });
        }
      }
      else {
        done('403', {
          status: false,
          message: "Unauthorized"
        });
      }

      break;
    default:
      done(new Error(`Unsupported method "${event.httpMethod}"`));
  }
};
