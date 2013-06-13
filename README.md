glasgow
=======

Glasgow is a tool to manipulate Ableton Live clips by using Javascript (with Max For Live).


time format
-----------
Time format is the same used in Ableton Live: 0.25 is one quarter note (with 4/4). String format
can also be used to defined values that are not "floating friendly" like 1.1/3. Events are
seperated by the ':' character :

    timelist("0.1/3:0.5:1.1/4") == [ 0.33333333333, 0.5, 1.25 ]

note format
-----------
Note value are analogous to midi notes. You can use notelist() helper to parse a string that will
render the values into a javascript array. The string format: the lowest midi note is C-2 
(C minus 2; the midi note 0) and the highest G8. Sharp values contains the '#' between the
note name and the octave: C#1. Like the time format, events are separated by the ':'
character. Notes that occurs at the same time can be separated by the ',' character.

Note string format can also support chords definition. Any letter that follows the octave
value of the note defines the scale/mode of the chords. 'M' represent the major scale, 
'm' the minor; you can also use the mode name EG: 'ionian'. If the character '^' (for degree) 
follows the mode name, it will shift the chord to a specific degree. If there is another
number, it defines the voicing of the chord. 7 means to add the 7th to the chord. If you
need the 7th and 13th, you can use the '-' separator. Afterwards, if the '&amp;' is present,
it means that the chords generation is in the restriced class; that all the notes generated
stays in the same octave. The '< (for down)' and '> (for up)' is used for chord inversion.
If you start a new note with '%' it will reassign the last note and mode selected.

       note name
       |   mode name 
       |   |   chord degree value
       |   |   |   forces the chord to be in same octave
       |   |   |   | 
       C 3 M ^ 3 7 & >>
       | |   |   |   | 
       | |   |   |   tells the invertions of the chords
       | |   |   add the 7th to the chord
       | |   forces the parser to also read chord degree (I, ii, III, iv ....)
       | octave value

      notelist("C3:C3M:%^37:%<<"") == [ 60, [60, 64, 68], [64, 67, 71, 76], [60, 52, 56] ]

api 
---
mkp([event timestamp], [list of notes], [list velocity], [list duration]) - Used to make a phrase.

* It uses the time and note format (in both list of float/int or a string).
* If all the event have been used for a particular type (timestamp, midinote, velocity or duration), 
it loops the list the ended.
* mkp will loop the events based on the clip loop point. It gets the information
from the global variable _gsClipStart and _gsClipEnd (that gets sets when you use the [GetClip] 
button in M4L). 
* If in the last item in the timestamp list is smaller than zero or negative, it tells mkp what
is the desired loop size. For example a list with [ 0, 0.5, -2 ] will render event like this :
[0, 0.5, 2, 2.5, 4, 4.5 ...]
* If an item duration is set to 0, the duration of the event will be based on the global 
variable _gsClipQtz. (if the M4L API was available, it we get the value from the quantize size, 
but right now it is statically set to 0.125)
* If the item duration is negative, it will set the event duration based on time when the next 
event will be played.

timelist([string format]) - Used to render a string timelist into a javascript array 
(see timeformat)

notelist([string format]) - Used to render a string notelist into a javascript array
(see noteformat)

addl([value to add], [list of numbers]) - add the specified value to all the element in the list

choose([times], [list of item]) - chooses an item in the list, for (x) times and return the result
into a new array

interface protocol
------------------
The interface that is used to get or set a Abelton Live clip is a simple array :

     [ [ event_timestamp, note_midivalue, notevelo_midivalue, note_duration], ... 
     ]

changelog
---------
#### Version 0.2 ####
- Added chord functionality
- String note value are now based on the Live numbering for the octave (from C-2 to B9)