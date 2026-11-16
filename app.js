(()=>{
const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)];
const KEY='parkett.v2';
const CATS={krypto:'Krypto',forex:'Forex',rohstoffe:'Rohstoffe',indizes:'Indizes',aktien:'Aktien'};
// Symbol, Name, Klasse, Startkurs (nur für die Simulation), Nachkommastellen, Kurswährung, Jahresvolatilität, Spread, max. Hebel (ESMA), Binance-Symbol, Finnhub-Symbol
const INS=[
 ['BTC/USD','Bitcoin','krypto',65000,1,'USD',.5,.0004,2,'BTCUSDT'],['ETH/USD','Ethereum','krypto',1830,2,'USD',.65,.0005,2,'ETHUSDT'],
 ['SOL/USD','Solana','krypto',72,2,'USD',.85,.0008,2,'SOLUSDT'],['XRP/USD','XRP','krypto',.97,4,'USD',.8,.001,2,'XRPUSDT'],
 ['EUR/USD','Euro / US-Dollar','forex',1.102,5,'USD',.07,.00006,30,'EURUSDT'],['GBP/USD','Pfund / US-Dollar','forex',1.331,5,'USD',.08,.00008,30,0,'OANDA:GBP_USD'],
 ['USD/JPY','US-Dollar / Yen','forex',151.2,3,'JPY',.09,.00007,30,0,'OANDA:USD_JPY'],['USD/CHF','US-Dollar / Franken','forex',.814,5,'CHF',.07,.0001,30,0,'OANDA:USD_CHF'],
 ['AUD/USD','Austral. Dollar / US-Dollar','forex',.652,5,'USD',.1,.0001,20,0,'OANDA:AUD_USD'],['EUR/GBP','Euro / Pfund','forex',.858,5,'GBP',.06,.0001,30,0,'OANDA:EUR_GBP'],
 ['GOLD','Gold (Feinunze)','rohstoffe',4120,2,'USD',.16,.00012,20,0,'OANDA:XAU_USD'],['SILBER','Silber (Feinunze)','rohstoffe',49.5,3,'USD',.28,.0005,10,0,'OANDA:XAG_USD'],
 ['WTI','Rohöl WTI (Barrel)','rohstoffe',63.4,2,'USD',.35,.0005,10,0,'OANDA:WTICO_USD'],['BRENT','Rohöl Brent (Barrel)','rohstoffe',67.1,2,'USD',.33,.0005,10,0,'OANDA:BCO_USD'],
 ['ERDGAS','Erdgas (MMBtu)','rohstoffe',3.85,3,'USD',.6,.0012,10,0,'OANDA:NATGAS_USD'],['KUPFER','Kupfer (Pfund)','rohstoffe',4.92,4,'USD',.22,.0006,10,0,'OANDA:XCU_USD'],
 ['DAX','DAX 40','indizes',24150,1,'EUR',.16,.00006,20,0,'OANDA:DE30_EUR'],['S&P 500','S&P 500','indizes',6820,1,'USD',.15,.00007,20,0,'OANDA:SPX500_USD'],
 ['NASDAQ','Nasdaq 100','indizes',25100,1,'USD',.2,.00008,20,0,'OANDA:NAS100_USD'],['DOW','Dow Jones 30','indizes',47200,0,'USD',.14,.00008,20,0,'OANDA:US30_USD'],
 ['AAPL','Apple','aktien',262,2,'USD',.25,.0004,5,0,'AAPL'],['TSLA','Tesla','aktien',415,2,'USD',.55,.0006,5,0,'TSLA'],
 ['NVDA','Nvidia','aktien',188,2,'USD',.45,.0005,5,0,'NVDA'],['SAP','SAP (New York, in US-Dollar)','aktien',270,2,'USD',.25,.0005,5,0,'SAP']
].map(a=>({s:a[0],n:a[1],c:a[2],p:a[3],d:a[4],q:a[5],v:a[6],sp:a[7],lev:a[8],bn:a[9]||'',fh:a[10]||'',sig:a[6]/Math.sqrt(31536000)*1.5}));
const I={},BNMAP={},FHMAP={};INS.forEach((x,i)=>{x.i=i;I[x.s]=x;if(x.bn)BNMAP[x.bn]=x.s;if(x.fh)FHMAP[x.fh]=x.s});
const NEWS={forex:['Notenbank überrascht mit Zinsentscheid','US-Arbeitsmarktdaten weichen stark von der Prognose ab','Inflationszahlen veröffentlicht'],
 rohstoffe:['OPEC+ ändert die Fördermenge','Lagerbestände überraschen den Markt','Geopolitische Spannungen nehmen zu'],
 indizes:['Inflationsdaten veröffentlicht','Notenbank-Protokoll bewegt die Börsen','Konjunkturdaten überraschen'],
 aktien:['Quartalszahlen überraschen','Analysten ändern ihre Kursziele','Branchenweite Gewinnwarnung']};

/* ---------- Zustand ---------- */
let A={bal:1e4,start:1e4,pos:[],ord:[],hist:[],learn:{},last:{},seen:{},id:1};
let sel='BTC/USD',TF=1,zoom=60,off=0,ind={ema:true,bb:false,rsi:false},cross=null,speed=1,tab='markets',filt='alle',ver=0,mVer=0,geo=null;
let FHKEY='',LC={};
try{const j=JSON.parse(localStorage.getItem(KEY));if(j&&j.A){A=Object.assign(A,j.A);if(I[j.sel])sel=j.sel;if(j.TF)TF=j.TF;if(j.ind)ind=j.ind}
  FHKEY=localStorage.getItem(KEY+'.fh')||'';LC=JSON.parse(localStorage.getItem(KEY+'.lc'))||{}}catch(e){}
const save=()=>{try{INS.forEach(x=>{const m=M[x.s];if(!m.live||m.ready)A.last[x.s]=m.last});localStorage.setItem(KEY,JSON.stringify({A,sel,TF,ind}))}catch(e){}};
const saveLC=()=>{try{const o={};INS.forEach(x=>{const m=M[x.s];if(m.live&&!x.bn&&m.c.length)o[x.s]=m.c.slice(-600)});localStorage.setItem(KEY+'.lc',JSON.stringify(o))}catch(e){}};

/* ---------- Märkte: echte Kurse oder Simulation ---------- */
const randn=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
let simT=Date.now();const M={};
function genHist(ins,endP,n){const sig=ins.sig,rows=[];let lp=0,mu=0,vm=1;
  for(let i=0;i<n;i++){if(Math.random()<.066)mu=randn()*sig*.023;if(Math.random()<.004)vm=1.5+Math.random()*1.5;vm=1+(vm-1)*.82;
    const o=lp;let h=o,l=o;for(let k=0;k<4;k++){lp+=mu*15+sig*vm*Math.sqrt(15)*randn();if(lp>h)h=lp;if(lp<l)l=lp}
    rows.push([o,h,l,lp])}
  const t1=Math.floor(simT/6e4)*6e4;
  return rows.map((r,i)=>[t1-(n-1-i)*6e4,endP*Math.exp(r[0]-lp),endP*Math.exp(r[1]-lp),endP*Math.exp(r[2]-lp),endP*Math.exp(r[3]-lp)])}
// Ein Markt läuft entweder im Live-Modus (nur echte Kurse, nie simuliert) oder simuliert. Binance-Märkte sind immer live.
// Finnhub-Märkte werden live, sobald der erste echte Kurs eingetroffen ist, und bleiben es, solange ein Schlüssel hinterlegt ist.
INS.forEach(x=>{const lp=A.last[x.s]>0?A.last[x.s]:x.p,live=!!x.bn||!!(x.fh&&FHKEY&&A.seen[x.s]);
  M[x.s]={c:live?(x.bn?[]:(LC[x.s]||[])):genHist(x,lp,4000),last:lp,mu:0,vm:1,live,ready:false,ts:0,k:{},kl:{},o24:0,hist:0}});
LC=null;
let bnUp=false,fhUp=false,fhErr='';
function status(s){const m=M[s];if(!m.live)return'sim';const bn=!!I[s].bn;
  return m.ready&&(bn?bnUp:fhUp)&&(bn||Date.now()-m.ts<9e4)?'live':'wait'}
