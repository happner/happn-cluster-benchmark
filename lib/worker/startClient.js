// worker spawns this

var data = JSON.parse(process.argv[3]);

process.send({
  message: 'action-response',
  ok: true,
  result: {}
});



