var Promise = require('bluebird'); // remain consistent with happn
var bodyParser = require('body-parser');
var shortid = require('shortid');

var password = process.env.PASSWORD || 'secret';

class RunServer {

  constructor(server, client) {
    this.log = server.log.createLogger('Conductor');
    this.server = server;
    this.client = client;
    this.workers = {};
    this.requests = {};
  }

  start() {
    return Promise.resolve()

      .then(() => {
        this.server.services.session.on('authentic', this.onWorkerConnection.bind(this));
      })

      .then(() => {
        this.server.services.session.on('disconnect', this.onWorkerDisconnect.bind(this));
      })

      .then(() => {
        this.server.connect.use('/status', this.onGetStatus.bind(this));
      })

      .then(() => {
        this.server.connect.use('/start-cluster-seed', bodyParser.json());
        this.server.connect.use('/start-cluster-seed', this.onPostStartClusterSeed.bind(this));
      })

      .then(() => {
        this.server.connect.use('/start-cluster-node', bodyParser.json());
        this.server.connect.use('/start-cluster-node', this.onPostStartClusterNode.bind(this));
      })

      .then(() => {
        return new Promise((resolve, reject) => {
          this.client.on('/action-response', this.onActionResponse.bind(this), (e) => {
            if (e) return reject(e);
            resolve();
          })
        });
      })
  }

  onWorkerConnection(data) {
    this.workers[data.info.workerId] = {
      servers: {}, // happn-cluster conductor instance hosted on this worker
      clients: {}  // happn clients
    };
    this.log.info('%s connected (%d)', data.info.workerId, Object.keys(this.workers).length)
  }

  onWorkerDisconnect(data) {
    delete this.workers[data.info.workerId];
    this.log.info('%s disconnected (%d)', data.info.workerId, Object.keys(this.workers).length)
  }

  /*
   curl \
   -k \
   -H "Authorization: secret" \
   https://localhost:55000/status
   */
  onGetStatus(req, res) {
    if (!this.authorized(req, res)) return;
    this.log.info('GET /status');
    res.end(
      JSON.stringify({
        workers: this.workers,
        requests: this.requests
      }, null, 2)
    );
  }

  /*
   curl \
   -k \
   -H "Authorization: secret" \
   -H "Content-Type: application/json" \
   -X POST \
   -d '{}' \
   https://localhost:55000/start-cluster-seed
   */
  onPostStartClusterSeed(req, res) {
    if (!this.authorized(req, res)) return;
    this.log.info('POST /start-cluster-seed');
    return this.startActionSingle(res, 'startClusterSeed', {/* options */});
  }

  /*
   curl \
   -k \
   -H "Authorization: secret" \
   -H "Content-Type: application/json" \
   -X POST \
   -d '{}' \
   https://localhost:55000/start-cluster-node
   */
  onPostStartClusterNode(req, res) {
    if (!this.authorized(req, res)) return;
    this.log.info('POST /start-cluster-node');
    var swim = this.getSwimJoin();
    if (!swim) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        ok: false,
        result: 'Error: Missin cluster seed'
      }, null, 2));
      return;
    }
    var options = {
      swim: swim
    };
    return this.startActionSingle(res, 'startClusterNode', options);
  }

  getSwimJoin() {
    var swim;
    Object.keys(this.workers).forEach((workerId) => {
      var worker = this.workers[workerId];
      Object.keys(worker.servers).forEach((id) => {
        var server = worker.servers[id];
        if (server.action == 'startClusterSeed') swim = server.result.swim;
      })
    });
    return swim;
  }

  startActionSingle(res, action, options) {
    new Promise((resolve, reject) => {
      var id = shortid.generate();
      this.requests[id] = {
        id: id,
        action: action,
        options: options,
        processed: false,
        resolve: resolve,
        reject: reject
      };
      this[action](this.requests[id]);
    })
      .then((result) => {
        res.end(JSON.stringify(result, null, 2));
      })
      .catch((error) => {
        res.statusCode = 400;
        if (error instanceof Error) {
          res.end(JSON.stringify({
            ok: false,
            result: error.toString()
          }, null, 2));
          return;
        }
        res.end(JSON.stringify(error, null, 2));
      })
  }

  startClusterSeed(request) {
    var requestIds = Object.keys(this.requests);

    // ensure only one seed
    var countOfSeeds = 0;
    for (var i = 0; i < requestIds.length; i++) {
      if (this.requests[requestIds[i]].action == 'startClusterSeed') {
        countOfSeeds++;
      }
    }
    Object.keys(this.workers).forEach((workerId) => {
      var worker = this.workers[workerId];
      Object.keys(worker.servers).forEach((id) => {
        var server = worker.servers[id];
        if (server.action == 'startClusterSeed') countOfSeeds++;
      })
    });
    if (countOfSeeds > 1) {
      delete this.requests[request.id];
      return request.reject(new Error('Too many seeds (or seed requests)'));
    }

    var workerId = this.getNextWorker('server');
    if (!workerId) return request.reject(new Error('No workers'));
    request.workerId = workerId;

    this.client.set('/action-request/' + workerId, request, {noStore: true}, (e) => {
      if (e) return request.reject(e);
    });
  }

  startClusterNode(request) {
    var workerId = this.getNextWorker('server');
    if (!workerId) return request.reject(new Error('No workers'));
    request.workerId = workerId;

    this.client.set('/action-request/' + workerId, request, {noStore: true}, (e) => {
      if (e) return request.reject(e);
    });
  }

  onActionResponse(data, meta) {
    var request = this.requests[data.id];
    if (!request) return;

    if (!data.ok) {
      data.processed = true;
      this.log.error('remote action %s failed', data.action);
      this.log.error('data:\n', JSON.stringify(data, null, 2));
      request.reject(data);
      delete request.reject;
      delete request.resolve;
      delete this.requests[data.id];
      return;
    }

    data.processed = true;
    this.log.info('remote action %s succeeded', data.action);
    this.log.info('data:\n', JSON.stringify(data, null, 2));

    var type = data.action == 'startClusterSeed' || data.action == 'startClusterNode' ? 'servers' : 'clients';
    this.workers[data.workerId][type][data.id] = data;
    request.resolve(data);
    delete request.reject;
    delete request.resolve;
    delete this.requests[data.id];
  }

  getNextWorker(spawnType) {
    if (spawnType == 'server') {
      var min = 100000; // find list of workers with lowest count of servers

      // find minimum
      Object.keys(this.workers).forEach((id) => {
        var count = Object.keys(this.workers[id].servers).length;
        if (count < min) min = count;
      });

      // build list of targets that have minimum
      var targets = Object.keys(this.workers).filter((id) => {
        console.log(id, Object.keys(this.workers[id].servers));
        return Object.keys(this.workers[id].servers).length == min;
      });

      // return random one of targets
      return targets[Math.round(Math.random() * (targets.length - 1))];
    }
  }

  authorized(req, res) {
    if (!req.headers.authorization || req.headers.authorization !== password) {
      res.statusCode = 401;
      res.end('unauthorized');
      return false;
    }
    return true;
  }

}

module.exports = RunServer;
