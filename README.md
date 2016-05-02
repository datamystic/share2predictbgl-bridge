share2predictbgl-bridge
=======================

[Releases][releases]

[releases]: https://github.com/datamystic/share2predictbgl-bridge/releases
[wiki]: https://github.com/datamystic/share2predictbgl-bridge/wiki
[dexcom-eula]: http://www.dexcom.com/node/5421
[azure-environment]: https://github.com/projectkudu/kudu/wiki/Azure-runtime-environment
[blog-post]: http://www.hanselman.com/blog/BridgingDexcomShareCGMReceiversAndNightscout.aspx
[signup]: https://www.managebgl.com/
[diabetes-api]: https://www.managebgl.com/api/api-REST.html
[your-secret]: https://www.managebgl.com/settings-sharing-third.html

The Share to PredictBGL bridge copies your CGM data from Dexcom web services to
PredictBGL Apps/ManageBGL website via the [PredictBGL Diabetes API][diabetes-api].
The bridge runs as `node index.js` and will loop
forever, periodically querying Dexcom's Share web services for new CGM data.
The bridge relays any new data to the PredictBGL website via the REST API.  
The website then syncs the
data live to all connected devices, such as the PredictBGL iOS and Android Apps.

### Prerequisites

* A working Dexcom Share receiver paired to an Apple or Android device that is
  successfully uploading data to Dexcom.  You must be able to see the Dexcom
  data in the Dexcom Follow app for the bridge to work.
* Your Dexcom Sharer username and password
* A ManageBGL account, signup free at [PredictBGL][signup]

### Install

For normal setup, first install node.js on your computer.

Under Unix:

sudo apt-get update

sudo apt-get install nodejs

sudo apt-get install npm

npm install request


Under Windows, go to https://nodejs.org/en/download/




In a new folder, run:
  git clone https://github.com/datamystic/share2predictbgl-bridge.git

To install pre-requisities, run  
  npm install request

To setup the bridge for your account, run these (one per line):  
  set API_SECRET=xxxx-xxxxxxxxxxxxxxxxxxxxxx  
  
  set DEXCOM_ACCOUNT_NAME=xxxxx
  
  set DEXCOM_PASSWORD=xxxxx

Note: if you use Mac/Linux, change set to EXPORT ie
  export API_SECRET=xxxx-xxxxxxxxxxxxxxxxxxxxxx  
  
  export DEXCOM_ACCOUNT_NAME=xxxxx
  
  export DEXCOM_PASSWORD=xxxxx


[Get ManageBGL's API secret][your-secret]

To start things rolling, run:
  node index.js

#### Required

* `API_SECRET` - A secret passphrase that must be at least 12 characters long, and must match the `API_SECRET` from https://www.managebgl.com/settings-sharing-third.html
* `DEXCOM_ACCOUNT_NAME` - Your Dexcom Share2 username
* `DEXCOM_PASSWORD` - Your Dexcom Share2 password

#### Optional

* `maxCount` (1) - The maximum number of records to fetch per update
* `minutes` (1440) - The time window to search for new data per update (default is one day in minutes)
* `firstFetchCount` (3) - Changes `maxCount` during the very first update only.
* `maxFailures` (3) - The program will stop running after this many
  consecutively failed login attempts with a clear error message in the logs.
* `SHARE_INTERVAL` (150000) - The time to wait between each update (default is 2.5 minutes in milliseconds)

#### Alternative

* If this all sounds too complicated, get a ManageBGL.com account and it is all done for you.

### More information

This code is based on and acknowledges the work by Ben West and 
Scott Hanselman][blog-post]. This bridge logs in to Dexcom
Share as the data publisher.  It re-uses the token every `5` minutes to fetch
the `maxCount` latest glucose records within the last specified `minutes`.
This information is then sent to the user's specified PredictBGL account,
making the data available to the beloved pebble watch and other equipment owned
and operated by the receiver's owner.  It will continue to re-use the same
`sessionID` until it expires, at which point it should attempt to log in again.
If it can log in again, it will continue to re-use the new token to fetch data,
storing it into PredictBGL.

This project is not FDA approved, not recommended for therapy, and not
recommended by [Dexcom][dexcom-eula].

