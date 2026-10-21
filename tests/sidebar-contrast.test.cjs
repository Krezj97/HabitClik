"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.join(__dirname,"..");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const reminders=fs.readFileSync(path.join(root,"avisos.html"),"utf8");
const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");
const anchor="/* HabitClik v26 — readable, polished navigation and progress surfaces.";
const start=css.indexOf(anchor);
const latest=start>=0?css.slice(start):"";
const section=(begin,end)=>latest.slice(latest.indexOf(begin),end?latest.indexOf(end,latest.indexOf(begin)+begin.length):undefined);
function light(hex){
 const v=hex.replace("#","").match(/.{2}/g).map(x=>parseInt(x,16)/255)
  .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 return v[0]*.2126+v[1]*.7152+v[2]*.0722;
}
function contrast(a,b){const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test("legible sidebar patch wins after legacy white-on-white style and covers all pages",()=>{
 assert.ok(start>70000,"new sidebar declarations must override old theme");
 for(const [label,sel] of Object.entries({
  background:/\.sidebar \{\s*background: var\(--hc-sidebar-paper\)/,
  caption:/\.sidebar \.sidebar-caption \{[\s\S]*?color: #506c77/,
  inactive:/\.sidebar \.main-nav \.nav-item \{\s*background: transparent;\s*color: #385360/,
  active:/\.sidebar \.main-nav \.nav-item\.is-active/,
  privacy:/\.sidebar \.privacy-note a \{ color: #216a61/,
  tip:/\.sidebar \.tip-card \{/,
  bottom:/\.dashboard-app \.sidebar \.main-nav \.nav-item \{/,
  keyboard:/\.sidebar \.main-nav \.nav-item:focus-visible/
 }))assert.match(latest,sel,label+" missing");
 assert.match(html,/class="sidebar"/);
 assert.match(reminders,/class="sidebar"/);
 assert.match(privacy,/class="sidebar"/);
});

test("foreground/background combinations on sidebar and statistics are WCAG AA",()=>{
 for(const [label,foreground,background] of [
  ["inactive sidebar nav","#385360","#f7faf9"],
  ["small sidebar heading","#506c77","#f7faf9"],
  ["privacy link","#216a61","#f7faf9"],
  ["active sidebar nav","#ffffff","#2d6670"],
  ["motivational box body","#dcebe9","#244752"],
  ["stats hero headline","#163849","#a5d9c7"],
  ["stats hero description","#2b505d","#c2e7d9"],
  ["stats card label","#496779","#ffffff"],
  ["stats card value","#14294a","#ffffff"],
  ["locked badge status","#526c7a","#f9fbfc"],
  ["unlocked badge status","#176a55","#eff9ef"],
  ["mobile bottom nav","#40596b","#ffffff"],
  ["mobile active nav","#11784f","#e4f6ed"]
 ]) assert.ok(contrast(foreground,background)>=4.5,label+" must be 4.5:1 or greater");
});

test("statistics numbers and badges receive modern, responsive, readable styles",()=>{
 assert.match(html,/id="stats-view"/);
 assert.match(html,/id="achievement-list"/);
 assert.match(latest,/#stats-view \.stats-hero h1/);
 assert.match(latest,/#stats-view \.stat-card strong/);
 assert.match(latest,/#stats-view \.achievement-card \{/);
 assert.match(latest,/#stats-view \.achievement-card\.is-unlocked/);
 assert.match(latest,/#stats-view \.achievement-status/);
 assert.match(latest,/@media \(max-width: 760px\)/);
 assert.match(latest,/@media \(max-width: 540px\)/);
 assert.match(latest,/#stats-view \.stats-page-grid \{ grid-template-columns: 1fr/);
 assert.match(latest,/prefers-reduced-motion: reduce/);
});
