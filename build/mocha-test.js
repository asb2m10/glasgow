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
      n = [Number(k)]
      for(var i=0;i<r[k].length;i++) {
         ret = ret.concat(mkp(r[k][i], n, velo, _gsClipQtz, start, end))
      }
   }
   return ret;
}


// replace rhythm: takes the current clip value rhythm and only replace the notes 
// that are used in the new rhythm.
function rmrk(r, velo, start, end, raw_clip) {
   if ( __.isUndefined(raw_clip) ) {
      if ( undo_buffer.length > 0 )
         raw_clip = undo_buffer[under_buffer.length-1]
      else
         raw_clip = []
   }
   target = extrhythm(raw_clip)
   r = compile_rhythm(r)

   for(var k in r) {
      target[k] = r[k]
   }

   return mkr(target, velo, start, end)
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
      return {}

   ret = {}
   for(i=0;i<clip.length;i++) {
      tm = clip[i][0]
      nt = clip[i][1]
      if (__.isUndefined(ret[nt])) { 
         ret[nt] = [ tm ]
      } else {
         ret[nt].push(tm)
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

//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.
  var root = typeof self == 'object' && self.self === self && self ||
            typeof global == 'object' && global.global === global && global ||
            this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push = ArrayProto.push,
    slice = ArrayProto.slice,
    toString = ObjProto.toString,
    hasOwnProperty = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray = Array.isArray,
    nativeKeys = Object.keys,
    nativeCreate = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for their old module API. If we're in
  // the browser, add `_` as a global object.
  // (`nodeType` is checked to ensure that `module`
  // and `exports` are not HTML elements.)
  if (typeof exports != 'undefined' && !exports.nodeType) {
    if (typeof module != 'undefined' && !module.nodeType && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      // The 2-parameter case has been omitted only because no current consumers
      // made use of it.
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // `identity`, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };

  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
  // This accumulates the arguments passed into an array, after a given index.
  var restArgs = function(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0);
      var rest = Array(length);
      for (var index = 0; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object.
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  var createReduce = function(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    var reducer = function(obj, iteratee, memo, initial) {
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      if (!initial) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = restArgs(function(obj, method, args) {
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  });

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection.
  _.shuffle = function(obj) {
    return _.sample(obj, Infinity);
  };

  // Sample **n** random values from a collection using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
    var length = getLength(sample);
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    for (var index = 0; index < n; index++) {
      var rand = _.random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    return sample.slice(0, n);
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        criteria: iteratee(value, key, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior, partition) {
    return function(obj, iteratee, context) {
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (_.isString(obj)) {
      // Keep surrogate pair characters together
      return obj.match(reStrSymbol);
    }
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = group(function(result, value, pass) {
    result[pass ? 0 : 1].push(value);
  }, true);

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    output = output || [];
    var idx = output.length;
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // Flatten current level of array or arguments object
        if (shallow) {
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        } else {
          flatten(value, shallow, strict, output);
          idx = output.length;
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = restArgs(function(array, otherArrays) {
    return _.difference(array, otherArrays);
  });

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = restArgs(function(arrays) {
    return _.uniq(flatten(arrays, true, true));
  });

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = restArgs(function(array, rest) {
    rest = flatten(rest, true, true);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  });

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = restArgs(_.unzip);

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  var createPredicateIndexFinder = function(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  };

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Split an **array** into several arrays containing **count** or less elements
  // of initial array
  _.chunk = function(array, count) {
    if (count == null || count < 1) return [];

    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = restArgs(function(func, context, args) {
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArgs(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  _.partial = restArgs(function(func, boundArgs) {
    var placeholder = _.partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

  _.partial.placeholder = _;

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = restArgs(function(obj, keys) {
    keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = _.bind(obj[key], obj);
    }
  });

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = restArgs(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  });

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var timeout, context, args, result;
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };

    throttled.clear = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    return throttled;
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;

    var later = function(context, args) {
      timeout = null;
      if (args) result = func.apply(context, args);
    };

    var debounced = restArgs(function(args) {
      var callNow = immediate && !timeout;
      if (timeout) clearTimeout(timeout);
      if (callNow) {
        timeout = setTimeout(later, wait);
        result = func.apply(this, args);
      } else if (!immediate) {
        timeout = _.delay(later, wait, this, args);
      }

      return result;
    });

    debounced.clear = function() {
      clearTimeout(timeout);
      timeout = null;
    };

    return debounced;
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  _.restArgs = restArgs;

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  };

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = _.keys(obj),
      length = keys.length,
      results = {};
    for (var index = 0; index < length; index++) {
      var currentKey = keys[index];
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
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

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      if (defaults) obj = Object(obj);
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Internal pick helper function to determine if `obj` has key `key`.
  var keyInObj = function(value, key, obj) {
    return key in obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = restArgs(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      keys = _.allKeys(obj);
    } else {
      iteratee = keyInObj;
      keys = flatten(keys, false, false);
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  });

   // Return a copy of the object without the blacklisted properties.
  _.omit = restArgs(function(obj, keys) {
    var iteratee = keys[0], context;
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
      if (keys.length > 1) context = keys[1];
    } else {
      keys = _.map(flatten(keys, false, false), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  });

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
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

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq, deepEq;
  eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // `NaN`s are equivalent, but non-reflexive.
    if (a !== a) return b !== b;
    // Exhaust primitive checks
    var type = typeof a;
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    return deepEq(a, b, aStack, bStack);
  };

  // Internal recursive comparison function for `isEqual`.
  deepEq = function(a, b, aStack, bStack) {
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
  var nodelist = root.document && root.document.childNodes;
  if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
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
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, prop, fallback) {
    var value = object == null ? void 0 : object[prop];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var chainResult = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return chainResult(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return chainResult(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return chainResult(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define == 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}());
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
			ruler = ruler.slice(swing, ruler.length).concat(ruler.slice(0, swing));
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

// hack to support underscore in max/msp and node.js :(
__ = _