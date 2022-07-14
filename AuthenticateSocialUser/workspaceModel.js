var mongoose = require('mongoose');

var userData = new mongoose.Schema({
    userId: String,
    role: String,
    email: String,
    name: String,
    status: String
});

var workspaceSchema = new mongoose.Schema({
    workspaceName: { type: String, lowercase: true },
    workspaceDisplayName: String,
    workspaceTimezone: String,
    superAdmin: String,
    workspaceLogo: String,
    users: [userData],
    status: { type: String, default: 'active' }
});

workspaceSchema.set('timestamps', true)

module.exports = mongoose.model('workspace', workspaceSchema);