const known=s=>{const m=M[s];return!m.live||m.ready||A.last[s]>0};
function upd(arr,tf,p,t){const w=tf*6e4,b=Math.floor(t/w)*w;let k=arr[arr.length-1];
  if(!k||k[0]<b){k=[b,p,p,p,p];arr.push(k);if(arr.length>4200)arr.splice(0,200)}else if(k[0]>b)return;
  k[4]=p;if(p>k[2])k[2]=p;if(p<k[3])k[3]=p}
function goLive(s){const m=M[s];if(m.live)return;
  for(const p of A.pos.filter(p=>p.s===s))closePos(p,'Umstellung auf echten Kurs');
  A.ord=A.ord.filter(o=>o.s!==s);m.live=true;m.ready=false;m.c=[];m.k={};A.seen[s]=1;ver++;mVer++;
  toast(s+' läuft ab jetzt mit echten Kursen')}
function onPrice(s,p,t){const m=M[s];if(!(p>0))return;if(!m.live)goLive(s);
  m.last=p;m.ts=Date.now();m.ready=true;upd(m.c,1,p,t);for(const tf in m.k)upd(m.k[tf],+tf,p,t)}

/* Binance: öffentliche Marktdaten, kein Schlüssel nötig */
const BN=[['https://data-api.binance.vision','wss://data-stream.binance.vision'],['https://api.binance.com','wss://stream.binance.com:9443']];
let bnI=0,bnWs=null;
const kl=a=>a.map(k=>[k[0],+k[1],+k[2],+k[3],+k[4]]);
function bnHist(x){const m=M[x.s];if(m.hist)return;m.hist=1;
  fetch(`${BN[bnI%2][0]}/api/v3/klines?symbol=${x.bn}&interval=1m&limit=1000`).then(r=>r.json()).then(a=>{
    if(!Array.isArray(a)||!a.length){m.hist=0;return}m.c=kl(a);if(!m.ready){m.last=m.c[m.c.length-1][4];m.ready=true;m.ts=Date.now()}mVer++}).catch(()=>{m.hist=0})}
function bnStart(){if(bnWs&&bnWs.readyState<2)return;const list=INS.filter(x=>x.bn);list.forEach(bnHist);
  try{bnWs=new WebSocket(BN[bnI%2][1]+'/stream?streams='+list.map(x=>x.bn.toLowerCase()+'@miniTicker').join('/'))}catch(e){bnI++;return setTimeout(bnStart,4000)}
  const ws=bnWs;
  ws.onopen=()=>{bnUp=true};
  ws.onmessage=e=>{try{const d=JSON.parse(e.data).data,s=BNMAP[d.s];if(s){M[s].o24=+d.o;onPrice(s,+d.c,d.E)}}catch(_){}};
  ws.onclose=()=>{if(ws!==bnWs)return;bnUp=false;bnI++;list.forEach(x=>{M[x.s].hist=0;M[x.s].k={};M[x.s].kl={}});setTimeout(bnStart,3000)};
  ws.onerror=()=>{try{ws.close()}catch(_){}}}
const BNTF={5:'5m',15:'15m',60:'1h'};
function candles(s,tf){const m=M[s];if(tf===1)return m.c;
  if(m.live&&I[s].bn){if(m.k[tf])return m.k[tf];
    if(!m.kl[tf]){m.kl[tf]=1;fetch(`${BN[bnI%2][0]}/api/v3/klines?symbol=${I[s].bn}&interval=${BNTF[tf]}&limit=600`).then(r=>r.json()).then(a=>{
      if(Array.isArray(a)&&a.length){m.k[tf]=kl(a);if(m.ready)upd(m.k[tf],tf,m.last,Date.now())}else m.kl[tf]=0}).catch(()=>{m.kl[tf]=0})}}
  return agg(m.c,tf)}

/* Finnhub: Echtzeit-Kurse mit eigenem kostenlosen Schlüssel */
let fhWs=null,fhTry=0;
function fhStart(){if(!FHKEY||fhWs&&fhWs.readyState<2)return;
  try{fhWs=new WebSocket('wss://ws.finnhub.io?token='+encodeURIComponent(FHKEY))}catch(e){return}
  const ws=fhWs;
  ws.onopen=()=>{fhUp=true;fhErr='';fhTry=0;INS.filter(x=>x.fh).forEach(x=>ws.send(JSON.stringify({type:'subscribe',symbol:x.fh})))};
  ws.onmessage=e=>{try{const j=JSON.parse(e.data);
    if(j.type==='trade')for(const d of j.data){const s=FHMAP[d.s];if(s)onPrice(s,+d.p,d.t||Date.now())}
    else if(j.type==='error')fhErr=String(j.msg||'Fehler')}catch(_){}};
  ws.onclose=()=>{if(ws!==fhWs)return;if(!fhUp&&!fhErr)fhErr='Verbindung abgelehnt. Bitte den Schlüssel prüfen.';fhUp=false;
    if(FHKEY)setTimeout(fhStart,Math.min(6e4,4000*2**fhTry++))};
  ws.onerror=()=>{try{ws.close()}catch(_){}}}

const bid=s=>M[s].last*(1-I[s].sp/2),ask=s=>M[s].last*(1+I[s].sp/2);
function fx(q){const eu=M['EUR/USD'].last;return q==='EUR'?1:q==='USD'?1/eu:q==='JPY'?1/(eu*M['USD/JPY'].last):q==='CHF'?1/(eu*M['USD/CHF'].last):M['GBP/USD'].last/eu}
function tick(){ // bewegt ausschließlich simulierte Märkte
  if(!speed)return;const dt=.25*speed;simT+=dt*1000;const b=Math.floor(simT/6e4)*6e4,zc={};
  for(const c in CATS)zc[c]=randn();
  for(const x of INS){const m=M[x.s];if(m.live)continue;
    if(Math.random()<dt/900)m.mu=randn()*x.sig*.023;
    if(Math.random()<dt*.0004)m.vm=1.5+Math.random()*1.5;
    m.vm=1+(m.vm-1)*Math.exp(-dt/240);
    m.last*=Math.exp(m.mu*dt+x.sig*m.vm*Math.sqrt(dt)*(.6*zc[x.c]+.8*randn()));
    let k=m.c[m.c.length-1];
    if(k[0]!==b){k=[b,k[4],k[4],k[4],k[4]];m.c.push(k);if(m.c.length>4200)m.c.splice(0,200)}
    k[4]=m.last;if(m.last>k[2])k[2]=m.last;if(m.last<k[3])k[3]=m.last}
  if(Math.random()<dt/3600){const cs=Object.keys(NEWS),c=cs[Math.random()*cs.length|0],dir=Math.random()<.5?-1:1,t=NEWS[c],hit=INS.filter(x=>x.c===c&&!M[x.s].live);
    if(hit.length){hit.forEach(x=>{M[x.s].vm=3;M[x.s].mu=dir*x.sig*.08});toast('Simuliertes Ereignis ('+CATS[c]+'): '+t[Math.random()*t.length|0]+'. Betrifft nur simulierte Märkte.')}}}

/* ---------- Konto & Orders ---------- */
const exitPx=p=>p.side>0?bid(p.s):ask(p.s);
const pnl=(p,px)=>((px??exitPx(p))-p.entry)*p.side*p.units*fx(I[p.s].q);
function acct(){let open=0,used=0;for(const p of A.pos){open+=pnl(p);used+=p.margin}const eq=A.bal+open;return{eq,open,used,free:eq-used}}
function openPos(s,side,amt,lev,entry,sl,tp){const units=amt*lev/(entry*fx(I[s].q));
  A.pos.push({id:A.id++,s,side,units,entry,margin:amt,lev,sl,tp,t:Date.now(),live:M[s].live});ver++;save()}
function closePos(p,why,px){px=px??exitPx(p);const g=pnl(p,px);A.bal+=g;A.pos=A.pos.filter(x=>x!==p);
  A.hist.unshift({s:p.s,side:p.side,units:p.units,entry:p.entry,exit:px,pnl:g,lev:p.lev,t0:p.t,t1:Date.now(),why,live:p.live});if(A.hist.length>300)A.hist.length=300;
  ver++;save();toast(p.s+' geschlossen ('+why+'): '+sgn(g))}
