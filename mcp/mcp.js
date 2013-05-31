// Simple server to control the cameras / mics and RFID readers for bioturk
//
// LaMarca 2013

/*  FIXME: These seem outdated. Make it match the readme.
 * Step 1: install couchdb: http://www.apache.org/dyn/closer.cgi?path=/couchdb/binary/win/1.3.0/setup-couchdb-1.3.0_R14B04.exe
 * Step 2: Install node-couch connection: git clone http://github.com/felixge/node-couchdb  (I put it in ../../node-couhcdb)
 * Step 3: npm install -g forever if you want it to run for a long time
 * Step 4: http://localhost:5984/_utils/  will let you create documented in couchdb. Make a db called bioturk with a document id "recordings"
 *
 * You need to set an environment variable for node to find the installed modules: set NODE_PATH=C:\Users\lamarca\AppData\Roaming\npm\node_modules
 * 
 **/
 
var sys = require('sys');
var fs = require('fs');
var express = require('express'), app = express();
var http = require('http');
var url = require('url');
var path = require('path');
Sensor = require('./sensor'), sensorMan = new Sensor();
Data = require('./data'), dataMan = new Data();

var port = 8888;

//*** Initialization
var startTime = new Date().getTime();
var currentRecording = null;

//**** Routing logic 

app.set('view engine', 'ejs');
//app.set('view options', {
//    layout: false
//});

//app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname,'static')));
//***** static pages
//app.configure(function () {   );
//});

//	res.render('BTSensors', {
//	    message : 'De groeten. Yeah baby'
//	});	




//***** dynamic pages
app.get('/', function(req, res) {
	renderHtmlOrXml(req,res,'status',displayStatus);
});
 
app.get('/status', function(req, res) {
	renderHtmlOrXml(req,res,'status',displayStatus);
});

app.get('/history', function(req, res) {
	renderHtmlOrXml(req,res,'history',displayHistory);
});

app.get('/testing', function(req, res) {
	req.textResults = [];	
	req.title = "Tests";	
	req.keyedResults = {};
	renderHtmlOrXml(req,res,'testing',displayTesting);
});

app.get('/stop', function(req, res) {	
	req.title = "Recording Stopped";	
	req.textResults = [];	
	req.keyedResults = {};
  	stop(req, res, function() { renderHtmlOrXml(req,res,'testing',displayTesting); });
});

app.get('/start', function(req, res) {
	req.title = "Recording Started";	
	req.textResults = [];	
	req.keyedResults = {};
  	start(req, res, function() { renderHtmlOrXml(req,res,'testing',displayTesting); });
});

app.get('/delete', function(req, res) {
	req.textResults = [];	
	req.title = "Unprocessed Recordings Deleted";	
	req.keyedResults = {};
  	deleteUnprocessed(req, res, function() { renderHtmlOrXml(req,res,'testing',displayTesting); });
});

function returnXml(req) {
	  var url_parts = url.parse(req.url,true);	
	  var query = url_parts.query;
	  var fmt = query["format"];
      return (fmt == "xml");
}
    
function ObjToXml(x) {
if (x instanceof Object) {
		var rv = "";
	    for (var k in x) {
	    	 var val = x[k];
	    	 if (val instanceof Array) {
			    for (var i=0; i<val.length; i++) {
	    		     rv = rv + "<"+k+">" + ObjToXml(val[i]) +"</"+k+">";
	    		}
			} else {
	         rv = rv + "<" + k + ">" + ObjToXml(val) +"</"+k+">";
	        }
	    }
	    return rv + "\n";
	} else {
		return String(x);
    }
}

function renderHtmlOrXml(req, res,view, func) {
	var rx = returnXml(req);
	var df;
	if (rx) {
		df = function(req, res,data) {
            res.writeHead(200, {'Content-Type': 'text/xml'});
            res.end("<rv>" + ObjToXml(data) + "</rv>");
        };
    } else {
    	df = function(req, res, data) {
		res.render(view, data);
		};
    }
    func(req, res, df);
}
    
