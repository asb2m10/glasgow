// ----------------------------------------------------------------------------
// the music theory stuff
// (c) Pascal Gauthier 2013, under the CC BY-SA 3.0
//
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
   "m": [2, 1, 2, 2, 2, 1, 2]
}


rhythms = {
   "r4/4" : "0:0.25:-1",
   "r8/4" : "0:0.125:-0.5",  
   "transeuropa-bd" :  "0:0.1/16:0.8/16:0.10/16:-1"
}


// degree(degree, mode, voices, resticted_class)
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
   if ( lvl == 0 )
      return def

   var oz = 0
   for(var i=0;i<def.length;i++) {
      if ( oz < Math.floor(def[i] / 12) )
         oz = Math.floor(def[i] / 12)
   }
   oz = oz * 12 + 12
   if(lvl < 0) {
      lvl *= -1
      if (lvl>def.length)
         lvl = def.length
      for(i=def.length-1;i>=def.length-lvl;i--) 
         def[i] = def[i] - oz
   } else {
      if (lvl>def.length)
         lvl = def.length
      for(i=0;i<lvl;i++) 
         def[i] = def[i] + oz
   }
   return def
}

