'use strict';
const fs = require('fs');
const path = require('path');
const jsrsasign = require('jsrsasign');
const RIPEMD160 = require('ripemd160');
const base32 = require("base32.js");
const bs32Option = { type: "crockford", lc: true };
const PeerMachine = require('./peer.machine.js');
const iConstPeersAtOneTime = 200;
const level = require('level');
const strConstDBName = 'wator.search.db';
const strConstStatsName = 'stats.json';
const iConstResourceOnce = 16;

class PeerStorage {
  constructor(config) {
    console.log('PeerStorage::constructor: config.reps=<',config.reps,'>');
    this._pathPeer = config.reps.dht + '/peerspace';
    if (!fs.existsSync(this._pathPeer)) {
      fs.mkdirSync(this._pathPeer,{ recursive: true });
    }    console.log('PeerStorage::constructor: config=<',config,'>');
    this.machine_ = new PeerMachine(config);
    this.dbOpenCache_ = {}; 
  }
  async append(request) {
    //console.log('PeerStorage::append: request=<',request,'>');
    const keyAddress = request.address;
    //console.log('PeerStorage::append: keyAddress=<',keyAddress,'>');
    const keyPath = this.getPath4KeyAddress_(keyAddress);
    //console.log('PeerStorage::append: keyPath=<',keyPath,'>');
    if (!fs.existsSync(keyPath)) {
      fs.mkdirSync(keyPath,{ recursive: true });
    }
    const rankPath = keyPath + '/' + request.rank;
    if (!fs.existsSync(rankPath)) {
      fs.mkdirSync(rankPath,{ recursive: true });
    }
    const dbPath = rankPath + '/' + strConstDBName;
    let db = false;
    try {
      //console.log('PeerStorage::append dbPath=<',dbPath,'>');
      if(!this.dbOpenCache_[dbPath]) {
        //console.log('PeerStorage::append this.dbOpenCache_=<',this.dbOpenCache_,'>');
        db = level(dbPath);
        this.dbOpenCache_[dbPath] = db;
      } else {
        db = this.dbOpenCache_[dbPath];
      }
      const result = await db.get(request.ipfs);
      //console.log('PeerStorage::append result=<',result,'>');
    } catch(err) {
      if (err) {
        if (err.notFound) {
          await this.saveNewResult_(request.ipfs,db,rankPath);
          const self = this;
          setTimeout(()=>{
            if(self.dbOpenCache_[dbPath]) {
              self.dbOpenCache_[dbPath].close();
              delete self.dbOpenCache_[dbPath];
            }
          },1000 * 5);
        } else {
          console.log('PeerStorage::append e=<',e,'>');
        }
      }
    }
  }

  fetch(request,cb) {
    //console.log('PeerStorage::fetch: request=<',request,'>');
    const keyAddress = request.address;
    //console.log('PeerStorage::fetch: keyAddress=<',keyAddress,'>');    
    const keyPath = this.getPath4KeyAddress_(keyAddress);
    //console.log('PeerStorage::fetch: keyPath=<',keyPath,'>');
    if (fs.existsSync(keyPath)) {
      const files = fs.readdirSync(keyPath);
      //console.log('PeerStorage::fetch: files=<',files,'>');
      let totalResult = 0;
      const rankConter = {};
      for(const rank of files) {
        console.log('PeerStorage::fetch: rank=<',rank,'>');
        const dbStats = keyPath + '/' + rank + '/' + strConstStatsName;
        try {
          const stats = require(dbStats);
          if(stats.count > 0) {
            totalResult += stats.count;
            rankConter[rank] = stats.count;
          }
        } catch(e) {
          
        }
      }
      const responseStats = {stats:{totalResult:totalResult},finnish:false};
      if(typeof cb === 'function') {
        cb(responseStats);
      }
      //console.log('PeerStorage::fetch: rankConter=<',rankConter,'>');
      let start = request.start;
      if(!start) {
        start = 0;
      }
      //console.log('PeerStorage::fetch: start=<',start,'>');
      const rankKeys = Object.keys(rankConter);
      rankKeys.sort((a,b) => {return parseInt(b) - parseInt(a);});
      //console.log('PeerStorage::fetch: rankKeys=<',rankKeys,'>');
      let countCollect = 0;
      const rankGather = [];
      for(const rank of rankKeys) {
        const count = rankConter[rank];
        //console.log('PeerStorage::fetch: count=<',count,'>');
        //console.log('PeerStorage::fetch: rank=<',rank,'>');
        if(countCollect + count > start) {
          rankGather.push({rank:rank,collect:countCollect});
        }
        countCollect += count;
      }
      //console.log('PeerStorage::fetch: rankGather=<',rankGather,'>');
      const results = [];
      let onReadCounter = 0;
      const gatherResult = (index)=> {
        if(rankGather.length > index) {
          const rankInfo = rankGather[index];
          //console.log('PeerStorage::fetch: rankInfo=<',rankInfo,'>');
          const rank = rankInfo.rank;
          const collect = rankInfo.collect;
          const dbPath = keyPath + '/' + rank + '/' + strConstDBName;
          //console.log('PeerStorage::fetch: dbPath=<',dbPath,'>');
          let db = false;
          if(!this.dbOpenCache_[dbPath]) {
            db = level(dbPath);
            this.dbOpenCache_[dbPath] = db;
          } else {
            db = this.dbOpenCache_[dbPath];
          }
          const skipCounter = start - rankGather[0].collect;
          const keyStream = db.createKeyStream();
          keyStream.on('data',  (data) =>{
            //console.log('PeerStorage::fetch: data=<',data,'>');
            if(onReadCounter > skipCounter) {
              results.push(data);
            }
            if(results.length >= iConstResourceOnce) {
              const responseResult = {results:results,finnish:true};
              if(typeof cb === 'function') {
                cb(responseResult);
              }
              keyStream.close();
            }
            onReadCounter++;
          });
          keyStream.on('end',  () =>{
            if(results.length < iConstResourceOnce) {
              gatherResult(index+1);
            }
          });
        } else {
          const responseResult = {results:results,finnish:true};
          if(typeof cb === 'function') {
            cb(responseResult);
          }          
        }
      }
      gatherResult(0);
    } else {
      const responseStats = {stats:{totalResult:0},finnish:true};
      if(typeof cb === 'function') {
        cb(responseStats);
      }
    }
  }
  
  
  getAddress_(resourceKey) {
    const resourceRipemd = new RIPEMD160().update(resourceKey).digest('hex');
    const resourceBuffer = Buffer.from(resourceRipemd,'hex');
    return base32.encode(resourceBuffer,bs32Option);
    return 
  }
  getPath4KeyAddress_(address) {
    let pathAddress = this._pathPeer;
    pathAddress += '/' + address.substring(0,3);
    pathAddress += '/' + address.substring(3,6);
    pathAddress += '/' + address;
    return pathAddress;
  }

  async saveNewResult_(resource,db,pPath) {
    const result2 = await db.put(resource, '');
    //console.log('PeerStorage::saveNewResult_ result2=<',result2,'>');
    const statsPath = pPath + '/' + strConstStatsName;
    let stats = {};
    try {
      stats = require(statsPath);
    } catch(e) {
      
    }
    if(stats.count) {
      stats.count++;
    } else {
      stats.count = 1;
    }
    fs.writeFileSync(statsPath,JSON.stringify(stats));
  }


}
module.exports = PeerStorage;

