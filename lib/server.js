var path = require('path');
var Promise = require('bluebird');
var Happn = require('happn-3');
var RunServer = require('./server/run-server');

var password = process.env.PASSWORD || 'secret';
var happnServer, happnCLient;

Promise.resolve()

// start happn server to relay control messages and results

  .then(() => {
    return Happn.service.create({
      secure: true,
      services: {
        transport: {
          config: {
            mode: 'https',
            certPath: path.dirname(__dirname) + '/server.cert',
            keyPath: path.dirname(__dirname) + '/server.key'
          }
        },
        connect: {
          config: {
            middleware: {
              security: {
                exclusions: [
                  '/status',
                  '/start-cluster-seed'
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

  .then((_happnServer) => {
    happnServer = _happnServer;
    return happnServer.services.session.localClient({
      username: '_ADMIN',
      password: password
    });
  })

  // run conductor server process

  .then((_happnClient) => {
    happnCLient = _happnClient;
    var runServer = new RunServer(happnServer, happnCLient);
    return runServer.start();
  })


  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
