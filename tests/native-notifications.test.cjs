"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const script=fs.readFileSync(path.join(root,"native-notifications.js"),"utf8");

function setup({native=true,permission="granted"}={}) {
  const channels=[],scheduled=[],cancelled=[],requested=[];
  let pending=[];
  let currentPermission=permission;
  const p={
    async checkPermissions(){return{display:currentPermission};},
    async requestPermissions(){requested.push(true);currentPermission="granted";return{display:currentPermission};},
    async createChannel(channel){channels.push(channel);},
    async getPending(){return{notifications:pending};},
    async cancel({notifications}) {
      cancelled.push(...notifications);
      const remove=new Set(notifications.map(n=>n.id));
      pending=pending.filter(n=>!remove.has(n.id));
    },
    async schedule({notifications}) {
      scheduled.push(...notifications);
      pending.push(...notifications);
      return{notifications:notifications.map(({id})=>({id}))};
    }
  };
  const c=native?{isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{LocalNotifications:p}}:undefined;
  const window={Capacitor:c};
  vm.runInNewContext(script,{window,Date,console});
  return {api:window.HABITCLIK_NATIVE,p,channels,scheduled,cancelled,requested,
    setPermission(v){currentPermission=v;},getPending(){return pending}};
}
const habit=(id,alarmTime="19:00",tone="digital")=>({id,title:"Leer "+id,
  createdAt:"2026-10-01",weeklyTarget:7,alarmEnabled:true,alarmTime,alarmTone:tone});
const date=new Date(2026,9,20,12,0,0);

test("the native bridge is inert on GitHub Pages and never prompts on the web", async()=>{
  const {api}=setup({native:false});
  assert.equal(api.isNative(),false);
  assert.equal(api.isAvailable(),false);
  const p=await api.requestPermission();
  assert.equal(p.display,"unavailable");
  const sent=await api.test();
  assert.equal(sent.reason,"web");
  const sync=await api.sync({habits:[],settings:{}});
  assert.equal(sync.reason,"web");
});

test("native permission request and near-immediate plus lock-screen test call Android",async()=>{
  const r=setup({permission:"prompt"});
  assert.equal(r.api.isNative(),true);
  assert.equal(r.api.isAvailable(),true);
  assert.equal((await r.api.checkPermission()).display,"prompt");
  assert.equal((await r.api.test()).ok,false);
  assert.equal(r.requested.length,0,"automatic permission prompts are forbidden");
  const allowed=await r.api.requestPermission();
  assert.equal(allowed.display,"granted");
  assert.equal(r.requested.length,1);
  assert.equal((await r.api.test()).ok,true);
  assert.equal((await r.api.test(20)).ok,true);
  const now=r.scheduled.find(x=>x.id===829990);
  const later=r.scheduled.find(x=>x.id===829991);
  assert.ok(now);
  assert.equal(now.schedule,undefined,"immediate test should post a real native notification");
  assert.ok(later.schedule.at instanceof Date);
  assert.equal(later.schedule.isExactNotification,false,"testing must not require exact-alarm permission");
  assert.equal(now.channelId,"hc_prueba_v1");
  assert.equal(r.channels.length,12,"native channels are registered for both tests");
  const channel=r.channels.find(c=>c.id==="hc_prueba_v1");
  assert.equal(channel.sound,"hc_campanas.mp3");
});

test("seven-day native habit notifications respect their own times, tunes, completion and consent",async()=>{
  const r=setup();
  const data={habits:[habit("a","07:30","digital"),habit("b","21:15","energia")],
    logs:{"2026-10-20":["a"]},settings:{notificationEnabled:true,reminderEnabled:true,reminderTime:"17:20"}};
  const notifications=r.api.nextNotifications(data,date);
  assert.equal(notifications.filter(x=>x.extra.type==="habit").length,13);
  assert.equal(notifications.filter(x=>x.extra.type==="general").length,7);
  assert.ok(notifications.some(x=>x.channelId==="hc_luz_v1"));
  assert.ok(notifications.some(x=>x.channelId==="hc_bosque_v1"));
  assert.ok(notifications.every(x=>x.schedule.isExactNotification===false));
  assert.equal(notifications.some(x=>x.extra.habitId==="a"&&
    x.schedule.at.getDate()===20),false,"already completed habit must not remind today");
  assert.equal(new Set(notifications.map(x=>x.id)).size,notifications.length,
    "IDs must not collide across habits, days or daily reminders");
  const result=await r.api.sync(data);
  assert.equal(result.ok,true);
  assert.ok(result.scheduled>0);
  assert.equal(r.getPending().length,result.scheduled);
  data.habits[0].alarmEnabled=false;
  data.settings.reminderEnabled=false;
  await r.api.sync(data);
  assert.ok(r.cancelled.length>0,"old schedules must be cancelled");
  assert.equal(r.getPending().filter(x=>x.extra.habitId==="a").length,0);
  assert.equal(r.getPending().filter(x=>x.extra.type==="general").length,0);
  data.settings.notificationEnabled=false;
  const turnedOff=await r.api.sync(data);
  assert.equal(turnedOff.scheduled,0);
  assert.equal(r.getPending().length,0);
});

test("notification denial never triggers a native schedule; no paid or privileged exact-alarm permission",async()=>{
  const r=setup({permission:"denied"});
  const data={habits:[habit("a")],logs:{},settings:{notificationEnabled:true}};
  const res=await r.api.sync(data);
  assert.equal(res.reason,"denied");
  assert.equal(r.scheduled.length,0);
  assert.equal((await r.api.test()).ok,false);
  assert.equal(r.requested.length,0);
});

test("Android sound channels reference five bundled licensed MP3s and plugin is pinned",()=>{
  const packageJson=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(packageJson.devDependencies["@capacitor/local-notifications"],"8.3.1");
  const nativeBuild=fs.readFileSync(path.join(root,".github/workflows/android-preview.yml"),"utf8");
  for (const id of ["campanas","digital","clasica","alegre","energia"]) {
    assert.match(script,new RegExp("hc_"+id));
    assert.ok(fs.existsSync(path.join(root,"sounds",id+".mp3")));
  }
  assert.match(nativeBuild,/res\/raw\/hc_/);
  assert.match(nativeBuild,/LocalNotificationsPlugin/);
  const prep=fs.readFileSync(path.join(root,"android/prepare-web.cjs"),"utf8");
  assert.match(prep,/native-notifications.js/);
});
