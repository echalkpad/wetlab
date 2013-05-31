/**
 * A wrapper for the methods to access the persistent data (about sensors and recordings)
 */

 var cradle = require('./modules/cradle');
 
 module.exports = function Data() {
 
 	this.connection = new(cradle.Connection)('http://localhost', 5984);
 
	this.db = this.connection.database('bioturk');
	
	this.db.save('_design/recordings', {
	    views: {
	      raw: {
	        map: "function (doc) { if (doc.type == 'raw_recording')  { emit(doc.startTime, doc) } }"
	      },
	      processed: {
	        map: "function (doc) { if (doc.type == 'processed_recording')  { emit(doc.startTime, doc) } }"
	      }
	    }
	  });	
 
 	/*
 	 * getSensorData  -  Fetch the configurations of the known sensors
 	 */
 	this.getSensorData = function(f) {
 	        this.db.get('sensors', function (err, doc) {
 	        	f(err,doc);
            });
 	}
 
 	/*
 	 * saveRawRecording  -  Save the info about a recording that has not been processed yet
 	 */
 	this.saveRawRecording = function(currentRecording, f) {
 	currentRecording.type = "raw_recording";
 	  this.db.save(currentRecording, function (err, res) {
	      if (err) {
	          console.log("Uh oh, something bad happened....");
	      }
        f();
	  });
 	}

 	/*
 	 * getRawRecordings  -  Fetch the list of recordings that haven't been cooked yet
 	 */
 	this.getRawRecordings = function(f) {
	      this.db.view('recordings/raw', { }, function (err, doc) {	    
        	f(err,doc);
		  });
	} 
	
	this.deleteRawRecordings = function(f) {
		var db = this.db;
		this.getRawRecordings(function (err, doc) {
			for (var i=0; i<doc.length; i++) {
				// delete each doc.
				var id = doc[i].id;
				var rev = doc[i].value._rev;
				db.remove(id,rev, function (err, doc) {
								console.log("Deleted: " + id);
							});
				
			}
		});
				
		f();
	}	
 
 
 }
 