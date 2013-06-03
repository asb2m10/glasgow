// API
_gsVersion = 0.1

// This is set by the Max plugin to inform the clip start loop point.
var _gsClipStart = 0

// This is set by the Max plugin to inform the clip start loop point.
var _gsClipEnd = 4

// This is emulating the quantize note value. The "0" duration value will be
// based on this quantize ratio.
var _gsClipQtz = 0.125

// Use this if you want less precision on event timestamps. Once it gets 
// Live, each event will be multipled by this value. 
var _gsTmRatio = 1

function mkp(tm, note, velo, dur, start, end) {

	if ( __.isUndefined(tm) ) {
		tm = [ 0 ]
	} else if ( __.isString(tm) ) {
		tm = timelist(tm)
	} else if ( __.isNumber(tm) ) {
		tm = [ tm ]
	}
	if ( __.isArray(tm) )
		tm = new IterLoopTm(tm)

	if ( __.isUndefined(note) ) {
		note = [ 65 ]
	} else if ( __.isString(note) ) {
		note = notelist(note)
	} else if ( __.isNumber(tm) ) {
		note = [ note ]
	}
	if ( __.isArray(note) )
		note =  new IterLoop(note)


	if ( __.isUndefined(dur) ) {
		dur = [ 0 ]
	} else if ( __.isString(dur) ) {
		dur = timelist(dur)
	} else if ( __.isNumber(dur) ) {
		dur = [ dur ]
	}
	if ( __.isArray(dur) )
		dur = new IterLoop(dur)

	if ( __.isUndefined(velo) ) {
		velo = [ 100 ]
	} else if ( __.isString(velo) ) {
		velo = timelist(velo)
	} else if ( __.isNumber(velo) ) {
		velo = [ velo ]
	}
	if ( __.isArray(velo) )
		velo = new IterLoop(velo)
	
	if ( __.isUndefined(start) || start == -1 ) {
		start = _gsClipStart
	} 

	if ( __.isUndefined(end) || end == -1 ) {
		end = _gsClipEnd
	}

	ret = new Array()

	var _i

	for(_i=0;_i<100;_i++) {
		t = tm.next() 
		if ( t == null ) {
			break;
		}
		t += start

		d = dur.next() 
		if ( d == null ) {
			break;
		}

		// note duration by quantize
		if ( d == 0 ) {
			d = _gsClipQtz
		} 

		// note until next event
		if ( d == -1 ) {
			d = (tm.peek() + start) - t
		}

		if ( t+d > end )
			break

		v = velo.next()
		if ( v == null ) {
			break;
		}

		n = note.next()
		if ( n == null ) {
			break;
		}
		// test if it is a chord
		if ( __.isArray(n) ) {
			for(var i=0;i<n.length;i++) {
				ret.push( [ t, n[i], v, d ] )
			}
		} else {
			ret.push( [ t, n, v, d ] )
		}
	}

	if ( _i >= 16000 ) {
		throw "got stuck in a loop in mkp. See your iterators: " + _i
	}

	return ret
}


function timelist(tm) {
	var tms = tm.split(":")
	var ret = new Array()
	for( i in tms ) {
		if ( tms[i].indexOf("/") != -1 ) { 
			base = tms[i].split(".")
			add = parseFloat(base[0])
			if ( tms[i].length > 1 ) {	
				add += (eval(base[1]))
			} 
		} else {
			add = parseFloat(tms[i])

		}
		ret.push( add )
	}
	return ret
}


function rendernote(str, chord) {
	var z = str.charCodeAt(0)
	if ( z == 68 ) { 			// D
		z = 2
	} else if ( z == 69 ) {		// E
		z = 4
	} else if ( z == 70 ) {		// F
		z = 5
	} else if ( z == 71 ) {		// G
		z = 7
	} else if ( z == 65 ) {		// A
		z = -3
	} else if ( z == 66 ) {		// B
		z = -1
	} else {					// DEFAULT charCodeAt
		z = 0
	}
	if ( str.charAt(1) == '#' )
		z++
	z += parseInt(str.substring(2)) * 12
	chord.push(z)
}


function notelist(note) {
	var note = note.toUpperCase()
	var notes = note.split(":")
	var ret = new Array();
	for(var i=0;i<notes.length;i++) {
		var chord = new Array()
		var c = notes[i].split(",")
		for(var j=0;j<c.length;j++)
			rendernote(c[j], chord)
		if ( chord.length == 0 )
			continue
		if ( chord.length == 1 )
			ret.push( chord[0] )
		else 
			ret.push( chord )
	}
	return ret
}

function flatten_event(lst) {
	var ret = new Array()
	for(var i=0;i<lst.length;i++) {
		if ( __.isArray(lst[i]) ) {

			if ( __.isArray(lst[i][0]) ) {
				for(var j=0;j<lst[i].length;j++) {
					ret.push(lst[i][j])
				}
			} else {
				ret.push(lst[i])
			}
		} 
	}
	return ret;
}

function choose(times, lst) {
	var ret = new Array()
	for(var i=0;i<lst.length;i++) {
		ret.push(lst[__.random(0,lst.length-1)])
	}
	return ret;
}

function IterLoop(lst) {
	this.i = -1;
	this.lst = lst
}
IterLoop.prototype.next = function() {
	if ( ++this.i >= this.lst.length ) {
		this.i = 0
	}
	return this.lst[this.i]
}

function IterLoopTm(lst, end) {
	if ( __.isUndefined(end) || __.isNaN(end) ) {
		end = -1
	}

	// tries to calculate the end of the loop point
	if ( end == -1 ) {
		if ( lst[lst.length-1] < 0 ) {
			end = lst[lst.length-1] * -1
			// remove the list length 
			lst.pop()
		} else { 
			work = lst.slice(0)
			work.sort()
			work = __.uniq(lst)
			if ( work.length > 1 ) {
				l1 = work.pop()
				l2 = work.pop()
				end = l1 + (l1-l2)
			} else {
				l1 = work.pop()
				if ( l1 == 0 ) {
				// defaulting to 1/4 note
					end = _gsClipQtz
				} else {
					end = l1
				}
			}
		}
	}
	this.end = end
	this.i = -1;
	this.lst = lst;
	this.looped = 0

}
IterLoopTm.prototype.next = function() {
	if ( ++this.i >= this.lst.length ) {
		this.i = 0
		this.looped++
	}
	return this.lst[this.i] + (this.looped * this.end)
}

IterLoopTm.prototype.peek = function() {
	i2 = this.i + 1
	if ( i2 < this.lst.length ) {		
		return this.lst[i2] + ( this.looped * this.end )
	} else {
		return this.lst[0] + ( (this.looped+1) * this.end)
	}
}


function IterLast(lst) {
	this.i = -1;
	this.lst = lst;	
}
IterLast.prototype.next = function() {
	if ( ++this.i >= this.lst.length ) {
		this.i--
	}
	return this.lst[this.i]
}

function IterDone(lst) {
	this.i = -1;
	this.lst = lst;	
}
/*IterDone.prototype.next = function() {
	if ( ++this.i >= this.lst.length) {
		return null
	}
	return this.lst[this.i]
}*/
