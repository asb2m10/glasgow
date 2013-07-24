// ----------------------------------------------------------------------------
// the Glasgow API.
// (c) Pascal Gauthier 2013, under the CC BY-SA 3.0
//
// API version
var _gsVersion = 0.3

// This is set by the Max plugin to inform the Live clip start loop point.
var _gsClipStart = 0

// This is set by the Max plugin to inform the Live clip start loop point.
var _gsClipEnd = 4

// This is emulating the quantize note value. The "0" duration value 
// in the note list will be based on this quantize ratio.
var _gsClipQtz = 0.125

// Use this if you want less precision on event timestamps. Once it gets 
// into Live, each event will be multipled by this value. 
var _gsTmRatio = 1

// The last value what GetClip returned
var _gsLastGetClip = []

// The last selected note
var _gsLastNote = 0

// The last selected mode
var _gsLastMode = "ionian"


// make musical phrase
function mkp(tm, note, velo, dur, start, end) {
   if (__.isUndefined(tm)) {
      tm = [0]
   } else if (__.isString(tm)) {
      tm = timelist(tm)
   } else if (__.isNumber(tm)) {
      tm = [tm]
   }
   if (__.isArray(tm))
      tm = new IterLoopTm(tm)

   if (__.isUndefined(note)) {
      note = [65]
   } else if (__.isString(note)) {
      note = notelist(note)
   } else if (__.isNumber(tm)) {
      note = [note]
   }
   if (__.isArray(note))
      note = new IterLoop(note)


   if (__.isUndefined(dur)) {
      dur = [0]
   } else if (__.isString(dur)) {
      dur = timelist(dur)
   } else if (__.isNumber(dur)) {
      dur = [dur]
   }
   if (__.isArray(dur))
      dur = new IterLoop(dur)

   if (__.isUndefined(velo)) {
      velo = [100]
   } else if (__.isString(velo)) {
      velo = timelist(velo)
   } else if (__.isNumber(velo)) {
      velo = [velo]
   }
   if (__.isArray(velo))
      velo = new IterLoop(velo)

   if (__.isUndefined(start) || start == -1) {
      start = _gsClipStart
   }

   if (__.isUndefined(end) || end == -1) {
      end = _gsClipEnd
   }

   var ret = []
   for (var i = 0; i < 1024; i++) {
      t = tm.next()
      if (t == null) {
         break;
      }
      t += start

      d = dur.next()
      if (d == null) {
         break;
      }

      // note duration by quantize
      if (d == 0) {
         d = _gsClipQtz
      }

      // note until next event
      if (d == -1) {
         d = (tm.peek() + start) - t
      }

      if (t + d > end)
         break

      v = velo.next()
      if (v == null) {
         break;
      }

      n = note.next()
      if (n == null) {
         break;
      }

      // if it is a chord
      if (__.isArray(n)) {
         for (var i = 0; i < n.length; i++) {
            ret.push([t, n[i], v, d])
         }
      } else {
         ret.push([t, n, v, d])
      }
   }

   if (i >= 1024) {
      throw "got stuck in a loop in mkp. See your iterators: " + i + " clipEnd:" + _gsClipEnd
   }

   return ret
}


// make rhythm
function mkr(r, velo, start, end) {
   r = compile_rhythm(r)
   ret = []
   for(var k in r) {
      console.log(k)
      n = [Number(k)]
      for(var i=0;i<r[k].length;i++) {
         ret = ret.concat(mkp(r[k][i], n, velo, _gsClipQtz, start, end))
      }
   }
   return ret;
}


// transform timelist string format into array of floats
function timelist(tm) {
   //glasgow_info("time: " + tm)
   var tms = tm.split(":")
   var ret = []
   for (i in tms) {
      var it = tms[i].trim()
      if (it.indexOf("/") != -1) {
         base = it.split(".")
         add = parseFloat(base[0])
         if (it.length > 1) {
            add += (eval(base[1]))
         }
      } else {
         add = parseFloat(it)

      }
      ret.push(add)
   }
   return ret
}


function isnum(chr) {
   var x = chr.charCodeAt(0)
   return x >= 48 && x <= 57
}


