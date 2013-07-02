/**
 * Sensor  -- The functions that create the ssh connection to a remote sensor and then close them when finished
 */

var Join = require('join');
var http = require('http');
var Connection = require('./modules/ssh2');

module.exports = function Sensor() {

	// State we keep track of about the recording going on
	this.START_TIMEOUT = 10000;
	this.STOP_TIMEOUT  = 10000;
	
	this.sshDesc = {};  // text descriptions of the ssh sensors being recorded
	this.sshSensors = {}; // hashtable pointing to the callbacks and streams (internal stuff)	
	this.squidDesc = {}; // text descriptions of the squid sensors being recorded
	this.squidSensors = {}; // hashtable pointing to the callbacks and streams (internal stuff)
	this.sensorResults = {}; // hashtable pointing to errors and output (passed back to user)
	
	this.startTime = 0;
	this.endTime = 0;
	
	this.state = 'Idle';  // State is Idle, Preparing, Recording or Stopping
	this.sessionNum = 1;


	// prepareToStart  -- Call this first. This function resets the Join object we use for sycnronization
	this.prepareToStart = function() {
		this.join = Join();  // This is the new sync object
		this.state = 'Preparing';
		//### Should we check for errors if we're in the wrong state?
		this.sshDesc = {};
		this.sshSensors = {};
		this.sensorResults = {};
		
		this.squidDesc = {};
		this.squidSensors = {};
		console.log('*** Made join for syncing the start');
	}
	
	// Call this after prepareToStart. Call once for each ssh or squid sensor to be recorded
	this.addSensor = function(name,sensorSpec) {
		// An example of the sensor string: SSH,bicycle.cs.washington.edu,/homes/gws/lamarca/sample_sensor.py,A sample SSH sensor
		// Tease apart the string
		var v=sensorSpec.split(",");
		if (v[0] == 'SSH') {
			this.sshDesc[name] = v;
			return 1;
		} else if (v[0] == 'SQUID') {
			this.squidDesc[name] = v;
			return 1;
		} else {
			return 0;
		}
	}
	
	// Call this after all the sensors have been added. Once this is called adding new sensors won't do anything.
	this.start = function(stRenderFunc) {
		this.startTime = new Date().getTime();		
		// create the join objects for the ssh sensors to call back. No need to do anything for squids right now
		var cntAdded = 0;
		for (var key in this.sshDesc) {
  			if (this.sshDesc.hasOwnProperty(key)) {
    			//console.log(key + " -> " + this.sshDesc[key]);
    			this.sshSensors[key] = {};
    			this.sshSensors[key].done = 0;
    			this.sshSensors[key].callback = this.join.add();
    			cntAdded++;
    			this.sensorResults[key] = {};
    			this.sensorResults[key].output = '';
    			this.sensorResults[key].hadError = 0;
  			}
		}
		for (var key in this.squidDesc) {
  			if (this.squidDesc.hasOwnProperty(key)) {
    			this.sensorResults[key] = {};
    			this.sensorResults[key].output = '';
    			this.sensorResults[key].hadError = 0;
    		}
    	}
		
		if (cntAdded == 0) {  // No ssh sensors. So no need to wait for them to launch. It's all good right now
			this.state = 'Recording';
			this.sessionNum++;
			stRenderFunc(this.sensorResults);
			return;
		}
		
		var sensorMan = this;
		this.join.when(function() {
			if (sensorMan.state == 'Preparing') {
				sensorMan.state = 'Recording';
				sensorMan.sessionNum++;
				stRenderFunc(sensorMan.sensorResults);
			}
			});
			
		// Schedule a timeout so that we'll return a value if any of the "sensors" are non-responsive
		var stopIfSession = sensorMan.sessionNum;
	    setTimeout(function () {
	    	console.log("IN START TIMEOUT state = " + sensorMan.state  + " session is: " + sensorMan.sessionNum + " stopIf is " + stopIfSession);
		    if ((sensorMan.sessionNum == stopIfSession) && (sensorMan.state == 'Preparing')) {  // Start didn't complete
		    	console.log('Error: Start timed out and I needed to do something');
				sensorMan.sensorResults["error"] = {};
				sensorMan.sensorResults["error"].output = "Start recording timed out. That's bad.";
				sensorMan.sensorResults["error"].hadError = 1;
				sensorMan.state = 'Recording';  // let's assume some of the sensors worked...
				sensorMan.sessionNum++;
				stRenderFunc(sensorMan.sensorResults);
		    }
		}, sensorMan.START_TIMEOUT); 			
		
		// Now, for each ssh sensor, fork a network connection to talk to the sensor over ssh
		for (var key in this.sshDesc) {
  			if (this.sshDesc.hasOwnProperty(key)) {
				var c = new Connection();  // make a network connection
				this.sshSensors[key].connection = c;
				c.key = key;
  				c.host = this.sshDesc[key][1]; // per the format of the sensor description string
  				c.cmd = this.sshDesc[key][2];
  				c.args = this.sshDesc[key][3];
  				var sensorMan = this;
  				
  				// When the connection is ready, exec the remote command
				c.on('ready', function() {
				  var key = this.key;
				  var cmd = this.cmd;
				  console.log(key + ' Connection :: ready');
				  var rv = c.exec(this.cmd, function(err, stream) {
				    if (err) {
				    	throw err;
				    }
				    stream.on('data', function(data, extended) {
				      var strs=String(data).split('\n');
				      for (var i=0;i<strs.length;i++) {
				      var str = strs[i];
					      sensorMan.sensorResults[key].output = sensorMan.sensorResults[key].output + '|' + str;
					      if (extended == 'stderr') {
					      	// This isn't good.  Let's call it quits for this guy
					        sensorMan.sensorResults[key].hadError = 1;
					        sensorMan.sshSensors[key].callback();
					      } else {
					      	// Cool. Let's look at the output. 
					      	var v=String(str).split('\t');
					      	if ((v[0] == 'RECORDING') && (sensorMan.state == 'Preparing')) {  // Cool!  He's recording now!
					      		sensorMan.sshSensors[key].callback(); // let the join know we're all set
					      	} else if ((v[0] == 'DONE') && (sensorMan.state == 'Stopping')) { // Cool! We're all stopped 
					      		sensorMan.sshSensors[key].callback(); // let the join know we're all set
					      		sensorMan.sshSensors[key].done = 1;
					      	}
					      }
					    }
				    });
				    
				    // If we get to the end of the stream and the 
				    stream.on('end', function() {
				    	if (sensorMan.sshSensors[key].done == 1) {
				    	  // Cool. Just what's supposed to happen
				    	  return;
				    	}
				    	// Bad. We're not supposed to end here...
				      console.log(key + ' Stream :: EOF' + sensorMan.stopping);
				      // This is bad. We stopped prematurely
				      sensorMan.sensorResults[key].output = sensorMan.sensorResults[key].output + '|' + "Stream ended before we asked to stop it. Did it crash or does the command exist?";
				      sensorMan.sensorResults[key].hadError = 1;
				      sensorMan.sshSensors[key].callback();
				    });
				    
				    // let's remember the stream so we can send it a 'STOP' when it's time to be done
				    sensorMan.sshSensors[key].stream = stream;
				});
				});
				
				// On an error, remember it
				c.on('error', function(err) {
				  sensorMan.sensorResults[key].output = sensorMan.sensorResults[key].output + '|' + err;
				  sensorMan.sensorResults[key].hadError = 1;
				  sensorMan.sshSensors[key].callback();
				});
				
				// all set up, kick off the connection
				c.connect({
				  host: c.host,
				  port: 22,
				  username: 'bioturk',
				  privateKey: require('fs').readFileSync('openssh.key')
				});
			}
		}		
	}
	
	//****** Stop sensing.  Issue stop requests to the SSH sensors, initiate web fetches from the squid sensors
	this.stop = function(stRenderFunc) {
		// if we're not currently recording, this is bad
		if (this.state != 'Recording') {
			var error = {};
			error["error"] = {};
			error["error"].output = "Stop called when not recording. That's bad.";
			error["error"].hadError = 1;
			stRenderFunc(this.startTime, new Date().getTime(), error);
			return;
		}
		
		this.state = 'Stopping';
		this.join = Join();  // This is the new sync object
		
		// Kick off a request to shut off all the SSH streams
		for (var key in this.sshDesc) {
  			if (this.sshDesc.hasOwnProperty(key)) {
    			this.sshSensors[key].callback = this.join.add();
  			}
		}
		
		// We are going to submit an http request for each squid sensors. We'll wait for those to return as well
		for (var key in this.squidDesc) {
  			if (this.squidDesc.hasOwnProperty(key)) {
  				this.squidSensors[key] = {};
    			this.squidSensors[key].callback = this.join.add();
    			console.log("STASHED SQUID callback: " + key);
  			}
		}
		
		var sensorMan = this;
		this.join.when(function() {
			// This will be called once all of the callbacks have executed.
			if (sensorMan.state == 'Stopping') {
				sensorMan.cleanUpAndReturnResults(sensorMan,stRenderFunc);
			} else {
				console.log("Stop's join.when was called after it had left 'stopping' state. Oh well.");
			}
		});
			
		// Schedule a timeout so that we'll stop even if the processes are non-responsive
		var stopIfSession = sensorMan.sessionNum;
	    setTimeout(function () {
	    	console.log("IN STOP TIMEOUT state = " + sensorMan.state  + " session is: " + sensorMan.sessionNum + " stopIf is " + stopIfSession);
		    if ((sensorMan.sessionNum == stopIfSession) && (sensorMan.state == 'Stopping')) {  // Stop didn't work
		    	console.log('Error: Start timed out and I needed to do something');
				sensorMan.sensorResults["error"] = {};
				sensorMan.sensorResults["error"].output = "Stop timed out. Thats bad.";
				sensorMan.sensorResults["error"].hadError = 1;
				sensorMan.cleanUpAndReturnResults(sensorMan,stRenderFunc);
		    }
		}, sensorMan.STOP_TIMEOUT); 			

	    // send a 'stop' to each of the ssh sensors
		for (var key in this.sshDesc) {
  			if (sensorMan.sshDesc.hasOwnProperty(key)) {
  				sensorMan.sshSensors[key].stream.write('stop\n'); // tell the SSH sensor to stop
  			}
  		}
		for (var key in this.squidDesc) {
  			if (sensorMan.squidDesc.hasOwnProperty(key)) {
  				sensorMan.startSQUIDRequest(key,sensorMan.squidDesc[key],sensorMan.startTime);
  			}
  		}
  	}
  	
  	//****  startSQUIDRequest -- start an http request that will save results and then call join when finished
  	this.startSQUIDRequest = function(name,sqDesc,startTime) {
  		// The argument is an array describing this SQUID sensor
  	  	var host = sqDesc[1];
  	  	var port = sqDesc[2];
  	  	var id = sqDesc[3];
		var options = {
		  host: host,
		  port:port,
		  path: '/?action=retrieve&uuid=' + id + '&since=' + String(startTime) // the structure of a SQUID request URL
		};
		
		var sensorMan = this;
		callback = function(response) {
		  var str = '';
		
		  //another chunk of data has been recieved, so append it to `str`
		  response.on('data', function (chunk) {
		    str += chunk;
		  });
		
		  response.on('clientError', function (exception, socket) {
		    str += String(exception);
		    sensorMan.sensorResults[name].hadError = 1; 
		  });

		  //the whole response has been recieved, so we just print it out here
		  response.on('end', function () {
		    sensorMan.sensorResults[name].output = str; // save the results
		    console.log("Poking SQUID callback: " + name);
		    
		    sensorMan.squidSensors[name].callback(); 	// poke the callback so the join knows were done
		  });
		}
		
		http.request(options, callback).end();  	
  	}
  	
  	//****  cleanUpAndReturnResults  -- this is called after successful completion of the recording
  	this.cleanUpAndReturnResults = function(sensorMan,stRenderFunc) {
  		sensorMan.endTime = new Date().getTime();		
		sensorMan.state = 'Idle';
		sensorMan.sessionNum++;
		// close all the connections
		for (var key in sensorMan.sshDesc) {
			if (sensorMan.sshDesc.hasOwnProperty(key)) {
   				sensorMan.sshSensors[key].connection.end();
			}
		}
		stRenderFunc(sensorMan.startTime,sensorMan.endTime,sensorMan.sensorResults);
  	}		
}
