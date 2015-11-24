// ----------------------------------------------------------------------------
// Stuff that gets defined in max.js (not included when running in node)
// (c) Pascal Gauthier 2013, under the CC BY-SA 3.0
//

function glasgow_info(msg) {
	console.log(msg)
}

function glasgow_error(msg) {
	console.error(msg)
}

// hack to support underscore in max/msp and node.js :(
__ = _