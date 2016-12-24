// worker spawns this

const HappnCluster = require('happn-cluster');

const existingServerCount = process.argv[2] || 0;
const data = JSON.parse(process.argv[3]);

const password = process.env.PASSWORD || 'secret';
const iface = process.env.IFACE || 'eth0';
const proxyPort = parseInt(process.env.PROXY_BASE_PORT || 55000) + parseInt(existingServerCount);
const swimPort = parseInt(process.env.SWIM_BASE_PORT || 56000) + parseInt(existingServerCount);
const happnPort = parseInt(process.env.HAPPN_BASE_PORT || 57000) + parseInt(existingServerCount);
const mongoURL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/run-cluster';
const mongoCollection = process.env.MONGO_COLLECTION || 'run-cluster';

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
        hosts: [data.options.swim],
        seed: false
      }
    }
  }
};

HappnCluster.create(config)

  .then(server => {
    let proxyAddress = server.services.proxy.__proxyServer._server.address();

    process.send({
      message: 'action-response',
      ok: true,
      result: {
        swim: server.services.membership.memberId,
        happn: 'http://' + server.__info.address + ':' + server.__info.port,
        proxy: 'http://' + proxyAddress.address + ':' + proxyAddress.port
      }
    })
  })

  .catch(error => {
    console.error(error);
    process.send({
      message: 'action-response',
      ok: false,
      result: error.toString()
    });
    process.exit(1);
  });
