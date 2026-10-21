"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"native-backup.js"),"utf8");

function load({native=true,hasPlugins=true,writeFail=false,shareFail=false}={}){
  const writes=[],shares=[];
  const plugins=hasPlugins?{
    Filesystem:{async writeFile(opts){
      writes.push(opts);
      if(writeFail)throw new Error("write failed");
      return{uri:"file:///data/user/0/dev.habitclik.preview/cache/"+opts.path};
    }},
    Share:{async share(opts){shares.push(opts);if(shareFail)throw new Error("cancelled");return{activityType:"test"};}}
  }:{};
  const window={Capacitor:native?{isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:plugins}:undefined};
  vm.runInNewContext(src,{window,TextEncoder,console});
  return{backup:window.HABITCLIK_BACKUP,writes,shares};
}

test("web never attempts native storage or sharing",async()=>{
  const {backup,writes,shares}=load({native:false});
  assert.equal(backup.isNative(),false);
  assert.equal(backup.isAvailable(),false);
  const result=await backup.exportJSON("habitclik-2026-10-21.json",'{"version":1,"habits":[]}');
  assert.equal(result.reason,"web");
  assert.equal(writes.length,0);
  assert.equal(shares.length,0);
});

test("Android writes UTF-8 JSON only into private cache, then invokes real system sharing",async()=>{
  const {backup,writes,shares}=load();
  const json=JSON.stringify({version:1,habits:[{title:"Leer un ratito ☀️",id:"a"}],logs:{}});
  const r=await backup.exportJSON("habitclik-2026-10-21.json",json);
  assert.equal(r.ok,true);
  assert.equal(writes.length,1);
  assert.equal(writes[0].directory,"CACHE");
  assert.equal(writes[0].encoding,"utf8");
  assert.equal(writes[0].data,json);
  assert.equal(shares.length,1);
  assert.equal(shares[0].files.length,1);
  assert.match(shares[0].files[0],/^file:\/\/\/data\/user\/0\/dev\.habitclik\.preview\/cache\/habitclik-/);
  assert.match(shares[0].dialogTitle,/copia/);
});

test("native export fails closed when plugin is absent, filename wrong or JSON too large",async()=>{
  const {backup,writes,shares}=load({hasPlugins:false});
  assert.equal(backup.isNative(),true);
  assert.equal(backup.isAvailable(),false);
  assert.equal((await backup.exportJSON("habitclik-2026-10-21.json",'{"habits":[]}')).reason,"missing-plugin");
  const ready=load();
  assert.equal((await ready.backup.exportJSON("../secret.txt",'{"habits":[]}')).reason,"invalid");
  assert.equal((await ready.backup.exportJSON("habitclik-2026-10-21.json","x".repeat(2*1024*1024))).reason,"invalid");
  assert.equal(ready.writes.length,0);
  assert.equal(ready.shares.length,0);
  assert.equal(writes.length,0);
  assert.equal(shares.length,0);
});

test("share cancellation and file errors do not falsely claim an exported backup",async()=>{
  const read=load({writeFail:true});
  await assert.rejects(read.backup.exportJSON("habitclik-2026-10-21.json",'{"habits":[]}'));
  assert.equal(read.shares.length,0);
  const share=load({shareFail:true});
  await assert.rejects(share.backup.exportJSON("habitclik-2026-10-21.json",'{"habits":[]}'));
});

test("Android package includes Filesystem, Share, and bridge before the main app",()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(pkg.devDependencies["@capacitor/filesystem"],"8.1.3");
  assert.equal(pkg.devDependencies["@capacitor/share"],"8.0.1");
  const scripts=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.ok(scripts.indexOf('src="native-backup.js?')>0);
  assert.ok(scripts.indexOf('src="native-backup.js?')<scripts.indexOf('src="app.js?'));
  const bundler=fs.readFileSync(path.join(root,"android/prepare-web.cjs"),"utf8");
  assert.match(bundler,/native-backup\.js/);
  const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
  assert.match(app,/window\.HABITCLIK_BACKUP\.exportJSON/);
  assert.match(app,/No desinstales HabitClik sin guardar tus datos/);
});
