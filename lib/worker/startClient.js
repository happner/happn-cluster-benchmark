// worker spawns this

const Happn = require('happn-3');

const data = JSON.parse(process.argv[3]);
const url = data.target.server.split(',').pop();
const password = process.env.PASSWORD || 'secret';

const config = {
  username: '_ADMIN',
  password: password,
  url: url
};

Happn.client.create(config)

  .then(client => {
    process.send({
      message: 'action-response',
      ok: true,
      result: {}
    });
    require('./' + data.options.script)(client, data);
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
