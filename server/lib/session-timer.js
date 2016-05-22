module.exports = Timer;

function Timer(sec) {
	var self = this;

	var totalSec = sec;
	var interval = setInterval(update, 1000);

	self.isPause = false;
	self.onUpdate = null;
	self.onFinish = null;

	self.resume = function() {
		self.isPause = false;
		interval = setInterval(update, 1000);
	};

	self.pause = function() {
		self.isPause = true;
		clearInterval(interval);
	};

	self.finish = function() {
		clearInterval(interval);
		totalSec = 0;
		if (self.onFinish) self.onFinish();
	};

	function update() {
		if (totalSec < 0) return self.finish();

		if (self.onUpdate) self.onUpdate(totalSec);

		totalSec--;
	}
}