function checkOrders(){
  for(const p of [...A.pos]){if(status(p.s)==='wait')continue;const px=exitPx(p),lv=M[p.s].live; // bei echten Kursen wird nach einer Kurslücke zum Marktkurs ausgeführt
    if(p.sl&&(p.side>0?px<=p.sl:px>=p.sl))closePos(p,'Stop-Loss',lv?px:p.sl);
    else if(p.tp&&(p.side>0?px>=p.tp:px<=p.tp))closePos(p,'Take-Profit',lv?px:p.tp)}
  for(const o of [...A.ord]){if(status(o.s)==='wait')continue;const px=o.side>0?ask(o.s):bid(o.s);
    const hit=o.kind==='limit'?(o.side>0?px<=o.price:px>=o.price):(o.side>0?px>=o.price:px<=o.price);
    if(hit){A.ord=A.ord.filter(x=>x!==o);ver++;
      if(acct().free>=o.amt){openPos(o.s,o.side,o.amt,o.lev,o.kind==='limit'?o.price:px,o.sl,o.tp);toast(o.s+': Order ausgeführt')}
      else{toast(o.s+': Order verworfen, zu wenig freie Margin');save()}}}
  let g=0;while(A.pos.length&&g++<50){const a=acct();if(a.eq/a.used>=.5)break;
    const c=A.pos.filter(p=>status(p.s)!=='wait');if(!c.length)break;
    closePos(c.reduce((w,p)=>pnl(p)<pnl(w)?p:w),'Stop-out')}
  if(A.bal<0&&!A.pos.length){A.bal=0;save()}}

/* ---------- Formatierung ---------- */
const nf=(x,d)=>x.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const eur=x=>nf(x,2)+' €',sgn=x=>(x>=0?'+':'')+nf(x,2)+' €',fp=(s,x)=>nf(x,I[s].d);
const pct=x=>x==null?'–':(x>=0?'+':'')+nf(x,2)+' %',cls=x=>x==null?'mute':x>=0?'up':'dn';
const parse=v=>{const x=parseFloat(String(v).replace(/\s/g,'').replace(',','.'));return isFinite(x)?x:NaN};
const inp=(x,d)=>x.toFixed(d).replace('.',',');
function dayCh(s){const m=M[s],c=m.c;
  if(!m.live)return(m.last/c[Math.max(0,c.length-1440)][4]-1)*100;
  if(m.o24>0&&m.ready)return(m.last/m.o24-1)*100;
  if(m.ready&&c.length&&c[0][0]<=Date.now()-828e5){const t=Date.now()-864e5;let r=c[0];for(const k of c){if(k[0]>t)break;r=k}return(m.last/r[4]-1)*100}
  return null}
const hm=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>e.hidden=true,4500)}
const ST={live:['on','Live'],sim:['simu','Simuliert'],wait:['wait','Kein Kurs']};
const stTag=s=>{const t=ST[status(s)];return`<i class="st ${t[0]}">${t[1]}</i>`};
const srcTxt=s=>{const x=I[s],st=status(s);return st==='sim'?'Simulierter Kurs, kein echter Marktpreis':(x.bn?'Echter Kurs von Binance ('+x.bn.replace('USDT','/USDT')+')':'Echter Kurs über Finnhub')+(st==='wait'?' · gerade kein aktueller Kurs':'')};

/* ---------- Indikatoren ---------- */
function agg(m,tf){if(tf===1)return m;const out=[],w=tf*6e4;let cur=null;
  for(const k of m){const b=Math.floor(k[0]/w)*w;if(!cur||cur[0]!==b){cur=[b,k[1],k[2],k[3],k[4]];out.push(cur)}else{if(k[2]>cur[2])cur[2]=k[2];if(k[3]<cur[3])cur[3]=k[3];cur[4]=k[4]}}return out}
function ema(a,n){const k=2/(n+1),o=[];let e=a[0];for(let i=0;i<a.length;i++){e=i?a[i]*k+e*(1-k):a[0];o.push(e)}return o}
function boll(a,n=20,m=2){const o=[];let s=0,s2=0;for(let i=0;i<a.length;i++){s+=a[i];s2+=a[i]*a[i];if(i>=n){s-=a[i-n];s2-=a[i-n]*a[i-n]}
  if(i>=n-1){const mu=s/n,sd=Math.sqrt(Math.max(0,s2/n-mu*mu));o.push([mu+m*sd,mu,mu-m*sd])}else o.push(null)}return o}
function rsi(a,n=14){const o=[null];let g=0,l=0;for(let i=1;i<a.length;i++){const d=a[i]-a[i-1],u=Math.max(d,0),dn=Math.max(-d,0);
  if(i<=n){g+=u/n;l+=dn/n}else{g=(g*(n-1)+u)/n;l=(l*(n-1)+dn)/n}o.push(i<n?null:100-100/(1+(l?g/l:100)))}return o}
function atr(s){const S=agg(M[s].c.slice(-90),5).slice(-15);if(S.length<3)return M[s].last*.001;let t=0;
  for(let i=1;i<S.length;i++)t+=Math.max(S[i][2]-S[i][3],Math.abs(S[i][2]-S[i-1][4]),Math.abs(S[i][3]-S[i-1][4]));return t/(S.length-1)||M[s].last*.001}

/* ---------- Symbole ---------- */
const IC={'BTC/USD':['₿','#f7931a'],'ETH/USD':['Ξ','#6f7cf7'],'SOL/USD':['S','#9b5cf6'],'XRP/USD':['X','#2a9fd6'],
 'EUR/USD':['€$','#2f6fd6'],'GBP/USD':['£$','#a8484f'],'USD/JPY':['$¥','#c9485b'],'USD/CHF':['$Fr','#d64545'],'AUD/USD':['A$','#2e8b6a'],'EUR/GBP':['€£','#5a67c9'],
 'GOLD':['Au','#d4a017'],'SILBER':['Ag','#8e9aaf'],'WTI':['WTI','#2b2f3a'],'BRENT':['BRT','#5a4a3a'],'ERDGAS':['Gas','#3a8fb7'],'KUPFER':['Cu','#b8733a'],
 'DAX':['DAX','#2b4fa8'],'S&P 500':['500','#b03a48'],'NASDAQ':['100','#1f8fa8'],'DOW':['30','#3d6fb0'],
 'AAPL':['AAPL','#5b6274'],'TSLA':['TSLA','#c0392b'],'NVDA':['NVDA','#5d9c1f'],'SAP':['SAP','#1b74c5']};
const ico=s=>{const [t,c]=IC[s];return`<span class="ico n${t.length}" style="--c:${c}">${t}</span>`};
const eur0=x=>nf(x,x%1?2:0)+' €';
const posOf=s=>A.pos.filter(p=>p.s===s);
const sumPl=ps=>ps.reduce((a,p)=>a+pnl(p),0),sumMg=ps=>ps.reduce((a,p)=>a+p.margin,0);

