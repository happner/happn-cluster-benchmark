let {generate} = require('shortid');

module.exports = (client, data, callback) => {

  let accumulate = {};
  let lagArray = [];
  let errors = 0;

  let {
    messageInterval,
    messageIncrementInterval,
    increment,
    reportInterval,
    averagerWindowSize,
    payloadSize,
    noStore
  } = data.options;

  messageInterval = parseInt(messageInterval);
  messageIncrementInterval = parseInt(messageIncrementInterval);
  increment = parseInt(increment);
  reportInterval = parseInt(reportInterval);
  averagerWindowSize = parseInt(averagerWindowSize);
  payloadSize = parseInt(payloadSize);
  noStore = noStore == '1';

  let sending = setInterval(sendMessage, messageInterval);
  let incrementing = setInterval(incrementSendInterval, messageIncrementInterval);
  let reporting = setInterval(sendReport, reportInterval);
  let messageCountSent = 0;
  let messageCountReceived =  0;

  function sendMessage() {
    let payload = generatePayload();
    client.set(payload.path, payload.data, {noStore: noStore}, (e) => {
      if (e) {
        // client.log.error('sendMessage error', e);
        errors++;
      }
      messageCountSent++;
    })
  }

  function incrementSendInterval() {
    clearInterval(sending);
    messageInterval += increment;
    if (messageInterval < 0) messageInterval = 0;
    sending = setInterval(sendMessage, messageInterval);
  }

  function sendReport() {

    try {


      let lagAverage = round(lagArray.reduce((a, b) => a + b) / lagArray.length);
      let intervalsArray = [];
      for (let pid in accumulate) {
        intervalsArray = intervalsArray.concat(accumulate[pid].interval);
      }
      let intervalAverage = round(intervalsArray.reduce((a, b) => a + b) / intervalsArray.length);


      process.send({
        message: 'result',
        pid: process.pid,
        data: [
          reportInterval,
          messageInterval,   // sending interval
          intervalAverage,   // receiving interval
          lagAverage,        // round-trip lag
          round(messageCountSent / (reportInterval / 1000)),     // sent per second
          round(messageCountReceived / (reportInterval / 1000)), // received per second
          round(errors / (reportInterval / 1000)) // set errors per second
        ]
      });

      console.log(
        reportInterval,
        messageInterval,   // sending interval
        intervalAverage,   // receiving interval
        lagAverage,        // round-trip lag
        round(messageCountSent / (reportInterval / 1000)),     // sent per second
        round(messageCountReceived / (reportInterval / 1000)), // received per second
        round(errors / (reportInterval / 1000)) // set errors per second
      );
    } catch (e) {
      console.error('report error', e);
    }

    messageCountSent = 0;
    messageCountReceived = 0;
    errors = 0;
  }

  function generatePayload() {
    let id = generate();
    return {
      path: '/global/test/' + data.options.groupId + '/' + id,
      data: {
        id: id,
        pid: process.pid,
        // int: messageInterval,
        ts: Date.now(),
        text: generateText(payloadSize)
      }
    }
  }

  function generateText(length) {
    var possible = 'ab cde f gh ijklmnopqr st u vw x yz';
    var text = '';
    for (var i = 0; i < length; i++) {
      text += possible[Math.round(Math.random() * (possible.length - 1))];
    }
    return text;
  }

  function insert(value, array) {
    array.push(value);
    while (array.length > averagerWindowSize) array.shift();
  }

  function round(value) {
    return Math.round(value * 100) / 100
  }

  function onReceivedMessage(data) {
    let now = Date.now();
    let lag = now - data.ts;
    let messageInterval = data.int;

    messageCountReceived++;

    insert(lag, lagArray);

    if (!accumulate[data.pid]) {
      accumulate[data.pid] = {
        previousTime: now,
        // previousInterval: messageInterval,
        // offset: []
        interval: []
      };
      return;
    }

    // let record = accumulate[data.pid];
    // let offset = now - record.previousTime;
    // offset -= record.previousInterval;
    // insert(offset, record.offset);

    let record = accumulate[data.pid];
    let interval = now - record.previousTime;
    insert(interval, record.interval);

    record.previousTime = now;
    // record.previousInterval = messageInterval;
  }

  client.on('/global/test/' + data.options.groupId + '/*', onReceivedMessage, callback);
};
