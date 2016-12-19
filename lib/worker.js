var os = require('os');
var Promise = require('bluebird');
var Happn = require('happn-3');
var RunWorker = require('./worker/run-worker');

var password = process.env.PASSWORD || 'secret';
var conductorUrl = process.env.CONDUCTOR_URL || 'https://localhost:55000';
var workerId = process.env.WORKER_ID || os.hostname();

var happnClient;

Promise.resolve()

  .then(() => {
    return Happn.client.create({
      protocol: 'https',
      allowSelfSignedCerts: true,
      username: '_ADMIN',
      password: password,
      url: conductorUrl,
      info: {
        workerId: workerId
      }
    })
  })

  .then(_happnClient => {
    happnClient = _happnClient;
    var runWorker = new RunWorker(happnClient);
    return runWorker.start();
  })

  .catch(error => {
    console.error(error);
    process.exit(1);
  });
