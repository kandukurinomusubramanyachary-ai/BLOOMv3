const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module');
const scopes=[createRequire(path.resolve(__dirname,'../package.json')),createRequire(path.resolve(__dirname,'../meg-engine-v2/package.json'))];
test('root and Meg transports reject forged proxy hops through IPv4-mapped IPv6 trust prefixes',()=>{
  for(const local of scopes){const expressRequire=createRequire(local.resolve('express'));const proxy=expressRequire('proxy-addr');const malformed=proxy.compile('::ffff:10.0.0.0/8');assert.equal(malformed('203.0.113.25'),false);assert.equal(proxy.compile('::/1')('203.0.113.25'),false);const valid=proxy.compile('::ffff:10.0.0.0/104');assert.equal(valid('10.1.2.3'),true);assert.equal(valid('203.0.113.25'),false);}
});
test('compressed bodies with trailing bytes cannot crash either Express transport',async t=>{
  const {gzipSync}=require('node:zlib');
  for(const local of scopes){const express=local('express'),app=express();app.use(express.json());app.post('/',(req,res)=>res.json({ok:true}));app.get('/alive',(req,res)=>res.json({ok:true}));app.use((error,req,res,next)=>res.status(400).json({error:'invalid_body'}));
    const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    try{const response=await fetch('http://127.0.0.1:'+server.address().port+'/',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:Buffer.concat([gzipSync(Buffer.from('{"synthetic":true}')),Buffer.from('trailing-bytes')]),signal:AbortSignal.timeout(5000)});assert.ok([200,400].includes(response.status));await response.text();await new Promise(r=>setTimeout(r,20));const alive=await fetch('http://127.0.0.1:'+server.address().port+'/alive');assert.equal(alive.status,200);await alive.text();}
    finally{await new Promise(resolve=>server.close(resolve));}
  }
});
