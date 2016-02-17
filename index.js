/**
 * Author: Simon Carter
 * Thanks to Ben West, Scott Hanselman
 * http://www.hanselman.com/blog/BridgingDexcomShareCGMReceiversAndNightscout.aspx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 *
 * @description: Allows user to store their Dexcom data in their own
 * PredictBGL account by facilitating the transfer of latest records
 * from Dexcom's server into theirs.
 */
var request = require('request');
var qs = require('querystring');


// Defaults
var Defaults = {
  "applicationId":"d89443d2-327c-4a6f-89e5-496bbb0317db"
, "agent": "Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0"
, login: 'https://share1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName'
, accept: 'application/json'
, 'content-type': 'application/json'
, LatestGlucose: "https://share1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues"
// ?sessionID=e59c836f-5aeb-4b95-afa2-39cf2769fede&minutes=1440&maxCount=1"
, predictbgl_upload: '/api/1.0/add_logs.json'
, MIN_PASSPHRASE_LENGTH: 12
};

var DIRECTIONS = {
  NONE: 0
, DoubleUp: 1
, SingleUp: 2
, FortyFiveUp: 3
, Flat: 4
, FortyFiveDown: 5
, SingleDown: 6
, DoubleDown: 7
, 'NOT COMPUTABLE': 8
, 'RATE OUT OF RANGE': 9
};
var Trends = (function ( ) {
  var keys = Object.keys(DIRECTIONS);
  var trends = keys.sort(function (a, b) {
    return DIRECTIONS[a] - DIRECTIONS[b];
  });
  return trends;
})( );
function directionToTrend (direction) {
  var trend = 8;
  if (direction in DIRECTIONS) {
    trend = DIRECTIONS[direction];
  }
  return trend;
}
function trendToDirection (trend) {
  return Trends[trend] || Trends[0];
}

// assemble the POST body for the login endpoint
function login_payload (opts) {
  var body = {
    "password": opts.password
  , "applicationId" : opts.applicationId || Defaults.applicationId
  , "accountName": opts.accountName
  };
  return body;
}

// Login to Dexcom's server.
function authorize (opts, then) {
  var url = Defaults.login;
  var body = login_payload(opts);
  var headers = { 'User-Agent': Defaults.agent
                , 'Content-Type': Defaults['content-type']
                , 'Accept': Defaults.accept };
  var req ={ uri: url, body: body, json: true, headers: headers, method: 'POST'
           , rejectUnauthorized: false };
  // Asynchronously calls the `then` function when the request's I/O
  // is done.
  return request(req, then);
}

// Assemble query string for fetching data.
function fetch_query (opts) {
  // ?sessionID=e59c836f-5aeb-4b95-afa2-39cf2769fede&minutes=1440&maxCount=1"
  var q = {
    sessionID: opts.sessionID
  , minutes: opts.minutes || 1440
  , maxCount: opts.maxCount || 1
  };
  var url = Defaults.LatestGlucose + '?' + qs.stringify(q);
  return url;
}

// Asynchronously fetch data from Dexcom's server.
// Will fetch `minutes` and `maxCount` records.
function fetch (opts, then) {
  var url = fetch_query(opts);
  var body = "";
  var headers = { 'User-Agent': Defaults.agent
                , 'Content-Type': Defaults['content-type']
                , 'Content-Length': 0
                , 'Accept': Defaults.accept };

  var req ={ uri: url, body: body, json: true, headers: headers, method: 'POST'
           , rejectUnauthorized: false };
  return request(req, then);
}

// Authenticate and fetch data from Dexcom.
function do_everything (opts, then) {
  var login_opts = opts.login;
  var fetch_opts = opts.fetch;
  authorize(login_opts, function (err, res, body) {

    fetch_opts.sessionID = body;
    fetch(fetch_opts, function (err, res, glucose) {
      then(err, glucose);

    });
  });

}


// Map Dexcom's property values to PredictBGL's.
function dex_to_entry (d) {
/*
[ { DT: '/Date(1426292016000-0700)/',
    ST: '/Date(1426295616000)/',
    Trend: 4,
    Value: 101,
    WT: '/Date(1426292039000)/' } ]
*/
  var regex = /\((.*)\)/;
  var wall = parseInt(d.WT.match(regex)[1]);
  var date = new Date(wall);
  
  var initial = date.toISOString();
  initial = initial.replace("T", " ");
  initial = initial.replace("Z", "");
  
   var entry = {
	value: d.Value / 18,
	logtype_id: 22,
	time: initial
//	notes: 'dexcom test from Simon'
  };
  
//  , trend: d.Trend
//  , direction: trendToDirection(d.Trend)
//  , device: 'share2'
  
  return entry;
}

// Record data into PredictBGL.
function report_to_predictbgl (opts, then) {

  var headers = { 
                  'Content-Type': Defaults['content-type']
                , 'Accept': Defaults.accept };
  var url = opts.endpoint + Defaults.predictbgl_upload
  
  var json_body = {
	token: readENV('API_SECRET'),
	logs: JSON.stringify(opts.entries)
  };
  
 
  var req = { 	uri: url, 
				body: json_body, 
				json: true, 
				headers: headers, 
				method: 'POST',
				rejectUnauthorized: false 
			};
  return request(req, then);

}


