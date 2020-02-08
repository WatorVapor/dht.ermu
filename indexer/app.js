const redis = require('redis');
const redisOption = {
  host:'node2.ceph.wator.xyz',
  port:16379,
  family:'IPv6',
  password:'QfIvXWQCxnTZlEpT',
};
const redisNewsChannelDiscovery = 'redis.channel.news.discover.multi.lang';
const gSubscriber = redis.createClient(redisOption);


gSubscriber.on('message', (channel, message) => {
  //console.log('gSubscriber::message=<',message,'>');
  onDiscoveryNewLink(message);
})
gSubscriber.subscribe(redisNewsChannelDiscovery);


const NewsTextReader = require('./wai/news.text.reader.js');
const constTextDBPath = '/storage/dhtfs/cluster/indexer/news_text_db';


const WaiIndexBot = require('./wai/wai.indexbot.js');

const wai = new WaiIndexBot();
const WaiIndexLinkCacheMax = 20;

const LevelDFS = require('../api/LevelDFS.js');
//console.log('::LevelDFS=<',LevelDFS,'>');
const db = new LevelDFS('/storage/dhtfs/cluster/news_pumper/cn/news_discovery_db');
const gNewMessageLinks = [];
const onDiscoveryNewLink = (msg) => {
  gNewMessageLinks.push(msg);
  if(gNewMessageLinks.length > WaiIndexLinkCacheMax) {
    gNewMessageLinks.shift();
  }
  setTimeout(onLearnNewLink,1);
}

const onLearnNewLink = () => {
  const now = new Date();
  if(gNewMessageLinks.length < 1) {
    console.log('onLearnNewLink:: gNewMessageLinks=<',gNewMessageLinks,'>');
    return;
  } 
  const msg = gNewMessageLinks[gNewMessageLinks.length -1];
  gNewMessageLinks.splice(-1);
  //console.log('onLearnNewLink:: gNewMessageLinks=<',gNewMessageLinks,'>');
  try {
    //console.log('onLearnNewLink::msg=<',msg,'>');
    const msgJson = JSON.parse(msg);
    //console.log('onLearnNewLink::msgJson=<',msgJson,'>');
    const href = msgJson.href;
    //console.log('onLearnNewLink::href=<',href,'>');
    //console.log('onLearnNewLink:: gNewMessageLinks=<',gNewMessageLinks,'>');
    db.get(href, (err, value) => {
      try {
        if(err) {
          throw err;
        }
        //console.log('onLearnNewLink::value=<',value,'>');
        const jsValue = JSON.parse(value);
        if(jsValue.indexer) {
          setTimeout(onLearnNewLink,1000);
          return;
        }
        jsValue.indexer = true;
        let contents = JSON.stringify(jsValue);
        db.put(href,contents);
        const txtReader = new NewsTextReader(constTextDBPath);
        //console.log('onLearnNewLink::jsValue=<',jsValue,'>');
        txtReader.fetch(href,(txt,title,myhref)=>{
          onNewsText(txt,title,myhref,jsValue.lang,jsValue);
        });
      } catch(e) {
        console.log('onLearnNewLink::e=<',e,'>');
      }
    });
  } catch(e) {
    console.log('onLearnNewLink::e=<',e,'>');
  }
}



const onNewsText = async (txt,title,myhref,lang,crawler) => {
  //console.log('onNewsText::txt=<',txt,'>');
  //console.log('onNewsText::title=<',title,'>');
  //console.log('onNewsText::myhref=<',myhref,'>');
  let wordIndex = wai.article(txt,lang);
  //console.log('onNewsText::wordIndex=<',wordIndex,'>');
  await onSaveIndex(myhref,wordIndex,lang,title,txt,crawler);
  setTimeout(onLearnNewLink,0);
}




const onSaveIndex = async (myhref,wordIndex,lang,title,txt,crawler) => {
  //console.log('onSaveIndex::myhref=<',myhref,'>');
  //console.log('onSaveIndex::wordIndex=<',wordIndex,'>');
  //console.log('onSaveIndex::lang=<',lang,'>');
  //console.log('onSaveIndex::title=<',title,'>');
  //console.log('onSaveIndex::txt=<',txt,'>');
  console.log('onSaveIndex::wordIndex.length=<',Object.keys(wordIndex).length,'>');
  const allSearchIndex = {};
  for(const word in wordIndex) {
    //console.log('onSaveIndex::word=<',word,'>');
    const searchIndex = Object.assign({word:word},wordIndex[word]);
    searchIndex.lang = lang;
    searchIndex.title = title;
    searchIndex.href = myhref;
    searchIndex.area = crawler.area;
    //console.log('onSaveIndex::searchIndex=<',searchIndex,'>');
    allSearchIndex[word] = searchIndex;
  }
  const searchContent = JSON.stringify(allSearchIndex);
  console.log('onSaveIndex::searchContent=<',searchContent,'>');
  //await onSaveIndex2DHT(searchIndex);
  const ipfsAddress = await onSaveIndex2IPFS(searchContent);
  console.log('onSaveIndex::ipfsAddress=<',ipfsAddress,'>');
  
  for(const word in wordIndex) {
    const index = wordIndex[word];
    await onSaveIndex2DHT(word,ipfsAddress,index.freq);
  }
  
  wai.clear();
  try {
    global.gc();
  } catch(e) {   
  }  
}


const DHT = require('../api/DHTRedis.js');
const dht = new DHT();
//console.log(':: dht=<',dht,'>');
dht.peerInfo((peerInfo)=>{
  console.log('dht.peerInfo:: peerInfo=<',peerInfo,'>');
});

const onSaveIndex2DHT = async (word,ipfsAddress,freq) => {
  console.log('onSaveIndex2DHT::word=<',word,'>');
  console.log('onSaveIndex2DHT::ipfsAddress=<',ipfsAddress,'>');
  console.log('onSaveIndex2DHT::freq=<',freq,'>');
  const promise = new Promise((resolve) => {
    dht.append(word,ipfsAddress,freq,(info) => {
      console.log('onSaveIndex2DHT:: info=<',info,'>');
      resolve(info);
    });
  });
  return promise;
}

const onSaveIndex2IPFS = async (searchContent) => {
  //console.log('onSaveIndex2DHT::searchContent=<',searchContent,'>');
  const promise = new Promise((resolve) => {
    dht.addIPFS(searchContent,(cid) => {
      console.log('onSaveIndex2IPFS:: cid=<',cid,'>');
      resolve(cid);
    });    
  });
  return promise;

}

/**
 test
**/
wai.onReady = () => {
  
  const hrefTest = 'https://3w.huanqiu.com/a/c36dc8/9CaKrnKoYBm?agt=8';
  console.log('wai.onReady:: hrefTest=<',hrefTest,'>');
  let contents = JSON.stringify({
    href:hrefTest,discover:true,lang:'cn',
    indexer:false,
    area:[
      '6zxss4axnqj3y2367j1pf6mdge5k6fph',
      'nvv21aetv386a71p7macwhgc98468gym'
    ]
  });
  db.put(hrefTest,contents);
  setTimeout(()=>{
    onDiscoveryNewLink(contents);
  },1000);
  
}

