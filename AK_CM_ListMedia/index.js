var mongoose = require('mongoose');
var userModel = require('./UserModel.js');
const AWS = require('aws-sdk');
var workspaceModel = require('./workspaceModel.js');

// Change this value to adjust the signed URL's expiration
const URL_EXPIRATION_SECONDS = 300

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? err : '200',
        body: err ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    console.log('trying to connect')
    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}`, { useNewUrlParser: true, useUnifiedTopology: true });
    var bucketName = `${event.stageVariables['s3_bucket_name']}`
    AWS.config.update({ region: event.stageVariables['aws_region'] })
    const s3 = new AWS.S3()
    let mediaType = 'image/jpeg'; // `'video/mp4'` is also supported

    switch (event.httpMethod) {
        case 'GET':
            console.log('GET List of S3 items Called')
            context.callbackWaitsForEmptyEventLoop = false;
            if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
                event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;
                const folderName = event.queryStringParameters['folder'] || '';
                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
                if (email && email !== '') {
                    const mdQuery = { 'email': email };

                    if (!event.queryStringParameters.workspaceId) {
                        done('200', {
                            message: "workspaceId is required.",
                            status: false
                        })
                        return;
                    }

                    connectorMongodb.then(() => {
                        var userDetail = userModel.findOne({ 'email': { $regex: new RegExp("^" + email, "i") } }, { 'email': 1, '_id': 1 });
                        var workspaceDetail = workspaceModel.findOne({ '_id': event.queryStringParameters.workspaceId }, { 'workspaceId': 1, '_id': 1, 'users':1, 'status':1 });

                        Promise.all([userDetail, workspaceDetail]).then(async (proResult) => {
                            if (proResult?.[0] && proResult?.[1]) {
                                let userData = proResult[0];
                                let workspaceData = proResult[1];
                                let can_view = false;

                                workspaceData.users.forEach(user => {
                                    if (user.email == userData.email) {
                                        can_view = true;
                                    }
                                });

                                if (can_view) {
                                    let filePrefix = (folderName !== '' ? `${workspaceData._id}/${folderName}/` : `${workspaceData._id}/`);
                                    if (event.queryStringParameters['q']) {
                                        filePrefix = `${filePrefix}${event.queryStringParameters['q'].trim()}`
                                    }

                                    if (event.queryStringParameters['filterBy'] && event.queryStringParameters['q']) {
                                        filePrefix = `${filePrefix}${event.queryStringParameters['filterBy'].trim()}`
                                    } else if (event.queryStringParameters['filterBy']) {
                                        filePrefix = `${filePrefix}*.${event.queryStringParameters['filterBy'].trim()}`
                                    }
                                    getS3Images(filePrefix)
                                } else {
                                    done('400', {
                                        status: false,
                                        message: "User not allowed to view.",
                                    })
                                    return;
                                }
                            } else {
                                done('400', {
                                    status: false,
                                    message: "Bad Request.",
                                })
                                return;
                            }
                        }).catch(err => {
                            done('400', {
                                status: false,
                                message: "Bad Request.",
                            })
                            return;
                        })
                    },
                        (err) => { console.log('Connection Error'); });
                }

            } else {
                done('403', {
                    status: "Unauthorized"
                });
            }

            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }

    const getS3Images = (filePrefix) => {

        var params = {
            //Bucket: 'storefires-mediafiles',
            //Bucket: 'aikyne-mediafiles',
            Bucket: bucketName,
            //MaxKeys: 20,
            Delimiter: '/',
            Prefix: filePrefix
        };
        console.log("params", JSON.stringify(params))

        s3.listObjectsV2(params, function (err, data) {
            if (err) {
                done('400', {
                    status: err.message,
                });
            } else {
                let folders = [];
                let files = [];
                if (data.CommonPrefixes && data.CommonPrefixes.length > 0) {
                    data.CommonPrefixes.forEach(str => {
                        folders.push(str.Prefix.slice(0, -1))
                    });
                    console.log("folders....", JSON.stringify(folders))
                }
                if (data.Contents && data.Contents.length > 0) {
                    data.Contents.forEach(file => {
                        if (file.Size != 0) {
                            files.push(file)
                        }
                    })
                }
                console.log("<<<all content", data);
                done('200', {
                    message: "User Profile Retrieved",
                    data: files,
                    folder: folders,
                    status: true
                });
            }
        })
    }
};
