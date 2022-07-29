var mongoose = require('mongoose');
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId

var userData = new mongoose.Schema({
    userId: ObjectId,
    role: String,
    email: String,
    status: String
});

var workspaceSchema = new mongoose.Schema({
    workspaceName: { type: String, lowercase: true },
    workspaceDisplayName: String,
    superAdmin: String,
    workspaceLogo: String,
    users: [userData],
    status: { type: String, default: 'active' }
});

workspaceSchema.set('timestamps', true)

module.exports = mongoose.model('workspace', workspaceSchema);