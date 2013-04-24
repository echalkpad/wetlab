// Simple server to control the cameras / mics and RFID readers for bioturk
//
// LaMarca 2013

/*
 * Step 1: install couchdb: http://www.apache.org/dyn/closer.cgi?path=/couchdb/binary/win/1.3.0/setup-couchdb-1.3.0_R14B04.exe
 * Step 2: Install node-couch connection: git clone http://github.com/felixge/node-couchdb  (I put it in ../../node-couhcdb)
 * Step 3: npm install -g forever if you want it to run for a long time
 * Step 4: http://localhost:5984/_utils/  will let you create documented in couchdb. Make a db called bioturk with a document id "recordings"
 *
 **/
var sys = require('sys'),
fs = require('fs'),
http = require('http'),
url = require('url');

var startTime = new Date().getTime();

var currentState = 'Idle';
var cradle = require('cradle');
  var connection = new(cradle.Connection)('http://localhost', 5984);
  //, {
  //    auth: { username: 'username', password: 'password' }
  //});
var db = connection.database('bioturk');
 

http.createServer(function (req, res) {
    var url_parts = url.parse(req.url,true);
 
    switch(url_parts.pathname) {
    case '/':
    case '/status':
	display_status(url_parts.pathname, req, res);
	break;
    case '/history':
	sys.puts("display history");
	break;
    case '/stop':
	sys.puts("display stop");
	break;
    case '/start':
	start(url_parts.pathname, req, res);
	break;
    default:
	display_404(url_parts.pathname, req, res);
    }
    return;
 
    function knownSensors() {
        h = new Object();
        h['CAM_CLOSE'] = "INVOKE_SSH, 128.14.55.67";
        h['RFID'] = "OTHER_KIND";
        return h;
    }
    /**
     * Display the document root
     **/
    function display_status(url, req, res) {
        var now = new Date().getTime();
        var query = url_parts.query;
        var delta = Math.round((now - startTime)/1000);
        // pull out known sensors
        db.get('sensors', function (err, doc) {
            if(err) {
                res.end("Badness, i don't know where the sensor document is...");
            }
            else {
                renderStatus(url,delta,query,doc);
            }
	});
    }
    
    function renderStatus(url,delta,query,sensors) {
        //### WHATS IS RECORDING
        //### POINTER TO RECORDING HISTORY
        //### RECORDINGS PERFORMED
        //### LAST RECORDING TIME

        // Now render the info in either XML or HTML
        var fmt = query["format"];
        if (fmt == "xml") {
            res.writeHead(200, {'Content-Type': 'text/xml'});
            var xml = "<!--  From Bioturk CamServer  --><status><uptime>" + delta + "</uptime><state>" + currentState + "</state>";
            for (var k in sensors) {
                if (sensors.hasOwnProperty(k) && !(k.substring(0,1) == "_")) {
                    xml = xml + "<sensor name='" + k + "'>" + sensors[k] + "</sensor>\n";
                }
            }
            xml = xml + "</status>\n"
            res.end(xml);
        } else {
            res.writeHead(200, {'Content-Type': 'text/html'});
            var html = "<head><title>Bioturk CamServer</title></head><body><h2>Bioturk Camera/Microphone/RFID Control Server</h2><p>" +
                "<h3>Status:</h3>" +
               "Server uptime: " + delta + " seconds" +
               "</br>Current State: " + currentState + "<p>" +
                "<h3>Known Sensors:</h3><p>\n" +
                "<table cellpadding=3><tr><td><b>Sensor Name&nbsp;&nbsp;&nbsp;&nbsp;</b></td><td><b>Sensor Info</b></td></tr>\n";
                for (var k in sensors) {
                    // use hasOwnProperty to filter out keys from the Object.prototype
                    if (sensors.hasOwnProperty(k) && !(k.substring(0,1) == "_")) {
                        html = html + "<tr><td>" + k + "</td><td>" + sensors[k] + "</td></tr>\n";
                    }
                }
                html = html + "</table >" +
                       // Some controls:
                       "<hr><a href=/history>Recording History</a></br>" +
                       "<a href=/start>Start recording (all sensors)</a></br>" +
                       "<a href=/stop>Stop recording</a></br>" +
                       "</body>"
            res.end(html);
            
        }
    }
    
    /**
     * Stop a recording in progress (if there is one. Returns a bool if there was)
     *
     **/
    function stopRecordingInProgress(args) {
	
    }
 
    /**
     * Start a recording
     **/
    function start(url, req, res) {
	stopRecordingInProgress();
        var now = new Date().getTime();
        var query = url_parts.query;
        var delta = Math.round((now - startTime)/1000);
        // pull out known sensors
        db.getDoc("sensors", function(error, doc) {
            if(error) {
                res.end("Badness, i don't know where the sensor document is...");
            }
            else {
                renderStatus(url,delta,query,doc);
            }
	});
    }
 
    /**
     * Display the 404 page for content that can't be found
     **/
    
function display_404(url, req, res) {
	res.writeHead(404, {'Content-Type': 'text/html'});
	var response = '';
  db.save('document_key', {
      name: 'A Funny Name'
  }, function (err, resx) {
      if (err) {
          // Handle error
          response += ' SAVE ERROR: Could not save record!!\n';
      } else {
          // Handle success
          response += ' SUCESSFUL SAVE\n';
      }
      db.get('document_key', function (err, doc) {
          response += ' DOCUMENT: ' + doc + '\n';
          res.write(response);
	res.write("<h1>404 Not Found</h1>");
	res.end("The page you were looking for: "+url+" can not be found Cool dude.");
      });
      });
    }
}).listen(8888);



sys.puts('Server running at http://127.0.0.1:8888/');