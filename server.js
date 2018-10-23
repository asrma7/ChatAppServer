"use strict";
process.title = 'node-chat';

const express = require('express');
const SocketServer = require('ws').Server;
const path = require('path');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

var clients = new Map();
var sendNotification = function(to,message,title,id) {
  var headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Authorization": process.env.RESTAPI
  };
  
  var options = {
    host: "onesignal.com",
    port: 443,
    path: "/api/v1/notifications",
    method: "POST",
    headers: headers
  };
    var heading = {
       "en" : title
    };
    var content = {
       "en" : message
    };
  var message = { 
    app_id: process.env.APPID,
    filters : [{"field" : "tag", "key" : "user-id", "relation" : "=", "value" : to}],
    data : {"id" : id},
    contents : content,
    headings : heading,
    android_sound : 'sound',
    ios_sound : 'sound.wav',
    android_group : id,
    thread_id : id,
    android_accent_color : "FFABCDEF",
    android_led_color : "FFFFFFFF"
  };
  var https = require('https');
  var req = https.request(options, function(res) {  
    res.on('data', function(data) {
      console.log("Response:");
      console.log(JSON.parse(data));
    });
  });
  
  req.on('error', function(e) {
    console.log("ERROR:");
    console.log(e);
  });
  
  req.write(JSON.stringify(message));
  req.end();
};
var request = require('request');

function htmlEntities(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const server = express()
  .use((req, res) => res.sendFile(INDEX))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new SocketServer({ server });

wss.on('connection', (ws) => {
  var userName = null;
  ws.on('close', (userName) => clients.delete(userName));
  ws.on('message', function (json) {
    var msg = JSON.parse(json)
    if (msg.content != null) {
      if (msg.type == 'username') {
        userName = htmlEntities(msg.content);
        clients.set(userName, ws);
      } else
        if (msg.type == 'message') {
          var message = msg.content
          if (userName == null) {
            userName = htmlEntities(message);
            clients.set(userName, ws);
            ws.send(
              JSON.stringify({ type: 'color', data: 'true' }));
            // get random color and send it back to the user
          } else { // log and broadcast the message

            // we want to keep history of all sent messages
            var obj = {
              time: (new Date()).getTime(),
              text: htmlEntities(message),
              author: userName,
            };
            // broadcast message to all connected clients
            var json = JSON.stringify({ type: 'message', data: obj });
            var client = clients.get(msg.to);
            if (client != undefined && client != null) { client.send(json) }
            else{sendNotification(msg.to,obj.text,obj.author,obj.author);};
            if (clients.get(userName)!=client) { clients.get(userName).send(json);} 
            request.post({url:'http://hashtag2.gearhostpreview.com/newchat.php', form: {chat:obj.text,to:msg.to,from:obj.author}});
          }
        }
    }
  });
});

