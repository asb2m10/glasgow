
var assert = require("assert")

_gsClipStart = 0
_gsClipEnd = 4

describe('timelist', function() {
	it('should return array timestamp', function() {
		var x = timelist("0:2.5:5.1/4:-6")
		assert.equal(0, x[0])
		assert.equal(2.5, x[1])
		assert.equal(5.25, x[2])
		assert.equal(-6, x[3])
	})

	it('should return array timestamp', function() {
		var x = timelist("0.125:0.5:0.3/4")
		assert.equal(0.125, x[0])
		assert.equal(0.5, x[1])
		assert.equal(0.75, x[2])
	})
})

describe('notelist', function() {
	it('should return the array of midi note', function() {
		var x = notelist("C-0:C-5:C#5")
		assert.equal(0, x[0])
		assert.equal(60, x[1])
		assert.equal(61, x[2])
	})

	it('should return the note value', function() {
		var x = notelist("C-5")
		assert.equal(60, x[0])
	})
})

describe('IterLoopTm', function() {
	it('should return _gsClipQtz at each step', function() {
		x = new IterLoopTm([0]) 
		assert.equal(0, x.next())
		assert.equal(0.125, x.next())
		assert.equal(0.25, x.next())
	})

	it('should return 1 at each step', function() {
		x = new IterLoopTm([0,1]) 
		assert.equal(0, x.next())
		assert.equal(1, x.next())
		assert.equal(2, x.next())
		assert.equal(3, x.next())		
	})

	it('should loop at each 4 whole note', function() {
		x = new IterLoopTm([0,1,-4]) 
		assert.equal(0, x.next())
		assert.equal(1, x.next())
		assert.equal(4, x.next())
		assert.equal(5, x.next())		
		assert.equal(8, x.next())
		assert.equal(9, x.next())
	})	
})

describe('mkp', function() {
	it('should return correct events', function() {
		var x = mkp([ 0, 0.25, 0.75, 1, 1.50, 2 ], [ 60, 63, 65 ], [ 100 ])
		assert.equal(x[9][0], 3.5)
		assert.equal(x[9][1], 60)		
		assert.equal(x[9][2], 100)		
		assert.equal(x[9][3], 0.125)		
	})
})

describe('flatten_event', function() {
	it('should return the event in the same array', function() {
		var x = [ mkp([0, 1, -2], "E-2:E-4", [100], [-1]), mkp([0, 1, -2], "E-2:E-4", [100], [-1]) ]
		//x = flatten_event(x)
		x = __.flatten(x,true)
		assert.equal(x.length, 8)
	})
})

describe('choose', function() {
	it('should return 4 different values', function() {
		var x = choose(4, [60, 63, 65, 66])
		assert.equal(x.length, 4)
	})
})
