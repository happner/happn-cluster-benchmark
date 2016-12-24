const Promise = require('bluebird');
const childProcess = require('child_process');

const workerId = process.env.WORKER_ID || os.hostname();

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
          this.client.on('/action-request/' + workerId, this.onAction.bind(this), e => {
            if (e) return reject(e);
            resolve();
          })
        });
      })

      .then(() => {
        return new Promise((resolve, reject) => {
          this.client.on('/broadcast-request/' + workerId, this.onBroadcast.bind(this), e => {
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

      this.client.set('/action-response', data, {noStore: true}, e => {
        if (e) this.log.error('action response sending error', e);
      });
    }
  }

  onBroadcast(data, meta) {
    this[data.action](data);
  }

  startClusterSeed(data) {
    this.startClusterServer('startClusterSeed', data);
  }

  startClusterNode(data) {
    this.startClusterServer('startClusterNode', data);
  }

  startClusterServer(script, data) {
    const serverCount = this.getServerCount();

    const child = childProcess.fork(__dirname + '/' + script, [serverCount, JSON.stringify(data)], e => {
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

        this.client.set('/action-response', data, {noStore: true}, e => {
          if (e) this.log.error('action response sending error', e);
        });
      }
    });

    child.on('exit', () => {
      delete this.children[child.pid];
      this.log.info('remaining processes: %d', Object.keys(this.children).length);
    });
  }

  startClient(data) {
    const child = childProcess.fork(__dirname + '/startClient', [0, JSON.stringify(data)], e => {
      if (e) console.log(e);
    });

    this.children[child.pid] = {
      server: false,
      process: child
    };

    child.on('message', (message) => {
      if (message.message == 'result') {
        message.id = data.id;
        message.workerId = data.workerId;
        message.groupId = data.options.groupId;

        delete message.message;

        this.client.set('/action-result', message, {noStore: true}, e => {
          if (e) this.log.error('action result sending error', e);
        });
        return;
      }
      if (message.message == 'action-response') {
        data.ok = message.ok;
        data.result = message.result;

        this.client.set('/action-response', data, {noStore: true}, e => {
          if (e) this.log.error('action response sending error', e);
        });
      }
    });

    child.on('exit', () => {
      delete this.children[child.pid];
      this.log.info('remaining processes: %d', Object.keys(this.children).length);
    });
  }

  kill(data) {
    Object.keys(this.children).forEach(id => {
      let child = this.children[id];
      child.process.kill();
    });

    data.ok = true;
    this.client.set('/broadcast-response', data, {noStore: true}, e => {
      if (e) this.log.error('action response sending error', e);
    });
  }

  getServerCount() {
    return Object.keys(this.children)
      .filter(child => this.children[child].server == true)
      .length;
  }

}

module.exports = RunWorker;
