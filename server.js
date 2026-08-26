// IDEA SCAN 3000 — REAL NETWORK MODE (zero dependencies, Node 18+)
// Run:  node server.js
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'ideas.json');

/* ---------- text engine ---------- */
const STOP = new Set(`a an the and or for to of in on with my our your his her their is are be was were it its at by from that this these those via using use uses app platform website site service like if you we they i me about into over under`.split(/\s+/));
const SYN = { cab:'taxi', uber:'ride', lyft:'ride', ai:'artificial', vr:'virtual', ev:'electric', bike:'bicycle', photo:'photograph', pics:'photograph', pictures:'photograph', gym:'fitness', cafe:'coffee', shop:'store', shops:'store', startup:'company', app:'application' };
const tokens = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ')
  .map(w=>SYN[w]||w).filter(w=>w.length>1 && !STOP.has(w));
function sim(a,b){ const A=new Set(a),B=new Set(b); if(!A.size||!B.size)return 0;
  let i=0; for(const t of A) if(B.has(t)) i++; return i ? 2*i/(A.size+B.size) : 0; }

/* ---------- database (auto-created JSON file) ---------- */
let db = { checks:0, ideas:[] };
try{ db = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }catch(e){}
if(!Array.isArray(db.ideas)) db.ideas = [];
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));

if(!db.ideas.length){ // seed with REAL history on first run
  const SEEDS = [
    ["social network","Mark Zuckerberg (Friendster was first, 2002)",2004,"You're late by two decades and several lawsuits."],
    ["search engine","Larry Page & Sergey Brin",1998,"AltaVista was scanning the web in 1995."],
    ["ride sharing taxi","Garrett Camp & Travis Kalanick (Uber)",2009,"'Uber for X' is already a meme."],
    ["online bookstore","Jeff Bezos (Amazon)",1994,"Started in a garage."],
    ["video sharing","Hurley, Chen & Karim (YouTube)",2005,"First video: 'Me at the zoo.'"],
    ["short video lip sync","Alex Zhu & Luyu Yang (Musical.ly/TikTok)",2014,""],
    ["bitcoin cryptocurrency","Satoshi Nakamoto",2008,""],
    ["chatbot ai assistant","Joseph Weizenbaum (ELIZA)",1966,"Older than your parents."],
    ["movie streaming dvd rental","Reed Hastings & Marc Randolph (Netflix)",1997,""],
    ["music streaming","Daniel Ek (Spotify)",2006,""],
    ["photo sharing filters","Kevin Systrom & Mike Krieger (Instagram)",2010,"Flickr (2004) waves hello."],
    ["dating app","Match.com",1995,""],
    ["rent out my home room rental","Brian Chesky & Joe Gebbia (Airbnb)",2008,""],
    ["food delivery","Pizza Hut (first online food order)",1994,"Yes, it was a pizza."],
    ["electric car","Thomas Davenport",1834,"Older than your great-great-great-grandparents."],
    ["virtual reality headset","Ivan Sutherland",1968,""],
    ["smartphone touchscreen phone","IBM Simon",1994,""],
    ["3d printing","Chuck Hull",1983,""],
    ["plant based meat alternative","Ancient China (tofu)",-200,"2,000-year head start."],
    ["coffee shop coffee house","Ottoman Empire (Istanbul)",1550,""],
    ["online payment digital wallet","PayPal",1997,""],
    ["drone delivery","Amazon Prime Air demo",2013,""]
  ];
  db.ideas = SEEDS.map(([idea,name,year,note])=>({idea,name,year,note,seed:true,time:0,tokens:tokens(idea)}));
  save();
}

/* ---------- real-world check (Wikipedia, free, no key) ---------- */
async function worldCheck(tk){
  if(typeof fetch!=='function') return null;
  try{
    const u=`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(tk.slice(0,6).join(' '))}`;
    const j=await (await fetch(u)).json();
    const hit=j?.query?.search?.[0]; if(!hit) return null;
    const wt=tokens(hit.title);
    if(sim(wt,tk)>=0.4 || (wt.length && wt.every(t=>tk.includes(t))))
      return {title:hit.title, snippet:String(hit.snippet||'').replace(/<[^>]+>/g,''), url:`https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g,'_'))}`};
    return null;
  }catch(e){ return null; }
}

/* ---------- the check ---------- */
async function check(idea,name){
  db.checks++;
  const tk=tokens(idea);
  let best=null,bs=0;
  for(const e of db.ideas){ const s=sim(tk,e.tokens); if(s>bs){bs=s;best=e;} }
  if(best && bs>=0.3){ save();
    return {copied:true, source:best.seed?'history':'registry', who:best.name, year:best.year,
            note:best.note||'', match:best.idea, score:Math.round(bs*100), time:best.time}; }
  const w=await worldCheck(tk);
  if(w){ save(); return {copied:true, source:'world', who:w.title, note:w.snippet, url:w.url, score:100}; }
  const entry={idea, name:name||'Anonymous', time:Date.now(), tokens:tk, seed:false};
  db.ideas.push(entry); save();
  return {copied:false, position:db.ideas.filter(i=>!i.seed).length, savedAs:entry.name};
}

/* ---------- server ---------- */
const json=(res,o)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o));};
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS'){res.end();return;}
  if(u.pathname==='/api/check'&&req.method==='POST'){
    let raw=''; req.on('data',c=>raw+=c); await new Promise(r=>req.on('end',r));
    let b={}; try{b=JSON.parse(raw);}catch(e){}
    const idea=String(b.idea||'').trim();
    if(!idea){res.statusCode=400;return json(res,{error:'empty'});}
    return json(res, await check(idea, String(b.name||'').trim().slice(0,40)));
  }
  if(u.pathname==='/api/stats') return json(res,{checks:db.checks, registered:db.ideas.filter(i=>!i.seed).length});
  if(u.pathname==='/api/recent') return json(res, db.ideas.filter(i=>!i.seed).slice(-6).reverse().map(e=>({idea:e.idea.slice(0,60),name:e.name,time:e.time})));
  const p=path.join(__dirname, u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
  if(!p.startsWith(__dirname)){res.statusCode=403;return res.end();}
  fs.readFile(p,(err,data)=>{ if(err){res.statusCode=404;return res.end('not found');}
    res.setHeader('Content-Type', p.endsWith('.html')?'text/html':'text/plain'); res.end(data); });
}).listen(PORT, ()=>{
  const n=os.networkInterfaces(); let lan='localhost';
  for(const k in n) for(const i of n[k]) if(i.family==='IPv4'&&!i.internal) lan=i.address;
  console.log(`💡 Local:   http://localhost:${PORT}`);
  console.log(`🌍 Network: http://${lan}:${PORT}   ← friends on your Wi-Fi open this`);
});
