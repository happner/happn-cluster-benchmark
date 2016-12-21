const path = require('path');
const Promise = require('bluebird');
const Happn = require('happn-3');
const RunServer = require('./conductor/run-conductor');

const password = process.env.PASSWORD || 'secret';
let happnServer, happnCLient;

Promise.resolve()

// start happn conductor to relay control messages and results

  .then(() => {
    return Happn.service.create({
      secure: true,
      services: {
        transport: {
          config: {
            mode: 'https',
            certPath: path.dirname(__dirname) + '/conductor.cert',
            keyPath: path.dirname(__dirname) + '/conductor.key'
          }
        },
        connect: {
          config: {
            middleware: {
              security: {
                exclusions: [
                  '/status',
                  '/start-cluster-seed',
                  '/start-cluster-node',
                  '/start-cluster-clients',
                  '/kill'
                ]
              }
            }
          }
        },
        security: {
          config: {
            adminUser: {
              username: '_ADMIN',
              password: password
            }
          }
        }
      }
    });
  })

  // start happn client to issue control and receive results

  .then(_happnServer => {
    happnServer = _happnServer;
    return happnServer.services.session.localClient({
      username: '_ADMIN',
      password: password
    });
  })

  // run conductor conductor process

  .then(_happnClient => {
    happnCLient = _happnClient;
    let runServer = new RunServer(happnServer, happnCLient);
    return runServer.start();
  })


  .catch(error => {
    console.error(error);
    process.exit(1);
  });
