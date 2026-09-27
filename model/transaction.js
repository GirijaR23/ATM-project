const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    txnId: {
        type: String,
        required: true,
        unique: true
    },
    accnum: {
        type: String,
        required: true,
        index: true
    },
    cardnum: {
        type: String
    },
    txnType: {
        type: String,
        required: true,
        enum: ['WITHDRAWAL', 'FAST_CASH', 'DEPOSIT', 'TRANSFER_SENT', 'TRANSFER_RECEIVED', 'PIN_CHANGE', 'BALANCE_ENQUIRY']
    },
    amount: {
        type: Number,
        default: 0
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    targetAccnum: {
        type: String,
        default: null
    },
    targetHolderName: {
        type: String,
        default: null
    },
    details: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILED'],
        default: 'SUCCESS'
    },
    atmId: {
        type: String,
        default: 'ATM-TN-CHN-008'
    },
    location: {
        type: String,
        default: 'Chennai Central Branch, Tamil Nadu'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
