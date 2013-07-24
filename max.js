// ----------------------------------------------------------------------------
// the Max/MSP related interface
// (c) Pascal Gauthier 2013, under the CC BY-SA 3.0
//

var undo_buffer = []

function getclip_content() {
   fillGlobalVar()
   var api = new LiveAPI("live_set view detail_clip");
   var selected = api.call("select_all_notes");
   var rawNotes = api.call("get_selected_notes");

   if (rawNotes[0] !== "notes") {
      return "Unexpected note output!"
   }

   var newclip = []
   var maxNumNotes = rawNotes[1];

   for (var i = 2; i < (maxNumNotes * 6); i += 6) {
      var note = rawNotes[i + 1]
      var tm = rawNotes[i + 2]
      var dur = rawNotes[i + 3]
      var velo = rawNotes[i + 4]
      var muted = rawNotes[i + 5] === 1

      // if this is a valid note
      if (rawNotes[i] === "note" && _.isNumber(note) && _.isNumber(tm) && _.isNumber(dur) && _.isNumber(velo)) {
         newclip.push( [ tm, note, velo, dur ] )
      } else {
         return "unkown note returned by Live"
      }
   }

   /* Live doesnt return the events in a sorted order. We do: <3 underscore */
   newclip = __.sortBy(newclip, function(n) { n[0] })
   return newclip
}


// Validate the content of the Glasgow array; returns the array format in 
// Live format. Returns a string with the error if it was unable to parse
// the array.
function validateclip_content(clip) {
   var ret = []
   for (var i = 0; i < clip.length; i++) {
      if (clip[i].length != 4) {
         return "skipping content of wrong size, index:"  + i + "clip content: " + clip[i]
         break
      }

      // pitch time duration velocity muted
      var tm = Number(clip[i][0]).toFixed(12)
      var note = clip[i][1]
      var velo = clip[i][2]
      var dur = Number(clip[i][3]).toFixed(12)

      if (_.isNaN(tm)) {
         return "wrong time defined : " + tm + ", index: " + i
      }

      if (_.isNaN(note)) {
         return "wrong note defined : " + note + ", index: " + i
      }

      if (_.isNaN(velo)) {
         return "wrong velocity defined : " + velo + ", index: " + i
      }

      if (_.isNaN(dur)) {
         return "wrong duration defined : " + dur + ", index: " + i
      }         

      ret.push(["note", note, tm, dur, velo, 0])
   }
   return ret
}


// Put the array content into the clip; must be used with the validateclip_content
function putclip_content(clip) {
   var api = new LiveAPI("live_set view detail_clip");
   api.call("select_all_notes");
   api.call("replace_selected_notes");
   api.call("notes", clip.length)
   for (i = 0; i < clip.length; i++) {
      api.call(clip[i])
   }
   return api.call("done")
}


function undo_putclip() {
   if (undo_buffer.length > 0) {
      var lastclip = undo_buffer.pop()
      lastclip = validateclip_content(lastclip)
      lastclip = putclip_content(lastclip)
      return "Undo successful"
   } else {
      return "No content in undo buffer"
   }
}


function fillGlobalVar() {
   api = new LiveAPI("live_set view detail_clip");
   _gsClipStart = api.get("loop_start")[0]
   _gsClipEnd = api.get("loop_end")[0]

    if ( _.isUndefined(_gsClipStart) ) {
      _gsClipStart = 0
    }

    if ( _.isUndefined(_gsClipEnd) ) {
      _gsClipEnd = 4
    }   
}


function set_looppoint(start, end) {
   api = new LiveAPI("live_set view detail_clip");
   api.set("loop_start", [ start ])
   api.set("loop_end", [ end ])

   _gsClipStart = start
   _gsClipEnd = end
}

// hack to support underscore in max/msp and node.js :(
__ = _