/* ---------- Chart ---------- */
const cssv=getComputedStyle(document.documentElement),tok=n=>cssv.getPropertyValue(n).trim();
const C={fg:tok('--fg'),mute:tok('--mute'),line:tok('--line'),up:tok('--up'),dn:tok('--dn'),acc:tok('--acc'),ink:tok('--ink'),warn:tok('--warn')};
const FF='"Fira Sans",system-ui,sans-serif';
function draw(){
  const cv=$('#chart'),bx=cv.parentElement.getBoundingClientRect();if(bx.width<20||bx.height<20)return;
  const dpr=window.devicePixelRatio||1,W=bx.width,H=bx.height;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const ins=I[sel],S=candles(sel,TF),ax=66,tH=22,rH=ind.rsi?Math.round(H*.2):0,pH=H-tH-rH,sim=!M[sel].live,ps=posOf(sel);
  g.textBaseline='middle';
  if(sim){g.font='700 34px '+FF;g.textAlign='center';g.fillStyle=C.fg;g.globalAlpha=.08;g.fillText('SIMULIERT',(W-ax)/2,pH/2);g.globalAlpha=1}
  if(S.length<2){geo=null;g.font='500 13px '+FF;g.textAlign='center';g.fillStyle=C.mute;
    g.fillText(M[sel].ready?'Der Chart baut sich aus den eintreffenden Kursen auf …':'Warte auf den ersten echten Kurs …',W/2,H/2);$('#ohlc').textContent='';$('#toLive').hidden=true;return}
  const n=Math.min(zoom,S.length);off=Math.max(0,Math.min(off,S.length-n));const end=S.length-off,st=end-n,cw=(W-ax-8)/Math.max(n,20);
  geo={cw,st,n,ax,W};
  const cl=S.map(k=>k[4]),bb=ind.bb?boll(cl):null;
  let lo=Infinity,hi=-Infinity;
  for(let i=st;i<end;i++){lo=Math.min(lo,S[i][3]);hi=Math.max(hi,S[i][2]);if(bb&&bb[i]){lo=Math.min(lo,bb[i][2]);hi=Math.max(hi,bb[i][0])}}
  if(off===0)for(const p of ps){const r=hi-lo||hi*.001;if(p.entry>lo-3*r&&p.entry<hi+3*r){lo=Math.min(lo,p.entry);hi=Math.max(hi,p.entry)}} // Einstieg bleibt sichtbar
  const pad=(hi-lo)*.12||hi*.0005;lo-=pad;hi+=pad;
  const top=44,y=p=>top+(hi-p)/(hi-lo)*(pH-top),x=i=>(i-st+.5)*cw,yr=p=>Math.round(y(p))+.5,nfont='500 12px '+FF;
  const inR=p=>p>=lo&&p<=hi;
  g.font=nfont;g.lineWidth=1;
  for(let k=0;k<6;k++){const p=lo+(hi-lo)*(k+.5)/6,yy=yr(p);g.strokeStyle=C.line;g.globalAlpha=.45;g.beginPath();g.moveTo(0,yy);g.lineTo(W-ax,yy);g.stroke();g.globalAlpha=1;
    g.fillStyle=C.mute;g.textAlign='left';g.fillText(nf(p,ins.d),W-ax+8,yy)}
  const step=Math.max(1,Math.ceil(Math.max(n,20)/4));g.textAlign='center';
  for(let i=st;i<end;i++)if((i-st)%step===(step>>1)){const xx=Math.round(x(i))+.5;g.strokeStyle=C.line;g.globalAlpha=.3;g.beginPath();g.moveTo(xx,0);g.lineTo(xx,pH+rH);g.stroke();g.globalAlpha=1;
    g.fillStyle=C.mute;g.fillText(hm(S[i][0]),xx,H-tH/2)}
  if(bb){g.strokeStyle=C.mute;g.globalAlpha=.7;for(const j of [0,2]){g.beginPath();let f=1;for(let i=st;i<end;i++){if(!bb[i])continue;f?g.moveTo(x(i),y(bb[i][j])):g.lineTo(x(i),y(bb[i][j]));f=0}g.stroke()}g.globalAlpha=1}
  const bw=Math.max(1,cw*.7);
  for(let i=st;i<end;i++){const k=S[i],u=k[4]>=k[1];g.fillStyle=g.strokeStyle=u?C.up:C.dn;const xx=x(i);
    g.beginPath();g.moveTo(Math.round(xx)+.5,y(k[2]));g.lineTo(Math.round(xx)+.5,y(k[3]));g.stroke();
    const y1=y(Math.max(k[1],k[4])),y2=y(Math.min(k[1],k[4]));g.fillRect(xx-bw/2,y1,bw,Math.max(1,y2-y1))}
  if(ind.ema){[[9,C.warn],[21,C.fg]].forEach(([p,c])=>{const e=ema(cl,p);g.strokeStyle=c;g.lineWidth=1.3;g.globalAlpha=.85;g.beginPath();for(let i=st;i<end;i++)i===st?g.moveTo(x(i),y(e[i])):g.lineTo(x(i),y(e[i]));g.stroke();g.globalAlpha=1;g.lineWidth=1})}
  const hline=(yy,c,x0,dash)=>{g.strokeStyle=c;g.setLineDash(dash||[]);g.beginPath();g.moveTo(x0||0,yy);g.lineTo(W-ax,yy);g.stroke();g.setLineDash([])};
  const parts=(pp,xl,yy,bg,fg)=>{let w=14;pp.forEach(([t,b])=>{g.font=(b?'700 ':'500 ')+'12px '+FF;w+=g.measureText(t).width+7});w-=7;
    g.fillStyle=bg;g.fillRect(xl,yy-11,w,22);let xx=xl+7;g.fillStyle=fg;g.textAlign='left';pp.forEach(([t,b])=>{g.font=(b?'700 ':'500 ')+'12px '+FF;g.fillText(t,xx,yy+.5);xx+=g.measureText(t).width+7});return w};
  const axb=(yy,p,bg,fg)=>{g.fillStyle=bg;g.fillRect(W-ax,yy-11,ax-3,22);g.fillStyle=fg;g.font='600 12px '+FF;g.textAlign='left';g.fillText(nf(p,ins.d),W-ax+8,yy+.5)};
  for(const o of A.ord)if(o.s===sel&&inR(o.price)){const yy=yr(o.price);hline(yy,C.mute,0,[2,3]);parts([['Order',0]],0,yy,C.mute,C.ink);axb(yy,o.price,C.mute,C.ink)}
  for(const p of ps){
    if(p.sl&&inR(p.sl)){const yy=yr(p.sl);hline(yy,C.dn,0,[4,3]);parts([['Stop-Loss',1]],0,yy,C.dn,C.ink);axb(yy,p.sl,C.dn,C.ink)}
    if(p.tp&&inR(p.tp)){const yy=yr(p.tp);hline(yy,C.up,0,[4,3]);parts([['Take-Profit',1]],0,yy,C.up,C.ink);axb(yy,p.tp,C.up,C.ink)}
    if(inR(p.entry)){const yy=yr(p.entry);hline(yy,C.acc);parts([[(p.side>0?'KAUF':'VERKAUF')+' X'+p.lev,0],[eur0(p.margin),1]],0,yy,C.acc,C.ink);axb(yy,p.entry,C.acc,C.ink)}}
  const lp=M[sel].last,lk=S[S.length-1];
  if(inR(lp)){const ly=yr(lp);
    if(ps.length){const gp=sumPl(ps),c=gp>=0?C.up:C.dn,tx=[[sgn(gp),0],[pct(gp/sumMg(ps)*100),1]];
      g.font='500 12px '+FF;let w=14;tx.forEach(([t,b])=>{g.font=(b?'700 ':'500 ')+'12px '+FF;w+=g.measureText(t).width+7});w-=7;
      const xl=Math.max(4,W-ax-56-w);parts(tx,xl,ly,c,C.ink);hline(ly,c,xl+w);axb(ly,lp,c,C.ink)}
    else{const c=lk[4]>=lk[1]?C.up:C.dn;hline(ly,c,0,[2,2]);axb(ly,lp,c,C.ink)}}
  g.font=nfont;
  if(rH){const r=rsi(cl),y0=pH,ry=v=>y0+4+(100-v)/100*(rH-8);g.strokeStyle=C.line;g.beginPath();g.moveTo(0,y0+.5);g.lineTo(W,y0+.5);g.stroke();
    g.globalAlpha=.5;[30,70].forEach(v=>{g.setLineDash([3,3]);g.beginPath();g.moveTo(0,ry(v));g.lineTo(W-ax,ry(v));g.stroke()});g.setLineDash([]);g.globalAlpha=1;
    g.fillStyle=C.mute;g.textAlign='left';g.fillText('RSI 70',W-ax+8,ry(70));g.fillText('30',W-ax+8,ry(30));
    g.strokeStyle=C.warn;g.lineWidth=1.3;g.beginPath();let f=1;for(let i=st;i<end;i++){if(r[i]==null)continue;f?g.moveTo(x(i),ry(r[i])):g.lineTo(x(i),ry(r[i]));f=0}g.stroke();g.lineWidth=1}
  let k=null;
  if(cross!=null&&cross>=st&&cross<end){k=S[cross];const xx=Math.round(x(cross))+.5;g.strokeStyle=C.fg;g.globalAlpha=.6;g.setLineDash([3,3]);g.beginPath();g.moveTo(xx,0);g.lineTo(xx,pH+rH);g.stroke();g.setLineDash([]);g.globalAlpha=1}
  $('#ohlc').textContent=k?hm(k[0])+' · O '+nf(k[1],ins.d)+' · H '+nf(k[2],ins.d)+' · L '+nf(k[3],ins.d)+' · C '+nf(k[4],ins.d):'';
  $('#toLive').hidden=off===0}
