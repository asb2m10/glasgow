// modal stuff
modes = {

   "ionian": [2, 2, 1, 2, 2, 2, 1],
   "dorian": [2, 1, 2, 2, 2, 1, 2],
   "phrygian": [1, 2, 2, 2, 1, 2, 2],
   "lydian": [2, 2, 2, 1, 2, 2, 1],
   "mixolydian": [2, 2, 1, 2, 2, 1, 2],
   "aeolian": [2, 1, 2, 2, 1, 2, 2],
   "locrian": [1, 2, 2, 1, 2, 2, 2],


   // synonyms

   "M": [2, 2, 1, 2, 2, 2, 1],
   "m": [2, 1, 2, 2, 2, 2, 1]
}

// degree(degree, mode, voices, resticted_classe)

function degree(d, m, v, r) {
   if (__.isString(m)) {
      m = modes[m]
   }

   if (__.isUndefined(d)) {
      d = 1
   }
   if (__.isString(d)) {
      d = Number(d)
   }

   if (__.isUndefined(r)) {
      r = 0
   }

   if (__.isUndefined(v) || v == null) {
      v = [1, 3, 5]
   } else if (v[0] > 4) {
      v.unshift(1, 3, 5)
   }

   //console.log("modal:", d, m, v, r, "******")
   d--
   addl(-1, v)

   var mode = []
   var count = 0;
   for (var i = 0; i < m.length; i++) {
      mode.push(count)
      count += m[i]
   }
   var ret = []
   for (var i = 0; i < v.length; i++) {
      var x = mode[(v[i] + d) % m.length] + (Math.floor((v[i] + d) / m.length) * 12)
      ret.push(x)
   }

   // restrict class
   if (r != 0) {
      for (var i = 0; i < ret.length; i++) {
         ret[i] = ret[i] % 12
      }
   }
   return ret;
}

function inverter(def, lvl) {
   return def
}