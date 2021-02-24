let fs;

try {
  // Node 14.x
  fs = require('fs/promises');
} catch (error) {
  // Node 12.x
  fs = require('fs').promises;
}

const express = require('express');
const emojiRegexRGI = require('emoji-regex/RGI_Emoji.js');
const SocketIO = require('socket.io');
const PORT = process.env.PORT || 4000;

const files = {
  '/': '/index.html',
  '/object_hash.js': '/node_modules/object-hash/dist/object_hash.js',
};

const app = express();

app.get('*', async (req, res) => {
  let file = files['/'];
  if (files[req.path]) {
    file = files[req.path];
  }
  const contents = await fs.readFile(`${__dirname}${file}`, 'utf8');
  res.send(contents.replace('/***PORT***/', `${PORT}`));
});

const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));
const io = SocketIO(server);

io.on('connection', (socket) => {
  socket.join(socket.handshake.auth.token);

  socket.on('disconnect', () => {
    socket.leave(socket.handshake.auth.token);
  });

  /*
    THIS IS THE IMPORTANT PART FOR CONSTRUCTING AN AGENT THAT
    TEACHER MOMENTS CAN INTERACT WITH
  */
  socket.on('request', payload => {
    /*


     */

    const {
      context,
      token,
      value,
    } = payload;

    // "Process" the incoming data
    const remoji = emojiRegexRGI();
    const result = remoji.test(value);
    const response = {
      ...payload,
      result
    };

    // Send the response
    io.to(token).emit('response', response);

    // Store the response for async analysis
    // Use the socket as the key, since this
    // is unique to each connection.
    //
    // This is for demonstration only.
    store.set(socket, [
      ...(store.get(socket) || []),
      response
    ]);
  });
  /*
    END
  */
});

const store = new Map();
const defaultThreshold = 2;
const thresholdMap = {};

setInterval(() => {
  const log = {};
  for (const [socket, responses] of store) {
    for (const response of responses) {
      const {
        context,
        token,
        result,
        value,
      } = response;

      if (!thresholdMap[token]) {
        thresholdMap[token] = defaultThreshold;
      }
      const threshold = thresholdMap[token];

      if (!log[response.token]) {
        log[response.token] = [];
      }

      if (response.result) {
        log[response.token].push(response);
      }

      if (log[response.token].length === threshold) {
        thresholdMap[token] += 2;
        const message = `
        You've used emojis in ${threshold} messages. You will trigger this message again if you use emojis in ${thresholdMap[token]} messages.
        `.trim();
        console.log(message);
        io.to(token).emit('interjection', {
          token,
          context,
          message
        });
        log[response.token].length = 0;
      }
    }
  }
}, 3000);
