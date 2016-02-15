var nodemailer = require('nodemailer');
var app = require('../server');

var smtpConfig = {
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
	auth: {
		user: 'mastermindservise@gmail.com',
		pass: 'l3df6aL1Jlk375asdf7'
	}
};
var mailerTransport = nodemailer.createTransport(smtpConfig);

module.exports = mailerTransport;
module.exports.notifyByEmail = notifyByEmail;
module.exports.notifyById = notifyById;

function notifyByEmail(email, subject, text, cb) {
	cb = cb || function() {};
	var emails = Array.isArray(email) ? email : [email];

	mailerTransport.sendMail({
		from: 'Mastermind',
		to: emails.join(', '),
		subject: subject,
		text: text
	}, cb);
}

function notifyById(customerId, subject, text, cb) {
	cb = cb || function() {};
	var ids = Array.isArray(customerId) ? customerId : [customerId];

	app.models.Customer.find({
		where: {_id: {inq: ids}}
	}, function(err, customers) {
		if (err) return cb(err);

		var recipients = customers.map(function(m) {return m.email;});

		mailerTransport.sendMail({
			from: 'Mastermind',
			to: recipients.join(', '),
			subject: subject,
			text: text
		}, cb);
	});
}