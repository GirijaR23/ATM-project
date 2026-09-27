const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    accnum: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    cardnum: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    pinnum: {
        type: String,
        required: true,
        trim: true
    },
    holderName: {
        type: String,
        required: true,
        trim: true,
        default: 'Valued Customer'
    },
    accbls: {
        type: Number,
        required: true,
        default: 10000,
        min: 0
    },
    accType: {
        type: String,
        enum: ['Savings', 'Current'],
        default: 'Savings'
    },
    phone: {
        type: String,
        default: '9876543210'
    },
    email: {
        type: String,
        default: 'customer@bankoftamilnadu.com'
    },
    dailyLimit: {
        type: Number,
        default: 50000
    },
    status: {
        type: String,
        enum: ['Active', 'Blocked'],
        default: 'Active'
    },
    failedAttempts: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Account = mongoose.model('Account', accountSchema);
module.exports = Account;
