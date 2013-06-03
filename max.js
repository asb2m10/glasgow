inlets = 1
outlets = 2

undo_buffer = new Array();

current_code = ""

function anything(sym, args) {
  if ( _.isUndefined(sym) ) 
    return
  if ( sym.charAt(0) == '"') {
    sym = sym.substring(1, sym.length-1 )
  }
	current_code = sym
}


function GetClip() {
    fillGlobalVar()
    api = new LiveAPI("live_set view detail_clip");
    selected = api.call("select_all_notes");
    rawNotes = api.call("get_selected_notes");

    if (rawNotes[0] !== "notes") {
      glasgow_error("Unexpected note output!");
      return;
    }

    ret = "["
    first = ""    

    maxNumNotes = rawNotes[1];

    for (i = 2; i < (maxNumNotes * 6); i += 6) {
      var note = rawNotes[i + 1]
      var tm = rawNotes[i + 2]
      var dur = rawNotes[i + 3]
      var velo = rawNotes[i + 4]
      var muted = rawNotes[i + 5] === 1

      // if this is a valid note
      if ( rawNotes[i] === "note" && _.isNumber(note) && _.isNumber(tm) && _.isNumber(dur) && _.isNumber(velo) ) {
      	ret = ret + first + "[" + tm + ", " + note + ", " + velo + ", " + dur + "]"
        first = ",\n"
      } else {
       	glasgow_error("unkown note returned by Live")
        return
      }
    }
    ret = ret + "]"
    push_undo()     
	  outlet(1, "set", ret)
    glasgow_info("GetClip successful")
}

function evalcode() {
  fillGlobalVar()
  try { 
    out = eval(current_code)
  } catch (err) {
    glasgow_error(String(err))
    out = null
  }
  return out 
}


function PutClip() {
  var out = evalcode()
  if ( out == null )
    return;

  if ( ! _.isArray(out) ) {
    glasgow_error("evaluation is not a array")
    return;
  }
  if ( out.length == 0 ) {
    glasgow_error("array is empty")
    return;
  }

  var success=1

  var out = _.flatten(out, true)
  var api = new LiveAPI("live_set view detail_clip");
  api.call("select_all_notes");
  api.call("replace_selected_notes");   
  api.call("notes", out.length)
  for(i=0;i<out.length;i++) {
    if ( out[i].length != 4 ) {
      glasgow_info(out)
      glasgow_error("skipping content of wrong size, index: " + i)
      success=0
    }

    // pitch time duration velocity muted
    tm = Number(out[i][0]).toFixed(12)
    note = out[i][1]
    velo = out[i][2]
    dur = Number(out[i][3]).toFixed(12)

    if ( _.isNaN(tm) ) {
      glasgow_error("wrong time defined : " + tm + ", index: " + i)
      success=0
      continue;
    }

    if ( _.isNaN(note) ) {
      glasgow_error("wrong note defined : " + note + ", index: " + i)
      success=0
      continue;
    }

    if ( _.isNaN(velo) ) {
      glasgow_error("wrong velocity defined : " + velo + ", index: " + i)
      success=0
      continue;
    }

    if ( _.isNaN(dur) ) {
      glasgow_error("wrong duration defined : " + dur + ", index: " + i)
      success=0
      continue;
    }    

    ln = [ "note", note, tm, dur, velo, 0]
    api.call(ln)
  }
  api.call("done")
  if ( success == 1 ) {
    glasgow_info("PutClip successful")
  }
}

function render_array(a) {
  ret =  "["
  f1 = ""
  for(i=0;i<a.length;i++) {
    if ( _.isArray(a[i]) ) {
      ret += f1 + " ["
      f2 = ""
      for(j=0;j<a[i].length;j++) {
        ret += f2 + a[i][j]
        f2 = " ,"
      } 
      ret += "]"
    } else {
      ret += f1 + String(a[i])
    }
    f1 = " ,\n"
  }
  glasgow_info(ret)
  return ret + "]"
}


function Evaluate() {
  out = evalcode()
  if ( out == null )
    return;  

  outstr = String(out)
  if ( _.isNumber(out) ) {
    glasgow_info("result: " + outstr)
    return;
  }

  if ( _.isString(out) ) {
    glasgow_info("result: " + outstr)
    return;
  }

  if ( _.isArray(out) ) {
   push_undo()
   outlet(1, "set", render_array(out))
   glasgow_info("done changed")
   return;
 }
 glasgow_error("unkown type")

}


function Undo() {
  if ( undo_buffer.length > 0 ) {
    undo_content = undo_buffer.pop()
    outlet(1, "set", undo_content)
  }
}


function push_undo() {
  if ( undo_buffer.length > 30 )
    undo_buffer.shift()
  if ( undo_buffer.length != 0 ) {
    tst_last = undo_buffer.pop()
    undo_buffer.push(tst_last)
    if ( tst_last != current_code )
      undo_buffer.push(current_code)
  } else {
      undo_buffer.push(current_code)
  }
}

/**
 * Will work in the future 
 */
function LoadLib() {
  folder = new Folder("glasgow-lib");

  folder.typelist = [ "TEXT" ];

  while(!folder.end) {
    post(folder.filename + "\n")
    folder.next()
  }
  folder.close()

   /*post("loading file: " + filename)
   access = "read";
   typelist = new Array("iLaF" , "maxb" , "TEXT" );
   f = new File(filename, access, typelist);
   pgm = f.readstring(65535);
   interpret(pgm)
   f.close()  */
}

function fillGlobalVar() {
    api = new LiveAPI("live_set view detail_clip");
    _gsClipStart = api.get("loop_start")[0]
    _gsClipEnd = api.get("loop_end")[0]
}

function glasgow_info(msg) {
  error(msg + "\n")
  outlet(0, "textcolor", "0", "0", "0", "1")
  outlet(0, "set", msg)  
}

function glasgow_error(msg) {
  post(msg + "\n")
  outlet(0, "textcolor", "255", "0", "0", "1")
  outlet(0, "set", msg)  
}

__ = _