function ischar(chr) {
   var x = chr.charCodeAt(0)
   return ( x >= 65 && x <= 90 ) || ( x >= 97 && x <= 122 )
}


// render note (or chord from string)
function rendernote(str, chord) {
   str = str.trim().split('')
   str.push(' ')
   var state = 0;
   var buff = []
   var inv = 0
   var v = []
   var d = 1
   var m = null
   var minus = 1
   var r = 0

   for(var i=0;i<str.length;i++) {
      var cur=str[i]
      switch(state) {
         case 0 :
            switch(cur.toUpperCase()   ) {
               case '%' :
                  z = _gsLastNote
                  m = _gsLastMode
                  state = 3
               break;
               case 'D' : z = 2; state=1; break
               case 'E' : z = 4; state=1; break
               case 'F' : z = 5; state=1; break
               case 'G' : z = 7; state=1; break
               case 'A' : z = 9; state=1; break
               case 'B' : z = 11; state=1; break
               case 'C' : z = 0; state=1; break
               default :
                  throw "unknown note"
            }
         break;

         // sharp define
         case 1 :
            switch(cur) {
               case '-' :
                  minus = -1
               break;
               case '#' :
                  z++
               break;
               default:
                  z += parseInt(cur) * 12
                  z *= minus
                  z += 24    // uses Ableton Note octave numbering : from C-2 to G8
                  _gsLastNote = z
                  buff = []
                  state = 2
            }
            break;

         // mode name
         case 2:      
            if (ischar(cur)) {
               buff.push(cur)
               break
            } 

            if (cur == '^') {
               m = buff.join('')
               // parse chord degree
               buff = []
               state = 3
               break;
            } 

            if (isnum(cur)) {
               // jump to voicing
               m = buff.join('')
               buff = [ cur ] 
               state = 5
               break;
            }

            if ( buff.length != 0 ) {
               m = buff.join('')
               buff = []
            }            
            state = 5
            if (cur != ' ')
               i--
         break

         // degree name
         case 3: 
            if (isnum(cur)) {
               d = cur
               buff = []
               state = 5
               break;
            } 

            if (ischar(cur)) {
               buff = [ cur ]
               state = 4
               break;
            }
         break

         case 4: 
            if (ischar(cur)) {
               buff.push(cur)
            } else {
               d = buff.join('')
               buff = []
               i--
               state = 5
            }
         break;

         // extra voicing  
         case 5 :
            if (isnum(cur)) {
               buff.push(cur)
               break
            }
            switch(cur) {
            case  '-' :
               v.push(parseInt(buff.join('')))
               buff = []
            break;
            case '<' :
               inv--
            break
            case '>' :
               inv++
            break
            case '$' :
               r = 1
            }
         break
      }
   }

   if ( buff.length != 0 ) {
      v.push(parseInt(buff.join('')))
   } 

   // is it just a note ?
   if ( m == null ) {
      return chord.push(z)
   }
   _gsLastMode = m
   if ( v.length == 0 )
      v = null


   var notes = degree(d, m, v, r)
   inverter(notes, inv)

   addl(z, notes)
   chord.push(notes)
}


// transform notelist string format into array of int (midi note)
function notelist(note) {
   var notes = note.split(":")
   var ret = []
   for (var i = 0; i < notes.length; i++) {
      var chord = []
      var c = notes[i].split(",")
      for (var j = 0; j < c.length; j++)
         rendernote(c[j], chord)
      if (chord.length == 0)
         continue
      if (chord.length == 1)
         ret.push(chord[0])
      else
         ret.push(chord)
   }
   return ret
}


