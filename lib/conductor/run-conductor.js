var Promise = require('bluebird'); // remain consistent with happn
var bodyParser = require('body-parser');
var shortid = require('shortid');
var clone = require('clone');

var password = process.env.PASSWORD || 'secret';

class RunServer {

  constructor(server, client) {
    this.log = server.log.createLogger('Conductor');
    this.server = server;
    this.client = client;
    this.workers = {};
    this.requests = {};
    this.spreads = {};
    this.broadcasts = {};
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
        this.server.connect.use('/kill', this.onGetKill.bind(this));
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
        this.server.connect.use('/start-cluster-clients', bodyParser.json());
        this.server.connect.use('/start-cluster-clients', this.onPostStartClusterClients.bind(this));
      })

      .then(() => {
        return new Promise((resolve, reject) => {
          this.client.on('/action-response', this.onActionResponse.bind(this), e => {
            if (e) return reject(e);
            resolve();
          })
        });
      })

      .then(() => {
        return new Promise((resolve, reject) => {
          this.client.on('/broadcast-response', this.onBroadcastResponse.bind(this), e => {
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
   https://localhost:55000/kill
   */
  onGetKill(req, res) {
    if (!this.authorized(req, res)) return;
    this.log.info('GET /kill');
    return this.startActionBroadcast(res, 'kill', {/* options */});
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
        result: 'Error: Missing cluster seed'
      }, null, 2));
      return;
    }
    var options = {
      swim: swim
    };
    return this.startActionSingle(res, 'startClusterNode', options);
  }

  /*
   curl \
   -k \
   -H "Authorization: secret" \
   -H "Content-Type: application/json" \
   -X POST \
   -d '{
   "count": 5,
   "script": "00-client"
   }' \
   https://localhost:55000/start-cluster-clients
   */
  onPostStartClusterClients(req, res) {
    if (!this.authorized(req, res)) return;
    this.log.info('POST /start-cluster-clients');
    if (this.countServers() == 0) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        ok: false,
        result: 'Error: No servers'
      }, null, 2));
      return;
    }
    return this.startActionSpread(res, 'startClient', req.body);
  }

  countServers() {
    var count = 0;
    Object.keys(this.workers).forEach(workerId => {
      var worker = this.workers[workerId];
      count += Object.keys(worker.servers).length;
    });
    return count;
  }

  getSwimJoin() {
    var swim;
    Object.keys(this.workers).forEach(workerId => {
      var worker = this.workers[workerId];
      Object.keys(worker.servers).forEach(id => {
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
        resolve: resolve,
        reject: reject
      };
      this[action](this.requests[id]);
    })
      .then(result => {
        res.end(JSON.stringify(result, null, 2));
      })
      .catch(error => {
        res.statusCode = 400;
        if (error instanceof Error) {
          res.end(JSON.stringify({
            ok: false,
            result: error.toString()
          }, null, 2));
          return;
        }
        res.end(JSON.stringify(error, null, 2));
      });
  }

  startActionSpread(res, action, options) {
    var targets = this.getSpreadTargets(options.count);
    var spreadId = shortid.generate();
    Promise.resolve(targets).map(target => {
      return new Promise((resolve, reject) => {
        var id = shortid.generate();
        this.requests[id] = {
          id: id,
          spreadId: spreadId,
          spreadCount: targets.length,
          action: action,
          options: options,
          target: target,
          resolve: resolve,
          reject: reject
        };
        this[action](this.requests[id]);
      });
    })
      .then(results => {
        var spreadId = results[0].spreadId;
        var spread = this.spreads[spreadId];
        delete this.spreads[spreadId];
        delete spread.count;
        res.end(JSON.stringify(spread, null, 2));
      })
      .catch(error => {
        res.statusCode = 400;
        if (error instanceof Error) {
          res.end(JSON.stringify({
            ok: false,
            result: error.toString()
          }, null, 2));
          return;
        }
        res.end(JSON.stringify(error, null, 2));
      });
  }

  startActionBroadcast(res, action, options) {
    var broadcastId = shortid.generate();
    var targets = Object.keys(this.workers);
    Promise.resolve(targets).map(target => {
      return new Promise((resolve, reject) => {
        var id = shortid.generate();
        this.requests[id] = {
          id: id,
          broadcastId: broadcastId,
          broadcastCount: targets.length,
          action: action,
          options: options,
          target: target,
          resolve: resolve,
          reject: reject
        };
        this.client.set('/broadcast-request/' + target, this.requests[id], {noStore: true}, e => {
          if (e) return request.reject(e);
        })
      });
    })
      .then(results => {
        var broadcastId = results[0].broadcastId;
        var broadcast = this.broadcasts[broadcastId];
        delete this.broadcasts[broadcastId];
        delete broadcast.count;
        res.end(JSON.stringify(broadcast, null, 2));
      })

      .catch(error => {
        res.statusCode = 400;
        if (error instanceof Error) {
          res.end(JSON.stringify({
            ok: false,
            result: error.toString()
          }, null, 2));
          return;
        }
        res.end(JSON.stringify(error, null, 2));
      });
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
    Object.keys(this.workers).forEach(workerId => {
      var worker = this.workers[workerId];
      Object.keys(worker.servers).forEach(id => {
        var server = worker.servers[id];
        if (server.action == 'startClusterSeed') countOfSeeds++;
      })
    });
    if (countOfSeeds > 1) {
      delete this.requests[request.id];
      return request.reject(new Error('Too many seeds (or seed requests)'));
    }

    var workerId = this.getNextWorker('server');
    if (!workerId) {
      delete this.requests[request.id];
      return request.reject(new Error('No workers'));
    }
    request.workerId = workerId;

    this.client.set('/action-request/' + workerId, request, {noStore: true}, e => {
      if (e) return request.reject(e);
    });
  }

  startClusterNode(request) {
    var workerId = this.getNextWorker('server');
    if (!workerId) {
      delete this.requests[request.id];
      return request.reject(new Error('No workers'));
    }
    request.workerId = workerId;

    this.client.set('/action-request/' + workerId, request, {noStore: true}, e => {
      if (e) return request.reject(e);
    });
  }

  startClient(request) {
    var workerId = request.target.worker;
    request.workerId = workerId;

    this.client.set('/action-request/' + workerId, request, {noStore: true}, e => {
      if (e) return request.reject(e);
    });
  }

  onActionResponse(data, meta) {
    if (data.target) {
      return this.onActionSpreadResponse(data);
      return;
    }

    var request = this.requests[data.id];
    if (!request) return;

    if (!data.ok) {
      this.log.error('remote action %s failed', data.action);
      this.log.error('data:\n', JSON.stringify(data, null, 2));
      request.reject(data);
      delete request.reject;
      delete request.resolve;
      delete this.requests[data.id];
      return;
    }

    this.log.info('remote action %s succeeded', data.action);
    this.log.info('data:\n', JSON.stringify(data, null, 2));

    var type = data.action == 'startClusterSeed' || data.action == 'startClusterNode' ? 'servers' : 'clients';
    this.workers[data.workerId][type][data.id] = data;
    request.resolve(clone(data));

    if (type == 'servers') {
      data.clients = 0;
    }

    delete request.reject;
    delete request.resolve;
    delete this.requests[data.id];
  }

  onBroadcastResponse(data, meta) {
    var request = this.requests[data.id];
    if (!request) return;

    var broadcastId = data.broadcastId;
    var broadcastCount = data.broadcastCount;
    var finalResult = this.broadcasts[broadcastId] = this.broadcasts[broadcastId] || {
        count: 0,
        ok: true,
        result: '0 of ' + broadcastCount
      };

    if (!data.ok) {
      this.log.error('remote action %s failed', data.action);
      this.log.error('data:\n', JSON.stringify(data, null, 2));

      finalResult.ok = false;
      request.resolve(data);

      delete request.reject;
      delete request.resolve;
      delete this.requests[data.id];
      return;
    }

    this.workers[data.workerId] = {};
    var count = parseInt(finalResult.result.split(' ')[0]);
    count++;
    finalResult.result = count + ' of ' + broadcastCount;
    request.resolve(data);

    delete request.reject;
    delete request.resolve;
    delete this.requests[data.id];
  }

  onActionSpreadResponse(data) {
    var request = this.requests[data.id];
    if (!request) return;

    var spreadId = data.spreadId;
    var spreadCount = data.spreadCount;
    var finalResult = this.spreads[spreadId] = this.spreads[spreadId] || {
        count: 0,
        ok: true,
        result: '0 of ' + spreadCount
      };

    finalResult.count++;

    if (!data.ok) {
      this.log.error('remote action %s failed', data.action);
      this.log.error('data:\n', JSON.stringify(data, null, 2));

      finalResult.ok = false;
      request.resolve(data);

      delete request.reject;
      delete request.resolve;
      delete this.requests[data.id];
      return;
    }

    var type = 'clients';
    this.workers[data.workerId][type][data.id] = data;

    try {
      var [workerId, serverId] = data.target.server.split(',');
      this.workers[workerId].servers[serverId].clients++;
    } catch (e) {
    }

    var count = parseInt(finalResult.result.split(' ')[0]);
    count++;
    finalResult.result = count + ' of ' + spreadCount;
    request.resolve(data);

    delete request.reject;
    delete request.resolve;
    delete this.requests[data.id];
  }

  getSpreadTargets(count) {
    var targets = [];
    var workers = {};
    var servers = {};

    for (var workerId in this.workers) {
      workers[workerId] = 0;
      workers[workerId] += Object.keys(this.workers[workerId].servers).length;
      workers[workerId] += Object.keys(this.workers[workerId].clients).length;

      for (var serverId in this.workers[workerId].servers) {
        var server = this.workers[workerId].servers[serverId];
        var happn = server.result.happn;
        var clients = server.clients;
        var key = workerId + ',' + serverId + ',' + happn
        servers[key] = clients;
      }
    }

    function assignToWorkers(remaining) {
      if (remaining == 0) return;
      var min = Number.MAX_SAFE_INTEGER;
      var selected = null;
      for (var workerId in workers) {
        if (workers[workerId] < min) {
          min = workers[workerId];
          selected = workerId;
        }
      }
      workers[selected]++;
      targets.push({
        worker: selected
      });
      assignToWorkers(--remaining);
    }

    assignToWorkers(count);

    function assignToServers(remaining) {
      if (remaining == 0) return;
      var min = Number.MAX_SAFE_INTEGER;
      var selected = null;
      for (var server in servers) {
        if (servers[server] < min) {
          min = servers[server];
          selected = server;
        }
      }
      servers[selected]++;
      targets[remaining - 1].server = selected;
      assignToServers(--remaining)
    }

    assignToServers(count);

    return targets;
  }

  getNextWorker(spawnType) {
    if (spawnType == 'server') {
      var min = Number.MAX_SAFE_INTEGER; // find list of workers with lowest count of servers

      // find minimum
      Object.keys(this.workers).forEach(id => {
        var count = Object.keys(this.workers[id].servers).length;
        if (count < min) min = count;
      });

      // build list of targets that have minimum
      var targets = Object.keys(this.workers).filter(id => {
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
