var nodemailer = require('nodemailer');

var smtpConfig = {
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
	auth: {
		user: 'mastermindservise@gmail.com',
		pass: 'qwezxcasd'
	}
};

module.exports = nodemailer.createTransport(smtpConfig);