function compile_rhythm(r) {
   co = {}

   for(var k in r) {
      if ( isnum(k.substring(0,1)) ) {
         rk = Number(k.substring(0,1) )
      } else {
         n = []
         rendernote(k, n)
         rk = n[0]
      }

      var v = r[k]
      var rv = []
      var ae = []
      co[rk] = rv

      if ( __.isArray(v) ) {
         for(var i=0;i<v.length;i++) {
            if (__.isArray(v[i])) {
               var ae1 = []
               for(var j=0;j<v[i].length;j++) {
                  //[ [ "string", "string" ] ]
                  if (__.isString(v[i][j]) ) {
                     rv.push(timelist(v[i][j]))
                  } else {
                     ae1.push(v[i][j])
                  } 
               }
               if ( ae1.length != 0 ) {
                  rv.push(ae1)
               }
            } else if (__.isString(v[i])) {
               // [ "string" ]
               rv.push(timelist(v[i]))
            } else {
               // [ 43, 54 ]
               ae.push(v[i])
            }
         }
      } else if ( __.isString(v) ) {
         rv.push( timelist(v) )
      } else {
         ae.push(v)
      }

      if ( ae.length != 0 ) {
         rv.push(ae)
      }
   }


   return co
}


// extract note
function extnote(clip) {
   if (clip.length==0)
      return []

   var ret = [ ]
   var tmp = [ clip[0][1] ]
   var lasttm = clip[0][0]

   for(i=1;i<clip.length;i++) {
      if (lasttm == clip[i][0] ) {
         tmp.push(clip[i][1])
      } else {
         if (tmp.length == 1) {
            ret.push(tmp[0])
         } else {
            ret.push(tmp)
         }
         tmp = [ clip[i][1] ]
         lasttm = clip[i][0]
      }
   }
   if (tmp.length == 1) {
      ret.push(tmp[0])
   } else {
      ret.push(tmp)
   }   
   return ret
}


// extract time
function exttm(clip) {
   if ( clip.length == 0 )
      return []

   var lasttm = clip[0][0]
   var ret = [ lasttm ]
   for(i=1;i<clip.length;i++) {
      if (lasttm != clip[i][0]) {
         lasttm = clip[i][0]
         ret.push(lasttm)
      }
   }
   return ret
}


// extract rhythm 
function extrhythm(clip) {
   if(clip.length==0)
      return []

   ret = {}
   for(i=0;i<clip.length;i++) {
      tm = clip[i][0]
      nt = clip[i][1]
      if (__.isUndefined(ret[tm])) { 
         ret[tm] = [ nt ]
      } else {
         ret[tm].push(nt)
      }
   }
   return ret
}


// adds the value of 'v' to all the elements in the 'lst' array
function addl(v, lst) {
   for(var i=0;i<lst.length;i++)
      lst[i] += v
   return lst
}


// multiply the value of 'v' to all the elements in the 'lst' array
function mull(v, lst) {
   for(var i=0;i<lst.length;i++)
      lst[i] *= v
   return lst
}


// randomly chooses an element in 'lst', puts the result in returned array 
// 'times' times.
function choose(times, lst, prob) {
   var ret = []

   if(__.isUndefined(prob)) { 
      for (var i = 0; i < times; i++) {
         ret.push(lst[__.random(0, lst.length - 1)])
      }
   } else {
      if ( prob.length < lst.length ) {
         for(var i=lst.length-prop.length;i<lst.length;i++) {
            prob.push(0.5)
         }
      }
      for (var i=0;i<times;i++) {
         tmp = prob.slice(0)
         __.map(tmp, function(x) { return Math.random() + x })
         ret.push(lst[__.indexOf(tmp, __.max(tmp))])
      }
   }
   return ret;
}


/**
 * Iterators are use to iterate over a list. It is a object and they 
 * 
 * Iterator(lst) - constructor, takes a list
 * Iterator.next - returns the next element, null if N/A
 * Iterator.peek - returns the next element but doesn't iterate the object, null if N/A
 */
function IterLoop(lst) {
   this.i = -1;
   this.lst = lst
}
IterLoop.prototype.next = function () {
   if (++this.i >= this.lst.length) {
      this.i = 0
   }
   return this.lst[this.i]
}

