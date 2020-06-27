2020-06

- minor adjustment as preparation for newer @quasar/app version
- spent quite some time with the q-window extension but was taking too much time to make
  it work (along with mxm), probably because of the extension-using-extension aspect(?)

2019-11

- starting to "normalize" feature to make handling more consistent
- for convenience at the moment, simplify editing logic: 
  include most edit/draw options in general and delegate on client 
  for any further restrictions
- conditional inclusion of google map layers: 
  dependent on google already available or via script with given apikey
- emit editsApplied
- add closable to coords-table
- add selectEntry
- allow to indicate initial base layer name
- for now, use L.Circle instead of L.Marker due to issue
- use a seamless dialog for the coords-table
- allow to add geometry
- preparing to handle: editing existing geometry and adding a new geometry
- edit radius in coords-table
- reflect feature update when edited from coords-table
- include coords-table - preliminary
- initial commit
