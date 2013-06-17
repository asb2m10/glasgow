// ----------------------------------------------------------------------------
// the Glasgow API.
// (c) Pascal Gauthier 2013, under the CC BY-SA 3.0
//
// API version
var _gsVersion = 0.2

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


// render note (or chord)
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
 * Iterators are use to loop over a list.
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

