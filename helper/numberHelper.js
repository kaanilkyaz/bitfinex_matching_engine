const crypto = require('crypto')

module.exports.generateUniqId = () => crypto.randomBytes(16).toString('hex');