// worker spawns this

var HappnCluster = require('happn-cluster');

var existingServerCount = process.argv[2] || 0;
var password = process.env.PASSWORD || 'secret';
var iface = process.env.IFACE || 'eth0';
var proxyPort = parseInt(process.env.PROXY_BASE_PORT || 55000) + parseInt(existingServerCount);
var swimPort = parseInt(process.env.SWIM_BASE_PORT || 56000) + parseInt(existingServerCount);
var happnPort = parseInt(process.env.HAPPN_BASE_PORT || 57000) + parseInt(existingServerCount);
var mongoURL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/test-cluster';
var mongoCollection = process.env.MONGO_COLLECTION || 'test-cluster';


var config = {
  host: iface,
  port: happnPort,
  secure: true,
  services: {
    security: {
      config: {
        adminUser: {
          username: '_ADMIN',
          password: password // BEWARE!! if attaching to mongo with existing collection the admin password cannot be set here, expect confusion...
        }
      }
    },
    data: {
      path: 'happn-service-mongo-2',
      config: {
        url: mongoURL,
        collection: mongoCollection
      }
    },
    proxy: {
      config: {
        port: proxyPort
      }
    },
    orchestrator: {
      config: {
        replicate: ['/global/*']
      }
    },
    membership: {
      config: {
        clusterName: 'example-cluster',
        host: iface,
        port: swimPort,
        hosts: ['127.0.0.1:56000', '127.0.0.1:56000', '127.0.0.1:56000'],
        seed: true
      }
    }
  }
};

HappnCluster.create(config)

  .then((server) => {
    process.send({
      message: 'action-response',
      ok: true,
      result: {
        memberId: server.services.membership.memberId
      }
    })
  })

  .catch((error) => {
    console.error(error);
    process.send({
      message: 'action-response',
      ok: false,
      result: error.toString()
    });
    process.exit(1);
  });
