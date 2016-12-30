// worker spawns this

const Happn = require('happn-3');

const data = JSON.parse(process.argv[3]);
const servers = data.target.server.split(',');
const url = data.options.proxy ? servers[2] : servers[3];
const password = process.env.PASSWORD || 'secret';

const config = {
  username: '_ADMIN',
  password: password,
  url: url
};

Happn.client.create(config)

  .then(client => {
    require('./' + data.options.script)(client, data, error => {
      process.send({
        message: 'action-response',
        ok: error ? false : true,
        result: error ? error.toString() : {}
      });
    });
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
