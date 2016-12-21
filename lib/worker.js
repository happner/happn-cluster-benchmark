const os = require('os');
const Promise = require('bluebird');
const Happn = require('happn-3');
const RunWorker = require('./worker/run-worker');

const password = process.env.PASSWORD || 'secret';
const conductorUrl = process.env.CONDUCTOR_URL || 'https://localhost:55000';
const workerId = process.env.WORKER_ID || os.hostname();

let happnClient;

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
    let runWorker = new RunWorker(happnClient);
    return runWorker.start();
  })

  .catch(error => {
    console.error(error);
    process.exit(1);
  });
