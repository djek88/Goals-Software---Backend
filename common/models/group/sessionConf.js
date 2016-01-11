module.exports = function(SessionConf) {
	var FREQUENCYTYPE = {
		1: 'Weekly',
		2: 'First week',
		3: 'Second week',
		4: 'Third week',
		5: 'Fourth week',
		6: 'First and third week',
		7: 'Second and Fourth week'
	};
	var frequencyWhiteList = Object.keys(FREQUENCYTYPE).map(function (item) {
		return Number(item);
	});

	SessionConf.validatesInclusionOf('frequency', {in: frequencyWhiteList});
};