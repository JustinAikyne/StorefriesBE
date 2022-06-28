var mongoose = require('mongoose');

var item_price = new mongoose.Schema({
    amount: Number,
    item_price_id: String,
    quantity: { type: Number, default: 1 },
    item_type: { type: String, default: 'plan' }
});

var subscriptionSchema = new mongoose.Schema({
    subscriptionId: String,
    planId: String,
    customer_id: String,
    email: String,
    status: { type: String, default: 'active' },
    subscription_items: [item_price],
    billing_period_unit: String,
    started_at: String,
    current_term_end: String,
    current_term_start: String,
    currency_code: { type: String, default: 'USD' },
    next_billing_at: String,
    total_dues: Number
});

subscriptionSchema.set({ timestamps: true, versionKey: false })

var subscriptions = module.exports = mongoose.model('subscriptions', subscriptionSchema);