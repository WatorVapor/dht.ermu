'use strict';
const path = require('path');
//console.log(':: __filename=<',__filename,'>');
const dhtPath = '/storage/dhtfs/cluster/' + path.parse(__filename).name + '/peerstore';
const dataPath = '/storage/dhtfs/cluster/' + path.parse(__filename).name + '/datastore';
const config = {
  listen:{
    ctrl:{
      port:8890
    },
    data:{
      port:8891
    }
  },
  entrance:[
    {
      host:'2400:2412:13e0:9d00:2ce:39ff:fece:132',
      port:8890
    },
    {
      host:'2400:2412:13e0:9d00:8639:beff:fe67:dcc9',
      port:8890
    }
  ],
  reps: {
    dht:dhtPath,
    data:dataPath
  }
};
//console.log(':: config=<',config,'>');
const DHT = require('../src/dht.js');
const dht = new DHT(config);
//console.log(':: dht=<',dht,'>');
const peer = dht.peerInfo();
console.log(':: peer=<',peer,'>');
