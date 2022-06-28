var mongoose = require('mongoose');

var onBoardingSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    primary: [],
    user_Role: String,
    socialProfile: String,
    allowedUser: String,
    phone: {
        code: { type: String, default: '' },
        number: { type: String, default: '' }
    },
    organizationName: String,
    employeecount: String,
    isAgency: Boolean,
    businesscategory: String


});

onBoardingSchema.set('timestamps', true)

var onBoarding = module.exports = mongoose.model('onBoarding', onBoardingSchema);