function IterLoopTm(lst, end) {
   if (__.isUndefined(end) || __.isNaN(end)) {
      end = -1
   }

   // tries to calculate the end of the loop point
   if (end == -1) {
      if (lst[lst.length - 1] < 0) {
         end = lst[lst.length - 1] * -1
         // remove the list length 
         lst.pop()
      } else {
         work = lst.slice(0)
         work.sort()
         work = __.uniq(lst)
         if (work.length > 1) {
            l1 = work.pop()
            l2 = work.pop()
            end = l1 + (l1 - l2)
         } else {
            l1 = work.pop()
            if (l1 == 0) {
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
IterLoopTm.prototype.next = function () {
   if (++this.i >= this.lst.length) {
      this.i = 0
      this.looped++
   }
   return this.lst[this.i] + (this.looped * this.end)
}
IterLoopTm.prototype.peek = function () {
   i2 = this.i + 1
   if (i2 < this.lst.length) {
      return this.lst[i2] + (this.looped * this.end)
   } else {
      return this.lst[0] + ((this.looped + 1) * this.end)
   }
}


function IterLast(lst) {
   this.i = -1;
   this.lst = lst;
}
IterLast.prototype.next = function () {
   if (++this.i >= this.lst.length) {
      this.i--
   }
   return this.lst[this.i]
}

function IterDone(lst) {
   this.i = -1;
   this.lst = lst;
}
IterDone.prototype.next = function() {
    if ( ++this.i >= this.lst.length) {
        return null
    }
    return this.lst[this.i]
}


function render_array(a) {
   ret = "["
   f1 = ""
   for (i = 0; i < a.length; i++) {
      if (__.isArray(a[i])) {
         ret += f1 + "["
         f2 = ""
         for (j = 0; j < a[i].length; j++) {
            if ( __.isArray(a[i][j])) {
               ret += f2 + "["
               f2 = ""
               for(k=0;k < a[i][j].length; k++) {
                  ret += f2 + a[i][j][k]
                  f2 = ", "
               }
               f2 = ", "
               ret += "]"
            } else { 
               ret += f2 + a[i][j]
               f2 = ", "
            }

         }
         ret += "]"
      } else {
         ret += f1 + String(a[i])
      }
      f1 = ", "
   }
   return ret + "]"
}

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

//     Underscore.js 1.4.2
//     http://underscorejs.org
//     (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var push             = ArrayProto.push,
      slice            = ArrayProto.slice,
      concat           = ArrayProto.concat,
      unshift          = ArrayProto.unshift,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
      __ = _;
      exports = module.exports = __;
    }
    exports._ = _;
  } else {
    root['_'] = _;
  }


  // Current version.
  _.VERSION = '1.4.2';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    return results;
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError('Reduce of empty array with no initial value');
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return arguments.length > 2 ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError('Reduce of empty array with no initial value');
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    each(obj, function(value, index, list) {
      if (!iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    var found = false;
    if (obj == null) return found;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    found = any(obj, function(value) {
      return value === target;
    });
    return found;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    return _.map(obj, function(value) {
      return (_.isFunction(method) ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // with specific `key:value` pairs.
  _.where = function(obj, attrs) {
    if (_.isEmpty(attrs)) return [];
    return _.filter(obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See: https://bugs.webkit.org/show_bug.cgi?id=80797
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        index : index,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index < right.index ? -1 : 1;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(obj, value, context, behavior) {
    var result = {};
    var iterator = lookupIterator(value);
    each(obj, function(value, index) {
      var key = iterator.call(context, value, index, obj);
      behavior(result, key, value);
    });
    return result;
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key, value) {
      (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
    });
  };

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key, value) {
      if (!_.has(result, key)) result[key] = 0;
      result[key]++;
    });
  };

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (obj.length === +obj.length) return slice.call(obj);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    each(input, function(value) {
      if (_.isArray(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(concat.apply(ArrayProto, arguments));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(args, "" + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, l = list.length; i < l; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, l = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Binding with arguments is also known as `curry`.
  // Delegates to **ECMAScript 5**'s native `Function.bind` if available.
  // We check for `func.bind` first, to fail fast when `func` is undefined.
  _.bind = function bind(func, context) {
    var bound, args;
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, throttling, more, result;
    var whenDone = _.debounce(function(){ more = throttling = false; }, wait);
    return function() {
      context = this; args = arguments;
      var later = function() {
        timeout = null;
        if (more) {
          result = func.apply(context, args);
        }
        whenDone();
      };
      if (!timeout) timeout = setTimeout(later, wait);
      if (throttling) {
        more = true;
      } else {
        throttling = true;
        result = func.apply(context, args);
      }
      whenDone();
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) result = func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var values = [];
    for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var pairs = [];
    for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        if (obj[prop] == null) obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent, but `Object`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                               _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
        return false;
      }
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return _.isNumber(obj) && isFinite(obj);
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + (0 | Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named property is a function then invoke it;
  // otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return null;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });
      source +=
        escape ? "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'" :
        interpolate ? "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'" :
        evaluate ? "';\n" + evaluate + "\n__p+='" : '';
      index = offset + match.length;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);
/*Array.prototype.rotate = function(n) {
    return this.slice(n, this.length).concat(this.slice(0, n));
}*/

//
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
// ----------------------------------------------------------------------------
// mocha tests
// (c) Pascal Gauthier 2013, under the CC BY-SA 3.0
//
var assert = require("assert")

function arrays_equal(a,b) { 

	if ( !(__.isArray(a) && __.isArray(b)) ) {
		console.log(a, "??", b)
		return false
	}

	var ret = !(a<b || b<a)
	if ( ret )
		return ret
	console.log(a, "!=", b)
	return ret
}

_gsClipStart = 0
_gsClipEnd = 4

// y = [ mkp( "0:0.75", choose(4, [ 60, 62, 64, 66]) ), mkp("0", "E2") ]
// console.log(render_array(y))

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
		var x = notelist("C-2:C3:C#3")
		assert.equal(0, x[0])
		assert.equal(60, x[1])
		assert.equal(61, x[2])
	})

	it('should return the right chords', function() {
		var x = notelist("C3M:C3M^3:%^37:C3M>>")
		assert.ok(arrays_equal([60, 64, 67], x[0]))
		assert.ok(arrays_equal([64, 67, 71], x[1]))
		assert.ok(arrays_equal([64, 67, 71, 74], x[2]))
		assert.ok(arrays_equal([72, 76, 67], x[3]))
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


describe('compile_rhythm', function() {
	it('should return notes with rhythms', function() {
		var x = compile_rhythm({ 
		 	"C3" : [ ["0:1:-3"] ],
		 	"C#3" : "0:1:-3",
		 	"D3" : [ "0:1:-3" ],
		 	"D#3" : [ 0, 1, -3 ],
		 	"E3" : [ [ 0, 1, -3] ]
		})
		assert.ok(arrays_equal(x["60"][0], [0, 1, -3]))
		assert.ok(arrays_equal(x["61"][0], [0, 1, -3]))
		assert.ok(arrays_equal(x["62"][0], [0, 1, -3]))	
		assert.ok(arrays_equal(x["63"][0], [0, 1, -3]))	
		assert.ok(arrays_equal(x["64"][0], [0, 1, -3]))	

	})
})

describe('mkr', function() {
	it('should return the correct rhythm', function() {
		var x = mkr({ 
			"C3" : [ ["0:1:-3"] ] 
		})
		//console.log("\n")
		//console.log(x)


		console.log(x)
		//assert.ok(array_equal(x["60"][0], [0, 1, -3]))
	})
})

describe('choose', function() {
	it('should return 4 different values', function() {
		var x = choose(4, [60, 63, 65, 66])
		assert.equal(x.length, 4)
		var x = choose(4, [60, 63, 65, 66], [0.2, 0.5, 0.5, 0.9])
		assert.equal(x.length, 4)

	})
})

describe('degree', function() {
	it('should return correct deggree', function() {
		var x = degree(1, modes["ionian"])
		assert.ok(arrays_equal([ 0, 4, 7], x))
		
		x = degree(3, modes["ionian"])
		assert.ok(arrays_equal([ 4, 7, 11 ], x))

		x = degree(2, modes["ionian"]) 
		assert.ok(arrays_equal([2, 5, 9], x))
	})

})

describe('invert', function() {
	it('should return the array unchanged', function() {
		var x = inverter([0, 4, 7], 0)
		assert.ok(arrays_equal([0, 4, 7], x))
	})

	it('should invert chord correctly', function() {
		var x = inverter([0, 4, 7], -2) 
		assert.ok(arrays_equal([0, -8, -5], x))
		var x = inverter([0, 4, 7], 2) 
		assert.ok(arrays_equal([12, 16, 7], x))
	})

})

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