(()=>{const cv=$('#chart');let d=null;
  cv.addEventListener('pointerdown',e=>{d={x:e.clientX,o:off,m:0};cv.setPointerCapture(e.pointerId)});
  cv.addEventListener('pointermove',e=>{if(!d||!geo)return;const dx=e.clientX-d.x;if(Math.abs(dx)>5)d.m=1;if(d.m){off=d.o+Math.round(dx/geo.cw);draw()}});
  const up=e=>{if(d&&!d.m&&geo){const r=cv.getBoundingClientRect(),i=geo.st+Math.floor((e.clientX-r.left)/geo.cw);cross=(cross===i||e.clientX-r.left>geo.W-geo.ax)?null:i;draw()}d=null};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',()=>d=null)})();

/* ---------- Handel ---------- */
const TFL={1:'1m',5:'5m',15:'15m',60:'1h'};
const setH=(el,h)=>{if(el.dataset.h!==h){el.innerHTML=h;el.dataset.h=h}};
function chips(el,list,cur,act){el.innerHTML=list.map(([v,t,c])=>`<button class="chip ${c||''}" data-act="${act}" data-v="${v}" aria-pressed="${String(v)===String(cur)}">${t}</button>`).join('')}
let sKey='',tool='';
function liveStrip(){const key=sel+'|'+mVer+'|'+A.pos.map(p=>p.s).join();
  if(key!==sKey){sKey=key;
    $('#strip').innerHTML=INS.map(x=>`<button class="sbtn${M[x.s].live?'':' sim'}" data-act="pick" data-v="${x.s}" aria-pressed="${x.s===sel}" aria-label="${x.s}${M[x.s].live?'':' (simuliert)'}">${ico(x.s)}<i id="sb${x.i}" hidden></i></button>`).join('');
    const e=$('#strip [aria-pressed="true"]'),st=$('#strip');if(e)st.scrollLeft=e.offsetLeft-st.clientWidth/2+21}
  for(const x of INS){const ps=posOf(x.s),b=$('#sb'+x.i);b.hidden=!ps.length;if(ps.length){const up=sumPl(ps)>=0;b.className=up?'bu':'bd';b.textContent=up?'▲':'▼'}}}
function buildTools(){const el=$('#tools');el.hidden=!tool;
  [['tf','#tbTf'],['ind','#tbInd'],['set','#tbSet']].forEach(([k,q])=>$(q).setAttribute('aria-expanded',tool===k));
  if(tool==='tf')chips(el,[[1,'1 Minute'],[5,'5 Minuten'],[15,'15 Minuten'],[60,'1 Stunde']],TF,'tf');
  else if(tool==='ind')el.innerHTML=[['ema','EMA 9/21'],['bb','Bollinger-Bänder'],['rsi','RSI']].map(([v,t])=>`<button class="chip" data-act="ind" data-v="${v}" aria-pressed="${!!ind[v]}">${t}</button>`).join('');
  else if(tool==='set')el.innerHTML=`<span>Zoom</span><button class="chip" data-act="zoom" data-v="1.4" aria-label="Herauszoomen">−</button><button class="chip" data-act="zoom" data-v="0.7" aria-label="Hineinzoomen">+</button>`+
    (M[sel].live?'':'<span>Tempo der Simulation</span>'+[[0,'Pause'],[1,'Echtzeit'],[10,'10×'],[60,'60×']].map(([v,t])=>`<button class="chip" data-act="speed" data-v="${v}" aria-pressed="${v===speed}">${t}</button>`).join(''))}
let bsKey='';
function liveTrade(){liveStrip();const ok=known(sel),ch=dayCh(sel),ps=posOf(sel);
  $('#tbSym').textContent=sel+' ▾';$('#tbTf').textContent=TFL[TF];
  setH($('#cLabel'),`<b>${sel}</b>${stTag(sel)} <span class="${cls(ch)}">${ch==null?'':pct(ch)}</span><small>${srcTxt(sel)}</small>`);
  const key=sel+'|'+(ps.length?1:0);
  if(key!==bsKey){bsKey=key;$('#bs').innerHTML=ps.length
    ?`<button class="b-stops" data-act="stops">Stops</button><button class="b-close" data-act="closeSel">Schließen<small id="bPl"></small></button>`
    :`<button class="b-sell" data-act="ticket" data-v="-1">Verkaufen<small id="bBid"></small></button><button class="b-buy" data-act="ticket" data-v="1">Kaufen<small id="bAsk"></small></button>`}
  if(ps.length)$('#bPl').textContent=sgn(sumPl(ps));
  else{$('#bBid').textContent=ok?fp(sel,bid(sel)):'–';$('#bAsk').textContent=ok?fp(sel,ask(sel)):'–'}
  const os=A.ord.filter(o=>o.s===sel),e=$('#ordstrip');e.hidden=!os.length;
  if(os.length)setH(e,os.map(o=>`<span>${o.side>0?'Kauf':'Verkauf'}-${o.kind==='limit'?'Limit':'Stop'} wartet bei ${fp(sel,o.price)}</span><button class="btn sm" data-act="cancel" data-v="${o.id}">Löschen</button>`).join(''))}

/* ---------- Märkte ---------- */
let mBuilt=-1;
function buildMarkets(){mBuilt=mVer;
  chips($('#filt'),[['alle','Alle'],['live','Nur echte Kurse'],...Object.entries(CATS)],filt,'filt');
  let h='',lc='';
  for(const x of INS){if(filt==='live'?!M[x.s].live:(filt!=='alle'&&x.c!==filt))continue;
    if((filt==='alle'||filt==='live')&&x.c!==lc){h+=`<div class="cat">${CATS[x.c]}</div>`;lc=x.c}
    h+=`<button class="row" data-act="pick" data-v="${x.s}">${ico(x.s)}<span><b>${x.s} <span id="ms${x.i}"></span></b><small>${x.n}</small></span><svg class="spark" viewBox="0 0 56 24" aria-hidden="true"><polyline id="sp${x.i}" points=""/></svg><span class="px"><b id="mp${x.i}"></b><small id="mc${x.i}"></small></span></button>`}
  $('#mrows').innerHTML=h||'<div class="empty">Keine Märkte in dieser Auswahl.</div>';liveMarkets()}
function liveMarkets(){if(mBuilt!==mVer)return buildMarkets();
  for(const x of INS){const e=$('#mp'+x.i);if(!e)continue;const m=M[x.s],ch=dayCh(x.s),c=m.c;
    e.textContent=known(x.s)?fp(x.s,m.last):'…';const mc=$('#mc'+x.i);mc.textContent=pct(ch);mc.className=cls(ch);
    setH($('#ms'+x.i),stTag(x.s));
    const sp=$('#sp'+x.i),pts=[];for(let i=Math.max(0,c.length-120);i<c.length;i+=4)pts.push(c[i][4]);
    if(pts.length<3){sp.setAttribute('points','');continue}const lo=Math.min(...pts),hi=Math.max(...pts),r=hi-lo||1;
    sp.setAttribute('points',pts.map((p,i)=>(i*56/(pts.length-1)).toFixed(1)+','+(22-(p-lo)/r*20).toFixed(1)).join(' '));
    sp.style.stroke=pts[pts.length-1]>=pts[0]?'var(--up)':'var(--dn)'}
  srcStatus()}
function buildSrc(){const n=INS.filter(x=>!x.bn).length;
  $('#srcBox').innerHTML=`<div class="srcrow"><b>Krypto und EUR/USD</b><span id="srcBn"></span><p>Echte Kurse in Echtzeit von der Börse Binance, ohne Anmeldung. Gehandelt werden dort die Paare gegen den Dollar-Stablecoin USDT. Der Kurs weicht deshalb minimal vom offiziellen Dollarkurs ab.</p></div>
  <div class="srcrow"><b>Übrige ${n} Märkte</b><span id="srcFh"></span>
  <p>Für Forex, Rohstoffe, Indizes und Aktien braucht die App einen kostenlosen Schlüssel des Datenanbieters Finnhub. Ohne Schlüssel bleiben diese Märkte simuliert und sind so markiert.</p>
  <ol><li>Auf <a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io/register</a> ein kostenloses Konto anlegen.</li><li>Den „API Key“ aus dem Dashboard kopieren.</li><li>Hier einfügen und speichern.</li></ol>
  <div class="keyrow"><input id="fhKey" placeholder="Finnhub-Schlüssel" autocomplete="off" autocapitalize="off" spellcheck="false" value="${FHKEY.replace(/"/g,'')}"><button class="btn pri" data-act="fhSave">Speichern</button>${FHKEY?'<button class="btn" data-act="fhDel">Entfernen</button>':''}</div>
  <p>Der Schlüssel bleibt nur auf diesem Gerät. Ein Markt wechselt auf „Live“, sobald sein erster echter Kurs eintrifft. Außerhalb der Handelszeiten (Wochenende, nachts bei Aktien) kommt kein Kurs.</p></div>`;srcStatus()}
function srcStatus(){const b=$('#srcBn');if(!b)return;const dot=(ok,t)=>`<i class="st ${ok?'on':'wait'}">${t}</i>`;
  setH(b,dot(bnUp,bnUp?'Verbunden':'Verbinde …'));
  const fl=INS.filter(x=>!x.bn&&M[x.s].live).length,ft=INS.filter(x=>!x.bn).length;
  setH($('#srcFh'),!FHKEY?'<i class="st simu">Simuliert</i>':fhUp?dot(true,fl+' von '+ft+' mit echtem Kurs'):`<i class="st wait">${fhErr||'Verbinde …'}</i>`)}

/* ---------- Depot ---------- */
const simTag=l=>l?'':'<span class="tag m">Simuliert</span>';
const arrow=s=>s>0?'<span class="up">▲</span> Kauf':'<span class="dn">▼</span> Verkauf';
let pVer=-1,ptab='over',resetCap=1e4;
function buildPortfolio(){pVer=ver;
  $$('#ptabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===ptab));
  $('#pOver').hidden=ptab!=='over';$('#pOpenL').hidden=ptab!=='open';$('#pClosedL').hidden=ptab!=='closed';
  $('#pOpenL').innerHTML=(A.pos.length?A.pos.map(p=>`<div class="trow"><button class="tmain" data-act="pick" data-v="${p.s}">${ico(p.s)}<span><b>${p.s}${simTag(p.live)}</b><small>${arrow(p.side)} @ ${fp(p.s,p.entry)} · X${p.lev} · ${eur0(p.margin)}</small></span></button>
    <span class="tr"><b id="pl${p.id}"></b><small id="pp${p.id}"></small></span>
    <div class="acts"><small class="mute" style="margin-right:auto;font-size:12px">SL ${p.sl?fp(p.s,p.sl):'–'} · TP ${p.tp?fp(p.s,p.tp):'–'}</small><button class="btn sm" data-act="pick" data-v="${p.s}">Zum Chart</button><button class="btn sm danger" data-act="close" data-v="${p.id}">Schließen</button></div></div>`).join('')
    :'<div class="empty">Keine offenen Trades. Öffne im Tab „Handel“ deinen ersten Trade.</div>')+
    (A.ord.length?'<h3>Wartende Orders</h3>'+A.ord.map(o=>`<div class="trow"><button class="tmain" data-act="pick" data-v="${o.s}">${ico(o.s)}<span><b>${o.s}${simTag(M[o.s].live)}</b><small>${arrow(o.side)}-${o.kind==='limit'?'Limit':'Stop'} @ ${fp(o.s,o.price)} · X${o.lev} · ${eur0(o.amt)}</small></span></button><button class="btn sm" data-act="cancel" data-v="${o.id}">Löschen</button></div>`).join(''):'');
  const H=A.hist;
  $('#pClosedL').innerHTML=H.length?H.slice(0,60).map(h=>{const pc=(h.exit/h.entry-1)*h.side*h.lev*100;
    return`<div class="trow"><button class="tmain" data-act="pick" data-v="${h.s}">${ico(h.s)}<span><b>${h.s}${simTag(h.live)}</b><small>${arrow(h.side)} @ ${fp(h.s,h.entry)} · ${h.why}</small></span></button><span class="tr"><b class="${cls(h.pnl)}">${sgn(h.pnl)}</b><small>${pct(pc)}</small></span></div>`}).join('')
    :'<div class="empty">Noch keine geschlossenen Trades.</div>';
  const w=H.filter(h=>h.pnl>0),l=H.filter(h=>h.pnl<=0),sw=w.reduce((a,h)=>a+h.pnl,0),sl=-l.reduce((a,h)=>a+h.pnl,0),ns=H.filter(h=>!h.live).length;
  let st=`<div class="grid2"><div><small>Trades</small><b>${H.length}</b></div><div><small>Trefferquote</small><b>${H.length?nf(w.length/H.length*100,0)+' %':'–'}</b></div>
    <div><small>Ø Gewinn</small><b class="up">${w.length?eur(sw/w.length):'–'}</b></div><div><small>Ø Verlust</small><b class="dn">${l.length?eur(-sl/l.length):'–'}</b></div>
    <div><small>Profit-Faktor</small><b>${sl>0?nf(sw/sl,2):'–'}</b></div><div><small>Realisiert</small><b class="${cls(sw-sl)}">${sgn(sw-sl)}</b></div></div>`;
  if(ns)st+=`<div class="mute" style="font-size:12px;margin-top:6px">${ns} von ${H.length} Trades liefen auf simulierten Märkten.</div>`;
  if(H.length>1){const pts=[A.start];for(let i=H.length-1;i>=0;i--)pts.push(pts[pts.length-1]+H[i].pnl);const lo=Math.min(...pts),hi=Math.max(...pts),r=hi-lo||1;
    st+=`<svg class="curve" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Kontoverlauf nach geschlossenen Trades"><polyline fill="none" stroke="var(--acc)" stroke-width="1.6" vector-effect="non-scaling-stroke" points="${pts.map((p,i)=>(i*300/(pts.length-1)).toFixed(1)+','+(92-(p-lo)/r*84).toFixed(1)).join(' ')}"/></svg>
    <div class="mute" style="font-size:12px;margin-top:4px">Kontoverlauf nach jedem geschlossenen Trade (${eur(lo)} bis ${eur(hi)})</div>`}
  $('#pStat').innerHTML=st;resetUI(false);livePortfolio()}
function resetUI(ask){$('#resetbox').innerHTML=ask?`<span>Alle Trades, Orders und den Verlauf löschen?</span><button class="btn danger" data-act="resetYes">Ja, neu starten</button><button class="btn" data-act="resetNo">Abbrechen</button>`
  :`<label for="cap" class="mute">Startkapital</label><select id="cap"><option value="1000">1.000 €</option><option value="10000" selected>10.000 €</option><option value="100000">100.000 €</option></select><button class="btn danger" data-act="resetAsk">Konto zurücksetzen</button>`}
function livePortfolio(){if(pVer!==ver)return buildPortfolio();const a=acct(),tot=a.eq-A.start;
  $('#pEq').textContent=eur(a.eq);const t=$('#pTot');t.textContent=sgn(tot)+' ('+pct(tot/A.start*100)+')';t.className='num '+cls(tot);
  $('#pFree').textContent=eur(a.free);$('#pUsed').textContent=eur(a.used);const o=$('#pOpen');o.textContent=sgn(a.open);o.className=cls(a.open);
  $('#pLvl').textContent=a.used?nf(a.eq/a.used*100,0)+' %':'–';
  for(const p of A.pos){const e=$('#pl'+p.id);if(e){const g=pnl(p);e.textContent=sgn(g);e.className=cls(g);$('#pp'+p.id).textContent=pct(g/p.margin*100)}}}

/* ---------- Trade eröffnen ---------- */
let T={side:1,type:'market',lev:1},sheet='';
const AMTS=[100,500,1000,5000],LEVS=[1,2,5,10,20,30],NOPX='Für diesen Markt liegt gerade kein aktueller Kurs vor (Markt geschlossen oder Verbindung getrennt).';
function showSheet(s){sheet=s;$('#scrim').hidden=!s;$('#shTicket').hidden=s!=='ticket';$('#shStops').hidden=s!=='stops'}
function openTicket(side){if(status(sel)==='wait')return toast(NOPX);
  const a=acct(),tk=A.tk||{},ls=LEVS.filter(l=>l<=I[sel].lev);
  T={side,type:'market',lev:ls.filter(l=>l<=(tk.lev||1)).pop()||1};
  let amt=tk.amt||500;if(amt>a.free)amt=Math.max(0,Math.floor(a.free));
  $('#tkAmt').value=inp(amt,amt%1?2:0);$('#tkSL').value='';$('#tkTP').value='';$('#tkPrice').value=inp(M[sel].last,I[sel].d);$('#tkErr').textContent='';$('#tkMore').open=false;
  chips($('#tkSLQ'),[[1,'1 ATR','sm'],[2,'2 ATR','sm'],[0,'kein','sm']],-1,'slq');chips($('#tkTPQ'),[[2,'2 ATR','sm'],[4,'4 ATR','sm'],[0,'kein','sm']],-1,'tpq');
  showSheet('ticket');ticketBuild()}
function ticketVals(){const ins=I[sel],mk=T.type==='market',px=T.side>0?ask(sel):bid(sel),entry=mk?px:parse($('#tkPrice').value);
  const amt=parse($('#tkAmt').value),slv=$('#tkSL').value.trim(),tpv=$('#tkTP').value.trim(),sl=slv?parse(slv):0,tp=tpv?parse(tpv):0,f=fx(ins.q);
  const units=amt*T.lev/(entry*f),risk=sl?Math.abs(entry-sl)*units*f:null,rew=tp?Math.abs(tp-entry)*units*f:null;
  const kind=mk?'market':(T.side>0?(entry<px?'limit':'stop'):(entry>px?'limit':'stop'));
  return{ins,mk,px,entry,amt,sl,tp,f,units,risk,rew,kind}}
function ticketBuild(){const v=ticketVals(),a=acct(); // Knöpfe: nur nach einer Eingabe neu aufbauen
  $('#tkTitle').textContent=sel+(T.side>0?' kaufen':' verkaufen');$('#tkSrc').innerHTML=stTag(sel)+' '+srcTxt(sel);
  $('#tkAmtQ').innerHTML=AMTS.map(x=>`<button data-act="amtq" data-v="${x}" aria-pressed="${x===v.amt}"${x>a.free?' disabled':''}>${nf(x,0)} €</button>`).join('');
  $('#tkLev').innerHTML=LEVS.filter(l=>l<=v.ins.lev).map(l=>`<button data-act="lev" data-v="${l}" aria-pressed="${l===T.lev}">X${l}</button>`).join('');
  $('#tkLevMax').textContent='max. X'+v.ins.lev+' für '+CATS[v.ins.c];
  $$('#tkType button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===T.type));$('#tkPriceF').hidden=v.mk;
  const go=$('#tkGo');go.style.background=T.side>0?'var(--up)':'var(--dn)';
  go.textContent=v.mk?'Trade eröffnen':(T.side>0?'Kauf-Order':'Verkaufs-Order')+' platzieren';ticketLive()}
function ticketLive(){const v=ticketVals(),a=acct(),ok=isFinite(v.units)&&v.units>0,eqp=v.risk!=null&&a.eq>0?v.risk/a.eq*100:null;
  $('#tkFree').textContent='verfügbar '+eur(a.free);
  $('#tkKind').textContent=v.mk?'':(v.kind==='limit'?'Limit-Order':'Stop-Order')+' · aktuell '+fp(sel,v.px);
  $('#tkLine').textContent=ok?'Kurs '+fp(sel,v.entry)+' · Positionswert '+eur0(v.amt*T.lev)+' · Spread-Kosten '+eur(v.units*M[sel].last*v.ins.sp*v.f):'';
  $('#tkSum').innerHTML=`<span>Menge</span><span>${ok?nf(v.units,v.units<100?4:2):'–'}</span>
   <span>Risiko bis Stop-Loss</span><span class="${eqp>2?'dn':''}">${v.risk!=null&&ok?eur(v.risk)+' ('+nf(eqp,2)+' % vom Konto)':'ohne Stop unbegrenzt'}</span>
   <span>Chance bis Take-Profit</span><span>${v.rew!=null&&ok?eur(v.rew):'–'}</span>
   <span>Chance-Risiko-Verhältnis</span><span>${v.risk&&v.rew&&ok?'1 : '+nf(v.rew/v.risk,1):'–'}</span>`}
function submit(){const v=ticketVals(),a=acct(),E=t=>{$('#tkErr').textContent=t};
  if(status(sel)==='wait')return E(NOPX);
  if(v.mk&&posOf(sel).length)return E('In diesem Markt ist bereits ein Trade offen. Schließe ihn zuerst.');
  if(!(v.entry>0))return E('Bitte einen gültigen Einstiegskurs eingeben.');
  if(!(v.amt>=1))return E('Der Betrag muss mindestens 1 € sein.');
  if(v.amt>a.free)return E('Zu wenig freies Guthaben. Verfügbar: '+eur(a.free)+'.');
  if(v.sl&&!(v.sl>0)||v.tp&&!(v.tp>0))return E('Stop-Loss und Take-Profit müssen Kurse sein, z. B. '+inp(v.entry,v.ins.d)+'.');
  if(v.sl&&(T.side>0?v.sl>=v.entry:v.sl<=v.entry))return E(T.side>0?'Beim Kauf muss der Stop-Loss unter dem Einstiegskurs liegen.':'Beim Verkauf muss der Stop-Loss über dem Einstiegskurs liegen.');
  if(v.tp&&(T.side>0?v.tp<=v.entry:v.tp>=v.entry))return E(T.side>0?'Beim Kauf muss der Take-Profit über dem Einstiegskurs liegen.':'Beim Verkauf muss der Take-Profit unter dem Einstiegskurs liegen.');
  A.tk={amt:v.amt,lev:T.lev};
  if(v.mk){openPos(sel,T.side,v.amt,T.lev,v.entry,v.sl||0,v.tp||0);toast(sel+(T.side>0?' gekauft zu ':' verkauft zu ')+fp(sel,v.entry))}
  else{A.ord.push({id:A.id++,s:sel,side:T.side,price:v.entry,kind:v.kind,amt:v.amt,lev:T.lev,sl:v.sl||0,tp:v.tp||0});ver++;save();toast(sel+': '+(v.kind==='limit'?'Limit':'Stop')+'-Order platziert bei '+fp(sel,v.entry))}
  showSheet('');off=0;liveTrade();draw()}

/* ---------- Stops für offene Trades ---------- */
function openStops(){const ps=posOf(sel);if(!ps.length)return;const p=ps[0],d=I[sel].d;
  $('#stTitle').textContent='Stops für '+sel;$('#stSL').value=p.sl?inp(p.sl,d):'';$('#stTP').value=p.tp?inp(p.tp,d):'';$('#stErr').textContent='';
  chips($('#stSLQ'),[[1,'1 ATR','sm'],[2,'2 ATR','sm'],[0,'kein','sm']],-1,'stq');chips($('#stTPQ'),[[2,'2 ATR','sm'],[4,'4 ATR','sm'],[0,'kein','sm']],-1,'ttq');
  showSheet('stops');stopsLive()}
function stopsLive(){const ps=posOf(sel);if(!ps.length)return showSheet('');const p=ps[0],slv=$('#stSL').value.trim(),tpv=$('#stTP').value.trim(),sl=slv?parse(slv):0,tp=tpv?parse(tpv):0;
  const at=x=>ps.reduce((a,q)=>a+pnl(q,x),0);
  $('#stNow').textContent=(p.side>0?'Kauf':'Verkauf')+' @ '+fp(sel,p.entry)+' · aktueller Kurs '+fp(sel,exitPx(p))+' · '+sgn(sumPl(ps));
  $('#stSum').innerHTML=`<span>Ergebnis am Stop-Loss</span><span class="${sl>0?cls(at(sl)):''}">${sl>0?sgn(at(sl)):'kein Stop gesetzt'}</span><span>Ergebnis am Take-Profit</span><span class="${tp>0?cls(at(tp)):''}">${tp>0?sgn(at(tp)):'kein Ziel gesetzt'}</span>`}
function saveStops(){const ps=posOf(sel);if(!ps.length)return showSheet('');const p=ps[0],px=exitPx(p),E=t=>{$('#stErr').textContent=t};
  const slv=$('#stSL').value.trim(),tpv=$('#stTP').value.trim(),sl=slv?parse(slv):0,tp=tpv?parse(tpv):0;
  if(slv&&!(sl>0)||tpv&&!(tp>0))return E('Bitte Kurse eingeben, z. B. '+inp(px,I[sel].d)+'.');
  if(sl&&(p.side>0?sl>=px:sl<=px))return E(p.side>0?'Der Stop-Loss muss unter dem aktuellen Kurs liegen.':'Der Stop-Loss muss über dem aktuellen Kurs liegen.');
  if(tp&&(p.side>0?tp<=px:tp>=px))return E(p.side>0?'Der Take-Profit muss über dem aktuellen Kurs liegen.':'Der Take-Profit muss unter dem aktuellen Kurs liegen.');
  ps.forEach(q=>{q.sl=sl;q.tp=tp});ver++;save();showSheet('');draw();toast(sl||tp?'Stops gespeichert':'Stops entfernt')}

/* ---------- Lektionen ---------- */
const L=window.LESSONS||[];
function buildLearn(){$('#lessons').innerHTML=L.map(([id,t,body,q,o],i)=>`<details class="${A.learn[id]?'done':''}" id="les-${id}"><summary><span class="ck"></span>${t}</summary><div class="lesson">${body}<div class="quiz"><p>${q}</p>${o.map((x,j)=>`<button data-act="quiz" data-v="${i}:${j}">${x}</button>`).join('')}<div class="why" hidden></div></div></div></details>`).join('');learnProg()}
function learnProg(){const n=L.filter(l=>A.learn[l[0]]).length;$('#lProg').textContent=n+' von '+L.length+' Lektionen abgeschlossen';$('#lBar').style.width=n/L.length*100+'%'}

/* ---------- Steuerung ---------- */
function setTab(t){tab=t;['markets','trade','portfolio','learn'].forEach(v=>$('#v-'+v).hidden=v!==t);
  $$('#nav button').forEach(b=>b.dataset.v===t?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  $('main').scrollTop=0;if(t==='trade'){sKey='';liveTrade();requestAnimationFrame(draw)}if(t==='portfolio')buildPortfolio();if(t==='markets')liveMarkets()}
function pick(s){sel=s;off=0;cross=null;if(tool==='set')buildTools();save()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const v=b.dataset.v;
  switch(b.dataset.act){
   case'tab':setTab(v);break;
   case'ptab':ptab=v;buildPortfolio();$('main').scrollTop=0;break;
   case'filt':filt=v;buildMarkets();break;
   case'pick':pick(v);if(tab==='trade'){liveTrade();draw()}else setTab('trade');break;
   case'tool':tool=tool===v?'':v;buildTools();draw();break;
   case'tf':TF=+v;off=0;cross=null;tool='';buildTools();liveTrade();draw();save();break;
   case'ind':ind[v]=!ind[v];buildTools();draw();save();break;
   case'zoom':zoom=Math.max(20,Math.min(200,Math.round(zoom*+v)));draw();break;
   case'speed':speed=+v;buildTools();break;
   case'live':off=0;cross=null;draw();break;
   case'ticket':openTicket(+v);break;
   case'closeSheet':showSheet('');break;
   case'amtq':$('#tkAmt').value=inp(+v,0);$('#tkErr').textContent='';ticketBuild();break;
   case'lev':T.lev=+v;ticketBuild();break;
   case'slq':case'tpq':{const t=ticketVals(),a=atr(sel),isSL=b.dataset.act==='slq',dir=isSL?-T.side:T.side;
     $(isSL?'#tkSL':'#tkTP').value=+v&&isFinite(t.entry)?inp(t.entry+dir*a*v,t.ins.d):'';ticketLive();break}
   case'stq':case'ttq':{const p=posOf(sel)[0];if(!p)break;const a=atr(sel),isSL=b.dataset.act==='stq',dir=isSL?-p.side:p.side;
     $(isSL?'#stSL':'#stTP').value=+v?inp(exitPx(p)+dir*a*v,I[sel].d):'';$('#stErr').textContent='';stopsLive();break}
   case'submit':submit();break;
   case'stops':openStops();break;
   case'saveStops':saveStops();break;
   case'closeSel':{if(status(sel)==='wait'){toast(NOPX);break}const ps=posOf(sel);ps.forEach(p=>closePos(p,'manuell'));liveTrade();draw();break}
   case'close':{const p=A.pos.find(p=>p.id===+v);if(p){if(status(p.s)==='wait'){toast(NOPX);break}closePos(p,'manuell')}buildPortfolio();break}
   case'cancel':A.ord=A.ord.filter(o=>o.id!==+v);ver++;save();if(tab==='portfolio')buildPortfolio();else{liveTrade();draw()}break;
   case'resetAsk':resetCap=+$('#cap').value;resetUI(true);break;
   case'resetNo':resetUI(false);break;
   case'resetYes':A.bal=A.start=resetCap;A.pos=[];A.ord=[];A.hist=[];ver++;save();buildPortfolio();toast('Neues Konto mit '+eur(resetCap)+' gestartet');break;
   case'fhSave':{const k=$('#fhKey').value.trim();if(!k){toast('Bitte zuerst den Schlüssel einfügen.');break}
     try{localStorage.setItem(KEY+'.fh',k)}catch(_){}FHKEY=k;fhErr='';fhTry=0;if(fhWs)try{fhWs.close()}catch(_){}fhWs=null;fhUp=false;fhStart();buildSrc();toast('Schlüssel gespeichert. Verbinde mit Finnhub …');break}
   case'fhDel':try{localStorage.removeItem(KEY+'.fh');localStorage.removeItem(KEY+'.lc')}catch(_){}
     for(const x of INS)if(!x.bn&&M[x.s].live){for(const p of posOf(x.s))closePos(p,'Datenquelle entfernt');A.ord=A.ord.filter(o=>o.s!==x.s);delete A.last[x.s]}
     A.seen={};FHKEY='';INS.forEach(x=>{if(!x.bn)M[x.s].ready=false});save();location.reload();break;
   case'quiz':{const [i,j]=v.split(':').map(Number),l=L[i],box=b.parentElement,ok=j===l[5];b.classList.add(ok?'ok':'no');
     if(ok){const w=box.querySelector('.why');w.textContent=l[6];w.hidden=false;A.learn[l[0]]=1;$('#les-'+l[0]).classList.add('done');learnProg();save()}break}
  }});
$('#tkType').addEventListener('click',e=>{const b=e.target.closest('button');if(b){T.type=b.dataset.v;if(T.type==='pending')$('#tkPrice').value=inp(M[sel].last,I[sel].d);ticketBuild()}});
$('#tkAmt').addEventListener('input',()=>{$('#tkErr').textContent='';const v=parse($('#tkAmt').value);$$('#tkAmtQ button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===v));ticketLive()});
['tkSL','tkTP','tkPrice'].forEach(id=>$('#'+id).addEventListener('input',()=>{$('#tkErr').textContent='';ticketLive()}));
['stSL','stTP'].forEach(id=>$('#'+id).addEventListener('input',()=>{$('#stErr').textContent='';stopsLive()}));
$('#scrim').addEventListener('click',e=>{if(e.target.id==='scrim')showSheet('')});
window.addEventListener('resize',()=>tab==='trade'&&draw());

function head(){$('#hEq').textContent=eur(acct().eq);let l=0,s=0,w=0;for(const x of INS){const st=status(x.s);st==='live'?l++:st==='sim'?s++:w++}
  $('#hStat').textContent='Virtuelles Konto · '+l+' Märkte live'+(s?' · '+s+' simuliert':'')+(w?' · '+w+' warten':'')}
buildMarkets();buildSrc();buildTools();buildLearn();setTab('trade');head();
bnStart();fhStart();
let n=0;
setInterval(()=>{tick();checkOrders();n++;
  if(tab==='trade'){draw();if(n%2===0)liveTrade();if(n%4===0){if(sheet==='ticket')ticketLive();if(sheet==='stops')stopsLive()}}
  if(n%2===0){head();if(tab==='portfolio')livePortfolio()}
  if(tab==='markets'&&n%4===0)liveMarkets();
  if(n%40===0)save();if(n%240===0)saveLC()},250);
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();saveLC()}else{bnStart();fhStart()}});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>tab==='trade'&&draw());
})();
