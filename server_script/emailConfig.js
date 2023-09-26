const nodemailer = require('nodemailer')
require('dotenv').config()

const transporter = nodemailer.createTransport({
    host: process.env.HOST,
    port: 587,
    auth: {
        user: process.env.LOGIN,
        pass: process.env.PASS
    }
})

module.exports = {transporter}