The programs in these subdirectories all behave the same:
  - They run from the command line (no GUIs)
  - The write their sensed data to a local file
  - They listen on STDIN for the string 'STOP'
  - On hearing stop, they print their name, the name of the data file (including hostname) and a status message. As in:
      CAM_CLOSE	/projects/bioturk/tmpdata/recording69.tar	"669 frames collected"


  A sample "sensor" is in the sample_sensor folder.
