var userModel = require('./UserModel.js');
var mongoose = require('mongoose');
const AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event));

  const done = (err, res) => callback(null, {
    statusCode: err ? err : '200',
    body: err !== '200' ? err.message : JSON.stringify(res),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
  });

  var bucketName = `${event.stageVariables['s3_bucket_name']}`
  AWS.config.update({ region: event.stageVariables['aws_region'] })
  const s3 = new AWS.S3()
  var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });


  switch (event.httpMethod) {
    case 'POST':
      console.log('DELETING S3 Image')
      context.callbackWaitsForEmptyEventLoop = false;
      var body = JSON.parse(event.body);
      if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
				event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

        const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
        const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
        if (email && email !== '') {
          if (body.mediaKey && body.mediaKey.length > 0) {

            let getListingS3 = async (prefix) => {
              return new Promise((resolve, reject) => {

                try {
                  console.log("getListingS3")
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
                            let finalSize = bytesToSize(size)
                            resolve({ listSize: parseFloat(finalSize).toFixed(1) });
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

            /*  let deleteFiles = async (params) => {
               return new Promise((resolve, reject) => {
                 s3.deleteObjects(params, function (err, data) {
                   resolve({ status: true })
                 })
               })
             }
  */
            function bytesToSize(bytes) {
              var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
              if (bytes == 0) return '0';
              var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));

              return bytes / Math.pow(1024, 2);
            }

            connectorMongodb.then(async () => {
              console.log("..........db............")
              if (body.action == 'rename' && body.oldMediaKey) {
                console.log("rename")
                s3.copyObject({
                  Bucket: bucketName,
                  CopySource: `${bucketName}/${body.oldMediaKey}`,
                  Key: body.mediaKey[0].split(" ").join("")

                }).promise().then(() =>
                  // Delete the old object

                  s3.deleteObject({
                    Bucket: bucketName,
                    Key: body.oldMediaKey
                  }, (err, data) => {
                    done('200', {
                      message: "Renamed successfully"
                    });
                  })
                ).catch((e) => {
                  console.error(e)
                  done('403', {
                    message: "Rename is Failed"
                  });
                })
              } else {
                const deleteObjects = [];
                let promiseFunction = [];
                if (body.type == 'folder') {

                  console.log("folder.............")
                  const listObjects = async (param) => {
                    return new Promise(async (resolve, reject) => {
                      s3.listObjects(param).promise().then((listKeys) => {
                        if (listKeys.Contents && listKeys.Contents.length > 0) {
                          listKeys.Contents.forEach(file => {
                            deleteObjects.push({ Key: file.Key })
                          });
                        }
                        resolve({ status: true })
                      }).catch(err => {
                        resolve({ status: false })
                      });
                    })
                  }



                  for (let i = 0; i < body.mediaKey.length; i++) {
                    let folderKey = body.mediaKey[i];
                    let params = {
                      Bucket: bucketName,
                      Prefix: folderKey
                    };
                    promiseFunction.push(listObjects(params));
                    //promiseFunction.push(listObjects(folderKey));
                  }
                }

                let objects = [];
                Promise.all(promiseFunction).then(async (resArr) => {
                  let message = "Media file removed";
                  if (body.action == 'rename' && body.type == 'folder') {
                    message = "Renamed successfully"
                    for await (const mediafile of deleteObjects) {
                      let splitKey = mediafile.Key.split('/');
                      if (splitKey[1] == "clib") {

                        console.log("splitKey", splitKey);
                        console.log("splitKey[-1]", splitKey[splitKey.length - 1]);

                        //let newkey = mediafile.Key.replace("clib", "scheduleMedia").replace(/\s+/g, '');

                        let newkey = `${splitKey[0]}/clib/${body.newFolderName}/${splitKey[splitKey.length - 1]}`;

                        let params = {
                          Bucket: bucketName,
                          CopySource: `${bucketName}/${mediafile.Key}`,
                          Key: newkey,
                        };
                        let uploadFile = await s3.copyObject(params).promise();
                        let splitUrl = mediafile.Key.split(splitKey[0]);
                      }
                    }
                  }

                  if (body.type == 'file') {
                    for (var k in body.mediaKey) {
                      objects.push({ Key: body.mediaKey[k] });
                    }
                  } else if (body.type == 'folder') {
                    objects = deleteObjects;
                  }

                  const params = {
                    Bucket: bucketName,
                    Delete: {
                      //Objects: deleteObjects
                      Objects: objects
                    }
                  };
                  console.log("params", JSON.stringify(params))
                  s3.deleteObjects(params, function (err, data) {

                    let userId = body.mediaKey[0].split('/')[0];
                    const promiseArray = [];
                    promiseArray.push(getListingS3(`${userId}/clib/`));
                    Promise.all(promiseArray).then(async (resArr) => {
                      let updateObj = { "features.currentUploadSize": 0 };
                      if (resArr && resArr[0].listSize && resArr[0].listSize > 0) {
                        updateObj = { "features.currentUploadSize": resArr[0].listSize };
                      }
                      userModel.findOneAndUpdate({ 'email': { $regex: new RegExp("^" + email, "i") } }, { $set: updateObj }, { new: true }, (err, doc) => {

                        done('200', {
                          message: message
                        });
                      });
                    });
                  });
                })
              }
            }).catch(err => {
              done('500', {
                message: err
              });
            })
          } else {
            done('200', {
              message: "No Media available to removed"
            });
          }
        } else {
          done('403', {
            message: "Unauthorized"
          });
        }
      } else {
        done('403', {
          message: "Unauthorized"
        });
      }
      break;
    default:
      done(new Error(`Unsupported method "${event.httpMethod}"`));
  }

  /* function deleteMedia(body) {
  
  } */
};
