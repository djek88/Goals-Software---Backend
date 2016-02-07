var nodemailer = require('nodemailer');

var smtpConfig = {
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
	auth: {
		user: 'mastermindservise@gmail.com',
		pass: 'l3df6aL1Jlk375asdf7'
	}
};

module.exports = nodemailer.createTransport(smtpConfig);