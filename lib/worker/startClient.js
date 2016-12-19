// worker spawns this

var Happn = require('happn-3');

var data = JSON.parse(process.argv[3]);
var url = data.target.server.split(',').pop();
var password = process.env.PASSWORD || 'secret';

var config = {
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
    require('./' + data.options.script)(client);
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
