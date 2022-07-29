const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
var mongoose = require('mongoose');
var ObjectId = require('mongoose').Types.ObjectId;
var userModel = require('./UserModel.js');
var workspaceModel = require('./workspaceModel.js');

exports.handler = function (event, context, callback) {
    console.log("event........", JSON.stringify(event))
    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}`, { useNewUrlParser: true, useUnifiedTopology: true });
    context.callbackWaitsForEmptyEventLoop = false;
    // Retrieve request parameters from the Lambda function input:
    var headers = event.headers;
    var queryStringParameters = event.queryStringParameters;
    var pathParameters = event.pathParameters;
    var stageVariables = event.stageVariables;
    var path = event?.requestContext?.http?.method;

    // Parse the input for the parameter values
    var tmp = event.routeArn.split(':');
    var apiGatewayArnTmp = tmp[5].split('/');

    // Create wildcard resource
    var resource = tmp[0] + ":" + tmp[1] + ":" + tmp[2] + ":" + tmp[3] + ":" + tmp[4] + ":" + apiGatewayArnTmp[0] + '/*/*';
    console.log("resource: " + resource);

    let token = extractTokenFromHeader(headers) || '';
    var decoded = jwt.decode(token, { complete: true });
    

    // Help function to generate an IAM policy
    function generatePolicy(principalId, effect, resource, contextObj) {
        // Required output:
        console.log("Resource in generatePolicy(): " + resource);
        var authResponse = {};
        authResponse.principalId = principalId;
        if (effect && resource) {
            var policyDocument = {};
            policyDocument.Version = '2012-10-17'; // default version
            policyDocument.Statement = [];
            var statementOne = {};
            statementOne.Action = 'execute-api:Invoke'; // default action
            statementOne.Effect = effect;
            statementOne.Resource = resource;
            policyDocument.Statement[0] = statementOne;
            authResponse.policyDocument = policyDocument;
            console.log("policyDocument", policyDocument)
        }
        //Optional output with custom properties of the String, Number or Boolean type.
        // let context = {};
        // context.userId = "u123";
        // context.userEmail = "test@yopmail.com";

        //authResponse.context = {};
        /*authResponse.error = {
            message : "Deny for token expired.",
            messageString : "Deny for token expired."
        }*/
        
        if (effect == 'Deny') {
                var error = new Error("Validation error: the file is too big.")
            context.fail("Unauthorized");
            //context.fail(error);
            return;

        }else{
            authResponse.context = contextObj;
        }
        

        //context.authorizer.error = "Deny for token expired.";
        
        console.log("context.authorizer",context)
        console.log("$context.identity.sourceIp")
        //console.log("context.authorizer",$context.authorizer)

        //console.log("customErrorMessage", customErrorMessage)
        console.log(".............authResponse.............", JSON.stringify(authResponse));

        return authResponse;
    }

    /* function generateAllow(principalId, resource) {
        return generatePolicy(principalId, 'Allow', resource);
    }

    function generateDeny(principalId, resource, message = null) {
        return generatePolicy(principalId, 'Deny', resource);
    } */

    function extractTokenFromHeader(e) {
        if (e.authorization) {
            let token = e.authorization.split(' ');
            return token[1];

            //return e.authorizationToken.split(' ')[1];
        }
        else {
            return "";
        }
    }

    function getSigningKey(header = decoded.header, callback) {
        const keyClient = jwksClient({
            cache: true,
            cacheMaxAge: 86400000, //value in ms
            rateLimit: true,
            jwksRequestsPerMinute: 10,
            strictSsl: true,
            jwksUri: 'https://aikyne1.eu.auth0.com/.well-known/jwks.json'
        })
        keyClient.getSigningKey(header.kid, function (err, key) {
            console.log("err...hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh...", err)
            if (err) {
                //reject(true);
                //callback(null, generateDeny('me', resource));
                callback(err);
            }
            else {
                const signingKey = key.publicKey || key.rsaPublicKey;
                callback(null, signingKey);
            }
        })
    }

    function validateToken(token) {


        const verificationOptions = {
            // verify claims, e.g.
            //"audience": "urn:audience",
            "algorithms": "RS256"
        }

        return new Promise(async (resolve, reject) => {
            jwt.verify(token, getSigningKey, verificationOptions, function (error) {
                if (error) {
                    console.log("...............Unauthorized........error..................", JSON.stringify(error))
                    // callback("Unauthorized")
                    //callback(null, generateDeny('me', resource));
                    reject(true);
                }
                else {
                    console.log("...............authorized..........................")
                    //callback(null, allow)
                    //callback(null, generateAllow('me', resource));
                    resolve(true);
                }
            })
        })


    }

    var promiseArray = [];
    connectorMongodb.then(() => {
        if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
            event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

            const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
            const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
            if (email && email !== '') {
                promiseArray.push(validateToken(token));
                promiseArray.push(userModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } }, { 'email': 1, '_id': 1, "firstName": 1, "lastName": 1 }));

                let workspaceId = '';
                workspaceId = queryStringParameters?.workspaceId ?? pathParameters?.workspaceId;

                if (path && path == 'POST') {
                    console.log(".")
                    let body = JSON.parse(event.body);
                    workspaceId = body?.workspaceId;
                }

                console.log("workspaceId", workspaceId)

                if (workspaceId) {
                    let workspaceQry = [
                        { "$match": { _id: new ObjectId(workspaceId) } },
                        { "$project": { "_id": 1, "wsStatus": "$status", "superAdmin": 1, "wsName": "$workspaceDisplayName", "users": 1 } },
                        {
                            "$lookup": {
                                "from": "users", "let": { "superAdminEmail": "$superAdmin" },
                                "pipeline": [
                                    { "$match": { $expr: { $and: [{ $eq: ["$$superAdminEmail", "$email"] }] } } },
                                    { "$project": { "features": "$features", "superAdminEmail": "$email" } }
                                ], as: "superAdminDetails"
                            }
                        },
                        { "$unwind": { path: "$superAdminDetails", preserveNullAndEmptyArrays: true } },
                        { "$project": { "_id": 1, "superAdmin": 1, "wsStatus": "$wsStatus", "wsName": "$wsName", "users": 1, "features": "$superAdminDetails.features" } }
                    ];


                    //promiseArray.push(workspaceModel.findOne({ '_id': workspaceId }));
                    promiseArray.push(workspaceModel.aggregate(workspaceQry));
                }

                Promise.all(promiseArray).then(async (authRes) => {
                    console.log(".........................final..........................................", JSON.stringify(authRes))
                    let resObj = {};
                    resObj.features = {};
                    let userData = authRes[1];
                    if (userData) {
                        resObj.userId = userData._id;
                        resObj.email = userData.email;
                        resObj.firstName = userData.firstName;
                        resObj.lastName = userData.lastName;
                    }
                    if (!authRes[0] || !authRes[1]) {
                        //callback(null, generateDeny('me', resource));
                        callback(null, generatePolicy("user", 'Deny', resource, null));
                    }
                    else if (authRes.length == 3) {
                        console.log("authRes[2]",authRes[2])
                            console.log("......................authRes?.[2]?.[0].........................",authRes?.[2]?.[0])
                        if (authRes?.[2]?.[0]) {
                            
                            console.log("...............................................")
                            
                            let workspaceData = authRes[2][0];
                            let is_allow = false;

                            workspaceData.users.forEach(user => {
                                if (user.email == userData.email) {
                                    is_allow = true;
                                    resObj.userRole = user.role;
                                }
                            });

                            resObj.superAdmin = workspaceData.superAdmin;
                            resObj.workspaceId =workspaceData._id;
                            resObj.workspaceName = workspaceData.wsName;
                            resObj.workspaceStatus = workspaceData.wsStatus;
                            resObj.features = workspaceData.features;

                            if (is_allow) {
                                //callback(null, generateAllow('me', resource));
                                callback(null, generatePolicy("user", 'Allow', resource, resObj));
                            } else {
                                callback(null, generatePolicy("user", 'Deny', resource, null));
                                //callback(null, generateDeny('me', resource));
                            }
                        } else {
                            callback(null, generatePolicy("user", 'Deny', resource, null));
                        }
                    } else {
                        callback(null, generatePolicy("user", 'Allow', resource, resObj));
                    }
                }).catch(err => {
                    console.log("......err.....pro.....", JSON.stringify(err));
                    callback(null, generatePolicy("user", 'Deny', resource, null));
                })
            }
            else {
                callback(null, generatePolicy("user", 'Deny', resource, null));
            }
        }
        else {
            callback(null, generatePolicy("user", 'Deny', resource, null));
        }
    }).catch(err => {
        callback(null, generatePolicy("user", 'Deny', resource, null));
    })







}