//**** Display the status of the server (in XML or HTTP)
    function displayStatus(req, res, renderFunc) {
      var now = new Date().getTime();
      var delta = Math.round((now - startTime)/1000);
        // pull out known sensors
        dataMan.getSensorData(function (err, doc) {
            if(err) {
                renderFunc(req,res, "Badness, i can't access the sensor document. Is couchdb down? Is the document there?");
            }
            else {
                renderStatus(delta,req,res,doc,renderFunc);
            }
		});
    }
    
    function renderStatus(delta,req,res,sensors,renderFunc) {
            var rv = {};
            rv.title = "Server status";
            rv.uptime = delta;
            rv.state = sensorMan.state;
	        rv.currentlyrecording = {};
	        if (currentRecording != null) {
	        var i = 0;
		    for (var k in currentRecording) {
				if (currentRecording.hasOwnProperty(k) && !(k.substring(0,1) == "_")) {
					rv.currentlyrecording[i] = {};
					rv.currentlyrecording[i].sensor = k;
					rv.currentlyrecording[i].val = currentRecording[k];
					i += 1;
				}
 		    }
	       }
	        rv.sensor = [];
	        i = 0;
		    for (var k in sensors) {
				if (sensors.hasOwnProperty(k) && !(k.substring(0,1) == "_")) {
				    rv.foo = i;
					rv.sensor[i] = {};
					rv.sensor[i].name = k;
					rv.sensor[i].info = sensors[k];
					i += 1;
				}
	       }
           renderFunc(req,res,rv);
    }
    
