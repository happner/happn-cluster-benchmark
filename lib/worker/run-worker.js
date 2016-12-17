var Promise = require('bluebird');
var childProcess = require('child_process');

var workerId = process.env.WORKER_ID || os.hostname();

class RunWorker {

  constructor(client) {
    this.client = client;
    this.log = client.log.createLogger('Worker');
    this.children = {}
  }

  start() {
    return Promise.resolve()

      .then(() => {
        return new Promise((resolve, reject) => {
          this.client.on('/action-request/' + workerId, this.onAction.bind(this), (e) => {
            if (e) return reject(e);
            resolve();
          })
        });
      })

  }

  onAction(data, meta) {
    this.log.info('action %s', data.action);
    try {
      this[data.action](data); // run function by action name
    } catch (e) {
      this.log.error('action error', e);

      data.ok = false;
      data.result = e.toString();

      this.client.set('/action-response', data, {noStore: true}, (e) => {
        if (e) this.log.error('action response sending error', e);
      });
    }
  }

  startClusterSeed(data) {
    var serverCount = this.getServerCount();

    var child = childProcess.fork(__dirname + '/clusterSeedServer', [serverCount], (e) => {
      if (e) console.log(e);
    });

    this.children[child.pid] = {
      server: true,
      process: child
    };

    child.on('message', (message) => {
      if (message.message == 'action-response') {
        data.ok = message.ok;
        data.result = message.result;

        this.client.set('/action-response', data, {noStore: true}, (e) => {
          if (e) this.log.error('action response sending error', e);
        });
      }
    });

    child.on('exit', () => {
      delete this.children[child.pid];
    });

    setInterval(() => {
      child.send({message: 1});
    }, 1000);
  }

  getServerCount() {
    return Object.keys(this.children)
      .filter((child) => this.children[child].server == true)
      .length;
  }

}

module.exports = RunWorker;
