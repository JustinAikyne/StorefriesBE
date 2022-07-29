var mongoose = require('mongoose');
var ObjectId = require('mongoose').Types.ObjectId;
var userModel = require('./UserModel.js');
var workspaceModel = require('./workspaceModel.js');
const AWS = require('aws-sdk')

// Change this value to adjust the signed URL's expiration
const URL_EXPIRATION_SECONDS = 300

exports.handler = (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const done = (err, res) => callback(null, {
    statusCode: err ? err : '400',
    body: res ? JSON.stringify(res) : { 'status': 'Not Found' },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const s3 = new AWS.S3({ signatureVersion: 'v4' });

  var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
  var bucketName = event.stageVariables['s3_bucket_name']
  AWS.config.update({ region: event.stageVariables['aws_region'] });

  let mediaType = 'image/jpeg'; // `'video/mp4'` is also supported
  //let mediaType = 'image/*'; // `'video/mp4'` is also supported

  switch (event.httpMethod) {
    case 'GET':
      console.log('GET UploadURL Called')
      context.callbackWaitsForEmptyEventLoop = false;
      if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
        event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

        const folderName = event.queryStringParameters['folder'];
        const fileName = event.queryStringParameters['fName'] || (parseInt(Math.random() * 10000000));
        const ext = event.queryStringParameters['ext'] || 'jpeg';
        const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
        const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
        if (email && email !== '') {
          console.log(email)
          const mdQuery = { 'email': email };

          if (!event.queryStringParameters.workspaceId) {
            done('200', {
              message: "workspaceId is required.",
              status: false
            })
            return;
          }

          connectorMongodb.then(() => {
            //userModel.findOne(mdQuery, { 'firstName': 1, 'lastName': 1, 'email': 1, '_id': 1, 'features': 1 })

            let workspaceQry = [];

            console.log("event.queryStringParameters.workspaceId",event.queryStringParameters.workspaceId)

            workspaceQry = [
              { "$match": { _id: new ObjectId(event.queryStringParameters.workspaceId) } },
              { "$project": { "_id": 1, "workspaceStatus": "$status", "superAdmin": 1, } },
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
              { "$project": { "_id": 1, "superAdmin": "$superAdmin", "workspaceStatus": "$workspaceStatus", "features": "$superAdminDetails.features" } }
            ];

            workspaceModel.aggregate(workspaceQry).exec(async (err, worspaceData) => {
              console.log(worspaceData)
              if (worspaceData?.[0]) {
                let doc = worspaceData[0];
                console.log("doc.........",JSON.stringify(doc));

                
                let filePrefix = (folderName !== '' ? `${doc._id}/${folderName}/` : `${doc._id}/`);

                //if (folderName && folderName == 'clib' && doc.features.totalUploadSize && doc.features.totalUploadSize != null) {
                if (folderName && folderName.includes('clib') && doc.features.totalUploadSize && doc.features.totalUploadSize != null) {
                  filePrefix = `${doc._id}/clib/`
                  let listSize = await getListingS3(filePrefix);
                  if (listSize) {
                    if (doc.features) {
                      if (doc.features.totalUploadSize > parseFloat(listSize)) {
                        getUploadURL(doc._id, ext, folderName, fileName)
                      } else {
                        done('405', {
                          status: "You did not have enough storage for Upload."
                        });
                      }
                    } else {
                      done('405', {
                        status: "You did not have Subscription Feature."
                      });
                    }
                  } else {
                    getUploadURL(doc._id, ext, folderName, fileName)
                  }

                } else {
                  getUploadURL(doc._id, ext, folderName, fileName)
                }
              } else {
                done('400', {
                  status: "User Profile not found"
                });
              }
            });
          },
            (err) => { console.log('Connection Error'); });
        } else {
          done('403', {
            status: "Unauthorized"
          });
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

  const getUploadURL = (workspaceId, ext, folderName, fileName) => {

    if (ext === 'mp4') {
      mediaType = 'video/mp4';
    } else if (ext === 'gif') {
      mediaType = 'image/gif';
    }

    var Key = `${fileName}.${ext}`

    Key = Key.split(" ").join("")
    console.log("Key...............", Key)

    // Get signed URL from S3
    const s3Params = {
      //Bucket: 'storefires-mediafiles',
      Bucket: bucketName,
      Key: (folderName !== '' ? workspaceId + '/' + folderName + '/' + Key : workspaceId + '/' + Key),
      Expires: URL_EXPIRATION_SECONDS,
      ContentType: mediaType,

      // This ACL makes the uploaded object publicly readable. You must also uncomment
      // the extra permission for the Lambda function in the SAM template.

      //ACL: 'public-read'
    }

    s3.getSignedUrl('putObject', s3Params, (err, url) => {
      console.log(url)
      console.log(err)
      if (err) {
        done('403', {
          status: "User not authorized",
        });
      } else {
        done('200', {
          status: "User Profile Retrieved",
          data: url,
          fileName: workspaceId + '/' + Key
        });
      }
    });
  }

  function getListingS3(prefix) {
    return new Promise((resolve, reject) => {
      try {
        let params = {
          Bucket: bucketName,
          MaxKeys: 1000,
          Prefix: prefix,
          Delimiter: prefix
        };
        let size = 0;
        listAllKeys();
        function listAllKeys() {
          s3.listObjectsV2(params, function (err, data) {
            if (err) {
              reject(err)
            } else {
              var listData = data.Contents;
              listData.forEach(function (content) {
                size = size + content.Size;
              });

              if (data.IsTruncated) {
                params.ContinuationToken = data.NextContinuationToken;
                listAllKeys();
              } else {
                if (size > 0) {
                  let finalSize = bytesToSize(size);
                  resolve(finalSize);
                } else {
                  resolve(size);
                }
              }
            }
          });
        }
      } catch (e) {
        reject(e);
      }

    });
  }
  function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));

    return bytes / Math.pow(1024, 2);
  }
};