function engine (opts) {

  var runs = 0;
  var failures = 0;
  function my ( ) {
    console.log('RUNNING', runs, 'failures', failures);
    if (my.sessionID) {
      var fetch_opts = Object.create(opts.fetch);
      if (runs === 0) {
        console.log('First run, fetching', opts.firstFetchCount);
        fetch_opts.maxCount = opts.firstFetchCount;
      }
      fetch_opts.sessionID = my.sessionID;
      fetch(fetch_opts, function (err, res, glucose) {
        if (res.statusCode < 400) {
          to_predictbgl(glucose);
        } else {
          my.sessionID = null;
          refresh_token( );
        }
      });
    } else {
      failures++;
      refresh_token( );
    }
  }

  function refresh_token ( ) {
    console.log('Fetching new token');
    authorize(opts.login, function (err, res, body) {
      if (!err && body && res.statusCode == 200) {
        my.sessionID = body;
        failures = 0;
        my( );
      } else {
        failures++;
        console.log("Error refreshing token", err, res.statusCode, body);
        if (failures >= opts.maxFailures) {
          throw "Too many login failures, check DEXCOM_ACCOUNT_NAME and DEXCOM_PASSWORD";
        }
      }
    });
  }

  function to_predictbgl (glucose) {
    var pb_config = Object.create(opts.predictbgl);
    if (glucose) {
      runs++;
      // Translate to predictbgl data.
      var entries = glucose.map(dex_to_entry);
      console.log('Entries', entries);
      if (opts && opts.callback && opts.callback.call) {
        opts.callback(null, entries);
      }
      if (pb_config.endpoint) {
 
        pb_config.entries = entries;
        
		// Send data to PredictBGL
        report_to_predictbgl(pb_config, function (err, response, body) {
          console.log("predictbgl upload", 'error', err, 'status', response.statusCode, body);

        });
      }
    }
  }

  my( );
  return my;
}

// Provide public, testable API
engine.fetch = fetch;
engine.authorize = authorize;
engine.authorize_fetch = do_everything;
module.exports = engine;

function readENV(varName, defaultValue) {
    //for some reason Azure uses this prefix, maybe there is a good reason
    var value = process.env['CUSTOMCONNSTR_' + varName]
        || process.env['CUSTOMCONNSTR_' + varName.toLowerCase()]
        || process.env[varName]
        || process.env[varName.toLowerCase()];

    return value || defaultValue;
}

// If run from commandline, run the whole program.
if (!module.parent) {
  if (readENV('API_SECRET').length < Defaults.MIN_PASSPHRASE_LENGTH) {
    var msg = [ "API_SECRET environment variable should be at least"
              , Defaults.MIN_PASSPHRASE_LENGTH, "characters" ];
    var err = new Error(msg.join(' '));
    throw err;
    process.exit(1);
  }
  if (readENV('DEXCOM_ACCOUNT_NAME', '@').match(/\@/)) {
    var msg = [ "environment variable"
              , "DEXCOM_ACCOUNT_NAME should be"
              , "Dexcom Share user name, not an email address"];
    var err = new Error(msg.join(' '));
    throw err;
    process.exit(1);
  }
  var args = process.argv.slice(2);
  var config = {
    accountName: readENV('DEXCOM_ACCOUNT_NAME')
  , password: readENV('DEXCOM_PASSWORD')
  };
  var pb_config = {
    token: readENV('API_SECRET')
  , endpoint: readENV('NS', 'https://www.managebgl.com')
  };
  var interval = readENV('SHARE_INTERVAL', 60000 * 2.5);
  var fetch_config = { maxCount: readENV('maxCount', 1)
    , minutes: readENV('minutes', 1440)
  };
  var meta = {
    login: config
  , fetch: fetch_config
  , predictbgl: pb_config
  , maxFailures: readENV('maxFailures', 3)
  , firstFetchCount: readENV('firstFetchCount', 3)
  };
  switch (args[0]) {
    case 'login':
      authorize(config, console.log.bind(console, 'login'));
      break;
    case 'fetch':
      config = { sessionID: args[1] };
      fetch(config, console.log.bind(console, 'fetched'));
      break;
    case 'testdaemon':
      setInterval(engine(meta), 2500);
      break;
    case 'run':
      // Authorize and fetch from Dexcom.
      do_everything(meta, function (err, glucose) {
        console.log('From Dexcom', err, glucose);
        if (glucose) {
          // Translate to predictbgl data.
          var entries = glucose.map(dex_to_entry);
          console.log('Entries', entries);
          if (pb_config.endpoint) {
            pb_config.entries = entries;
            // Send data to predictbgl.
            report_to_predictbgl(pb_config, function (err, response, body) {
              console.log("predictbgl upload", 'error', err, 'status', response.statusCode, body);

            });
          }
        }
      });
      break;
    default:
      setInterval(engine(meta), interval);
      break;
      break;
  }
}

