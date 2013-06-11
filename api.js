// API
_gsVersion = 0.2

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

// The last selected octave
var _gsLastOctave = 5


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
      throw "got stuck in a loop in mkp. See your iterators: " + i
   }

   return ret
}


function timelist(tm) {
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


// note format: notename mode degre voices (<< >> inversion)
//
// D-3M0^7<< : %3> : %1^7^13
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

   for(var i=0;i<str.length;i++) {
      var cur=str[i]
      switch(state) {
         case 0 :
            switch(cur) {
               case '%' :
                  z = _gsLastNote
                  m = _gsLastMode
                  state = 3
               break;
               case 'D' : z = 2; state=1; break
               case 'E' : z = 4; state=1; break
               case 'F' : z = 5; state=1; break
               case 'G' : z = 7; state=1; break
               case 'A' : z = -3; state=1; break
               case 'B' : z = -1; state=1; break
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
            if (cur==' ') {
               if ( buff.length != 0 ) {
                  m = buff.join('')
                  _gsLastMode = m
                  buff = []
               }
               break
            }         
            if (ischar(cur)) {
               buff.push(cur)
               break
            } 

            if (cur == '^') {
               // parse chord name
               buff = []
               state = 3
               break;
            } 

            if (isnum(cur)) {
               // jump to voicing
               buff = [ cur ] 
               state = 5
               break;
            }

            buff.push(cur)
            m = buff.join('')
            _gsLastMode = m
            
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


   if ( v.length == 0 )
      v = null

   var notes = degree(d, m, v)
   inverter(notes, inv)
   addl(z, notes)

   chord.push(notes)
}


function notelist(note) {
   var note = note.toUpperCase()
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

function addl(v, lst) {
   for(var i=0;i<lst.length;i++) {
      lst[i] = lst[i] + v
   }
}

function choose(times, lst) {
   var ret = []
   for (var i = 0; i < lst.length; i++) {
      ret.push(lst[__.random(0, lst.length - 1)])
   }
   return ret;
}

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
