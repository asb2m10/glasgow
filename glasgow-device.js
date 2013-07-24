// ----------------------------------------------------------------------------
// the Max/MSP device file
// (c) Pascal Gauthier 2013, under the CC BY-SA 3.0
//

inlets = 1
outlets = 2

// the value of code window in max
var current_code = ""

// THIS PORTION IS CALLED BY MAX (with the first letter of the function in upper case)

// called by max to update the textedit containing the code value
function UpdateCode(code, text) {
   if (_.isUndefined(text))
      return
   if (text.charAt(0) == '"') {
      text = code.substring(1, text.length - 1)
   }
   current_code = text
}


// Get the currently selected clip and paste it's value in the clip field.
function GetClip() {
   fillGlobalVar()
   var content = getclip_content()

   if ( _.isString(content) ) {
      glasgow_error(content)
      return
   }

   _gsLastGetClip = content
   var first = ""
   var ret = "["
   for(var i=0;i<_gsLastGetClip.length;i++) {
         ret = ret + first + "[" + _gsLastGetClip[i][0] + ", " + _gsLastGetClip[i][1] + ", " + _gsLastGetClip[i][2] + ", " + _gsLastGetClip[i][3] + "]"
         first = ",\n"
   }
   ret = ret + "]"
   outlet(1, 'set', ret)

   glasgow_info("GetClip successful")
}


// Evaluate the code window and update the clip content with this array
function PutClip() {
   var out = evalcode()
   if (out == null)
      return;

   if (!_.isArray(out)) {
      glasgow_error("Code didn't returned an array")
      return;
   }
   if (out.length == 0) {
      glasgow_error("Array is empty")
      return;
   }

   out = flatten_event(out)
   out = validateclip_content(out)
   if ( _.isString(out) ) {
      glasgow_error(out)
      return;
   }
   
   if (undo_buffer.length > 30)
      undo_buffer.shift()
   undo_buffer.push(getclip_content())
   out = putclip_content(out)

   glasgow_info("PutClip successful")
}


// Evaluate the code window and return the result in the status. If it is an
// array, it will be put in the "clip" field
function Evaluate() {
   out = evalcode()
   if (out == null)
      return;

   outstr = String(out)
   if (_.isNumber(out)) {
      glasgow_info("Result: " + outstr)
      return;
   }

   if (_.isString(out)) {
      glasgow_info("Result: " + outstr)
      return;
   }

   if (_.isArray(out)) {
      outlet(1, "set", render_array(out))
      glasgow_info("The array is put in clip field")
      return;
   }
   glasgow_error("Unkown type")
}


// replace the content of the current selected clip with the content that was in the 
// clip before "PutClip" was called.
function Undo() {
   glasgow_info(undo_putclip())
}


// If the user wants to add extra library
// not implemented yet. 
function LoadLib() {
   folder = new Folder("glasgow-lib");

   folder.typelist = ["TEXT"];

   while (!folder.end) {
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


function evalcode() {
   fillGlobalVar()
   try {
      /* undocumented feature, if it starts with ( it is considered a
         lisp snippet 
      if ( current_code.charAt(0) == '(') {
         glasgow_info("using lisp engine to parse snippet")
         out = interpret(current_code)
      } else {*/
         out = eval(current_code)
      /*}*/
   } catch (err) {
      glasgow_error(String(err))
      out = null
   }
   return out
}


function glasgow_info(msg) {
   post(msg + "\n")
   outlet(0, "textcolor", "0", "0", "0", "1")
   outlet(0, "set", msg)
}


function glasgow_error(msg) {
   error(msg + "\n")
   outlet(0, "textcolor", "255", "0", "0", "1")
   outlet(0, "set", msg)
}


function flatten_event(lst) {
   var ret = new Array()
   for(var i=0;i<lst.length;i++) {
      if ( __.isArray(lst[i]) ) {

         if ( __.isArray(lst[i][0]) ) {
            for(var j=0;j<lst[i].length;j++) {
               ret.push(lst[i][j])
            }
         } else {
            ret.push(lst[i])
         }
      } 
   }
   return ret;
}
