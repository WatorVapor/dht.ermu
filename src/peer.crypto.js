'use strict';
const fs = require('fs');
const jsrsasign = require('jsrsasign');
const bs58 = require('bs58');
const RIPEMD160 = require('ripemd160');



const iConstMessageOutDateInMs = 1000 * 60;
class PeerCrypto {
  constructor(config) {
    //console.log('PeerCrypto::constructor config=<',config,'>');
    if(!fs.existsSync(config.reps.dht)) {
      fs.mkdirSync(config.reps.dht,{ recursive: true });
    }
    this.keyPath = config.reps.dht + '/keyMaster.json';
    //console.log('PeerCrypto::constructor this.keyPath=<',this.keyPath,'>');
    if(fs.existsSync(this.keyPath)) {
      this.loadKey__();
    } else {
      this.createKey__();
    }
    //console.log('PeerCrypto::loadKey this.keyMaster=<',this.keyMaster,'>');
    this.calcKeyB58__();
    //console.log('PeerCrypto::constructor this.pubB58=<',this.pubB58,'>');
    //console.log('PeerCrypto::constructor this.idB58=<',this.idB58,'>');
  }
  sign(msg) {
    let now = new Date();
    msg.sign = {};
    msg.sign.ts = now.toGMTString();
    msg.sign.ms = now.getMilliseconds();
    msg.sign.pubKey = this.pubB58;
    
    let msgStr = JSON.stringify(msg);
    let msgHash = new RIPEMD160().update(msgStr).digest('hex');
    //console.log('PeerCrypto::sign msgHash=<',msgHash,'>');
    let sign = {hash:msgHash};
    
    const ec = new jsrsasign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
    const sigValue = ec.signHex(msgHash, this.keyMaster.prvKeyHex);
    //console.log('PeerCrypto::sign sigValue=<',sigValue,'>');
    msg.signed = {} 
    msg.signed.hash = msgHash;
    msg.signed.val = sigValue;
    return msg;
  }

  verify(msgJson) {
    const now = new Date();
    const msgTs = new Date(msgJson.sign.ts);
    msgTs.setMilliseconds(msgJson.sign.ms)
    const escape_time = now -msgTs;
    //console.log('PeerCrypto::verify escape_time=<',escape_time,'>');
    if(escape_time > iConstMessageOutDateInMs) {
      return false;
    }
    
    const hashMsg = Object.assign({}, msgJson);
    delete hashMsg.signed;

    let msgStr = JSON.stringify(hashMsg);
    let msgHash = new RIPEMD160().update(msgStr).digest('hex');
    //console.log('PeerCrypto::verify msgHash=<',msgHash,'>');
    if(msgHash !== msgJson.signed.hash) {
      return false;
    }
    let pubKeyHex = bs58.decode(msgJson.sign.pubKey).toString('hex');
    //console.log('PeerCrypto::verify pubKeyHex=<',pubKeyHex,'>');
    
    const ec = new jsrsasign.KJUR.crypto.ECDSA({'curve': 'secp256r1'});
    const verifyResult = ec.verifyHex(msgJson.signed.hash,msgJson.signed.val,pubKeyHex);
    //console.log('PeerCrypto::verify verifyResult=<',verifyResult,'>');
    return verifyResult;
  }
  calcID(msgJson) {
    const pubKeyHex = bs58.decode(msgJson.sign.pubKey).toString('hex');
    const keyRipemd = new RIPEMD160().update(pubKeyHex).digest('hex');
    const keyBuffer = Buffer.from(keyRipemd,'hex');
    return bs58.encode(keyBuffer);
  }
  calcTopic(topic) {
    const topicRipemd = new RIPEMD160().update(topic).digest('hex');
    const topicBuffer = Buffer.from(topicRipemd,'hex');
    return bs58.encode(topicBuffer);
  }
  calcResourceAddress(resourceKey) {
    const resourceRipemd = new RIPEMD160().update(resourceKey).digest('hex');
    const resourceBuffer = Buffer.from(resourceRipemd,'hex');
    return bs58.encode(resourceBuffer);
  }

  
  
  loadKey__() {
    const keyJson = require(this.keyPath);
    //console.log('PeerCrypto::loadKey__ keyJson=<',keyJson,'>');
    const keyJWK = jsrsasign.KEYUTIL.getKey(keyJson);
    //console.log('PeerCrypto::loadKey__ keyJWK=<',keyJWK,'>');
    this.keyMaster = keyJWK;
  }
  createKey__() {
    const ec = new jsrsasign.KEYUTIL.generateKeypair("EC", "P-256");
    //console.log('PeerCrypto::createKey__ ec=<',ec,'>');
    const jwkPrv1 = jsrsasign.KEYUTIL.getJWKFromKey(ec.prvKeyObj);
    //console.log('PeerCrypto::createKey__ jwkPrv1=<',jwkPrv1,'>');
    fs.writeFileSync(this.keyPath,JSON.stringify(jwkPrv1,undefined,2));
    this.keyMaster = ec.prvKeyObj;
  }
  calcKeyB58__() {
    const pubKeyBuff = Buffer.from(this.keyMaster.pubKeyHex, 'hex');
    this.pubB58 = bs58.encode(pubKeyBuff);
    //console.log('PeerCrypto::calcKeyB58__ this.id =<',this.id ,'>');
    const keyRipemd = new RIPEMD160().update(this.keyMaster.pubKeyHex).digest('hex');
    const keyBuffer = Buffer.from(keyRipemd,'hex');
    //console.log('PeerCrypto::calcKeyB58__ keyBuffer =<',keyBuffer ,'>');
    this.idB58 = bs58.encode(keyBuffer);
    this.address = keyBuffer;
  }
}
module.exports = PeerCrypto;