//**** Display the status of the server (in XML or HTTP)
    function displayHistory(req, res, renderFunc) {
        // pull out experiment history
        dataMan.getRawRecordings(function (err, doc) {
            if(err) {
                res.end("Badness, i can't access the sensor document. Is couchdb down? Is the document there?");
            }
            else {
                renderHistory(req,res,doc, renderFunc);
            }
	});
    }
    
    function renderHistory(req,res,data, renderFunc) {
          var rv = {};
          rv.title = "Recording History";
    
          fields = ["date","length","user_name","protocol_id","step_id","time_limit","sensors","error"];
          // add a couple of fields to the structure
	      for (var i=0; i<data.length; i++) {
          	data[i].value.date = new Date(data[i].value.startTime).toLocaleString().replace(/GMT.*/,""); //### Make human readable
          	data[i].value.length = Math.round((data[i].value.endTime - data[i].value.startTime)/1000) + " s";
          	data[i].value.error = 'False';
		    for (var k in data[i].value.sensorData) {
				if (data[i].value.sensorData.hasOwnProperty(k) && !(k.substring(0,1) == "_")) {
	        		if (data[i].value.sensorData[k].hadError == 1) {
	        	  		data[i].value.error = "True";
	        	  	}
	        	}
	        }
          }
          
          rv.rawfields = fields;
          rv.rawrecs = [];
	      for (var i=0; i<data.length; i++) {
	      	rv.rawrecs[i] = {};
	      	for (var j=0; j<fields.length; j++) {
	      	rv.rawrecs[i][fields[j]] = data[i].value[fields[j]];
            }
          }

         renderFunc(req,res,rv);
    }
     
 //****** Display Testing
      
    function displayTesting(req,res,renderFunc) {
    	rv = {};
    	rv.textResults = req.textResults; //### This was a kludge
    	rv.keyedResults = req.keyedResults; 
    	rv.title = req.title;
    	rv.state = sensorMan.state;
    	rv.sensorNames = [];
    	// fetch the sensor names and then render the html
        dataMan.getSensorData(function (err, doc) {
            if(err) {
                renderFunc(req,res, "Badness, i can't access the sensor document. Is couchdb down? Is the document there?");
            }
            else {
			    for (var k in doc) {
					if (doc.hasOwnProperty(k) && !(k.substring(0,1) == "_")) {
						rv.sensorNames[rv.sensorNames.length] = k; // Add the sensor to the list to return
					}
				}				
                renderFunc(req,res,rv);
            }
	});
    }
 
  //***** deleteUnprocessed -- delete unprocessed recordings
    function deleteUnprocessed(req, res, postFunc) {
    	dataMan.deleteRawRecordings(postFunc);
    }
    
 //***** Stop reconrding if we're  in record state
    function stop(req, res, postFunc) {
	    if (currentRecording == null) {
	    	req.keyedResults['error'] = 'Stop called while not recording';
			postFunc();
		} else {
	    sensorMan.stop(function(startTime,endTime,sensorData) {
	   		// we finished. Write the results to the database
			currentRecording.sensorData = sensorData;
			currentRecording.startTime = startTime;
			currentRecording.endTime = endTime;
			dataMan.saveRawRecording(currentRecording, function() {	    
            var delta = Math.round((endTime - startTime)/1000);
            req.keyedResults['startTime'] = currentRecording.startTime;
			req.keyedResults['endTime'] = currentRecording.endTime;
			req.keyedResults['Recording length (s)'] = delta;
			for (var key in sensorData) {
	  			if (sensorData.hasOwnProperty(key)) {
		        	var v = sensorData[key].output.split("\|");
	        		req.textResults[req.textResults.length] = "Sensor: " + key;
		        	if (sensorData[key].hadError) {
		        		req.textResults[req.textResults.length-1] = req.textResults[req.textResults.length-1] + "(Error)";
		        	}
		        	for (var i=0; i<v.length; i++) { 
		        		if (v[i].length > 0) {
		        			req.textResults[req.textResults.length] = v[i];
		        		}
	        		}
	  			}
	  		}
	         // Call the post func. Might end the request or call some more stuff...
	        currentRecording = null;
			postFunc();
			});
		});
		}
	}
	
 //***** Start a new recording (will stop an old one if it's already in record state)
    function start(req, res, postFunc) {
    	// Get the list of sensors. Then shut down the old recording (if it's going on) and start the new one
        dataMan.getSensorData(function (err, doc) {
        	
            if(err) {
            	req.keyedResults['error'] = 1;
                req.textResults = ['Error: Stop called while not recording'];
                postFunc();
            } else {
				// if we're recording, do a stop the start, else just start new recording
				if (sensorMan.state == 'Recording') { // need to stop it
				    //schedule the stop with forks. Then call finishedF
				    req.title = "Recording Stopped and then Restarted";
				    stop(req, res, function() {
				        startNewRecording(req,res,doc,postFunc);
					});
				} else {
						req.textResults = [];
				        startNewRecording(req,res,doc,postFunc);
				}
            }
	});
    }

	// continuation of starting a new recording
    function startNewRecording(req, res,sensorConfig,postFunc) {
        // Now render the info in either XML or HTML
  	    var url_parts = url.parse(req.url,true);	
	    var query = url_parts.query;
		currentRecording = new Object();
        currentRecording.user_name = query["user_name"];  
        currentRecording.protocol_id = query["protocol_id"];
        currentRecording.step_id = query["step_id"];
        currentRecording.time_limit = query["time_limit"];    //### Do something with time limit
        currentRecording.sensors = String(query["sensors"]);
        console.log("Hey!! It's: " + currentRecording.sensors);
        currentRecording.step_desc = query["step_desc"];

		req.keyedResults['sensors'] = currentRecording.sensors;
		req.keyedResults['user_name'] = currentRecording.user_name;
		req.keyedResults['protocol_id'] = currentRecording.protocol_id;
		req.keyedResults['step_id'] = currentRecording.step_id;
		
		var sensorsToRecord=currentRecording.sensors.split(",");
	
		sensorMan.prepareToStart();
		
		// Iterate through all the sensors and add them to the list to be recorded
		
		for (var i=0; i<sensorsToRecord.length; i++) { 
			var s = sensorsToRecord[i];
			var details = sensorConfig[s];
			var error = "";
			if ((details == null) || (details.length == 0)) {
			  error = error + "Could not find details about: " + s;
			  console.log(error);
			  error = 1;
			} else {
			console.log("### Adding " + s + " ::: " + details);
			  sensorMan.addSensor(s,String(details));
			}
		}
		
		if (error.length > 0) {
		  // badness, let just return an error now and be done
         	req.textResults[req.textResults.length] = 'Errors while preparing to record: ' + error;
	        postFunc();
			return;
		}
		
		sensorMan.start(function(sensorData) {
			// This will be called when the forks have all taken place
			req.textResults[req.textResults.length] = 'Recording started.';
	
			for (var key in sensorData) {
	  			if (sensorData.hasOwnProperty(key)) {
		        	var v = sensorData[key].output.split("\|");
	        		req.textResults[req.textResults.length] = "Sensor: " + key;
		        	if (sensorData[key].hadError) {
		        		req.textResults[req.textResults.length-1] = req.textResults[req.textResults.length-1] + "(Error)";
		        	}
		        	for (var i=0; i<v.length; i++) { 
		        		if (v[i].length > 0) {
		        			req.textResults[req.textResults.length] = v[i];
		        		}
	        		}
	  			}
			}
	        postFunc();
		});
		
    }    

sys.puts('Server running at http://127.0.0.1:' + port);
app.listen(port);