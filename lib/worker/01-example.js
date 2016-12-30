module.exports = (client, data, callback) => {

  // `client` logged into happn-cluster node

  let reportInterval = 1000;

  setInterval(() => {

    process.send({
      message: 'result',
      data: {
        any: 'thing',
        you: 'want'
      }
    })

  }, reportInterval);

  // callback(new Error('Something wrong'));

  callback();

};
