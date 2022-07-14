var mongoose = require('mongoose');
var notificationModel = require('./NotificationModel.js');


exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? err : '200',
        body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });

    switch (event.httpMethod) {
        case 'GET':
            console.log('GET LIST Notifications Called')
            context.callbackWaitsForEmptyEventLoop = false;
            console.log(".............", event.headers)
            if (event.headers && (event.headers.userauthdata || event.headers.Userauthdata)) {
                event.headers.userauthdata = event.headers.userauthdata ? event.headers.userauthdata : event.headers.Userauthdata;

                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
                if (email && email !== '') {

                    const mdQuery = { 'userId': { $regex: new RegExp("^" + email, "i") } };
                    connectorMongodb.then(() => {
                        // notificationModel.findOne(mdQuery, function (err, doc) {
                        //     if(doc) {
                        //         done('200', {
                        //             status: "User Notification retireved",
                        //             data: doc.notification
                        //         });   
                        //     } else {
                        //       done('200', {
                        //             status: "No Notifications available for user"
                        //         });  
                        //     }
                        // });

                        let nofityQry = [];
                        nofityQry.push(
                            { "$match": mdQuery },
                            { "$unwind": "$notification" },
                            { "$sort": { "notification.createdDate": -1 } },
                            { "$group": { "notification": { "$push": "$notification" }, "_id": 1 } },
                            { "$project": { "_id": 0, "notification": 1 } }

                        )
                        notificationModel.aggregate(nofityQry, function (err, doc) {
                            //if (doc) {
                            if (doc?.[0]) {
                                done('200', {
                                    status: "User Notification retireved",
                                    data: doc[0].notification
                                });
                            } else {
                                done('200', {
                                    status: "No Notifications available for user"
                                });
                            }
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
};
