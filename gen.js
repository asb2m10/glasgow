Array.prototype.rotate = function(n) {
    return this.slice(n, this.length).concat(this.slice(0, n));
}


function ggr_magneto(unit, swing, size, pow, repeat) {
	if (__.isUndefined(unit))
		unit = 0.125

	if (__.isUndefined(swing))
		swing = 0

	if (__.isUndefined(size))
		size = 8

	if (__.isUndefined(pow))
		pow = 0.8

	if (__.isUndefined(repeat))
		repeat = 1

	var squ = Math.round(Math.sqrt(size))+1
	var ruler = []

	// build the ruler
	ruler.push(squ)
	for(var i=1;i<size;i++) {
		w = i
		for(var j=0;j<32;j++) {
			if ( ( w & 1 ) == 1 )
				break
			w = w >>> 1
		}
		ruler.push(j)		
	}

	if ( swing > 0 ) {
		// add the swing
		if ( swing > squ ) 
			swing = squ

		swing = Math.round(size/swing+1)
		if ( swing > 0 )
			ruler.rotate(swing)
	}

	for(var i=0;i<ruler.length;i++) {
		ruler[i] = (ruler[i] / squ) * pow
	}

	var ret = []
	for(var i=0;i<size*repeat;i++) {
		var x = ruler[i%ruler.length]
		if ( x * Math.random() > 1 ) {
			ret.push(unit * i)
		}
	}

	ret.push((i*unit) * -1)
	return ret
}
