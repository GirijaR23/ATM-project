const mongoose = require('mongoose');

const userschema = new mongoose.Schema({
    name: { type: String, required: true },
    mail: { type: String, required: true, unique: true },
    pass: { type: String, required: true }
});

const User = mongoose.model('User', userschema);

module.exports = User;
