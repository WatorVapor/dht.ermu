const redis = require('redis');
const redisOption = {
  path:'/dev/shm/dht.ermu.api.redis.sock'
};
const channelWS2DHT = 'enum.www.search.ws2dht';
const channelDHT2WS = 'enum.www.search.dht2ws';

const subRedis = redis.createClient(redisOption);
const pubRedis  = redis.createClient(redisOption);
subRedis.on('message', (channel, message) => {
  onRedisMsg(channel, message);
});
subRedis.subscribe(channelWS2DHT);

const onRedisMsg = (channel, message) => {
  console.log('onRedisMsg::channel=<',channel,'>');
  console.log('onRedisMsg::message=<',message,'>');
  try {
    const jsonMsg = JSON.parse(message);
    onReqKeyWord(jsonMsg);
  } catch(e) {
    
  }
}


const KeyWordStore = require('dht.mesh').KW;
const kw = new KeyWordStore();
//console.log('::.:: kw=<',kw,'>');

const KeyValueStore = require('dht.mesh').KV;
const kv = new KeyValueStore();
//console.log('::.:: kv=<',kv,'>');

kv.onData = (data) => {
  console.log('kv.onData:: data=<',data,'>');
}

kw.onData = (data) => {
  console.log('kw.onData:: data=<',data,'>'); 
  if(data.content) {
    fetchKValue(data.content);
  }
}

const onReqKeyWord = (reqMsg)=> {
  console.log('onReqKeyWord::reqMsg=<',reqMsg,'>');
  if(reqMsg.words) {
    const replyTag = kw.fetch(reqMsg.words,reqMsg.begin) ;
    console.log('onReqKeyWord::replyTag=<',replyTag,'>');
  }
}

const fetchKValue = (contents) => {
  for(const address of contents) {
    console.log('fetchKValue:: address=<',address,'>');
    const replyTag = kv.fetch(address);
    console.log('fetchKValue::replyTag=<',replyTag,'>');
  }
}