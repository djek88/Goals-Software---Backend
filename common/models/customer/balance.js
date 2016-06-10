module.exports = function(Balance) {
	Balance.validatesNumericalityOf('USD', {int: true});
};