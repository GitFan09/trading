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

/* ---------- Chart ---------- */
let colC=null,colT=0;
function colors(){if(!colC||Date.now()-colT>1500){const cs=getComputedStyle(document.documentElement),g=n=>cs.getPropertyValue(n).trim();
  colC={fg:g('--fg'),mute:g('--mute'),line:g('--line'),up:g('--up'),dn:g('--dn'),acc:g('--acc'),surf:g('--surf'),bg:g('--bg')};colT=Date.now()}return colC}
function draw(){
  const cv=$('#chart'),bx=cv.parentElement.getBoundingClientRect();if(bx.width<20||bx.height<20)return;
  const dpr=window.devicePixelRatio||1,W=bx.width,H=bx.height;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const C=colors(),ins=I[sel],S=candles(sel,TF),ax=64,tH=18,rH=ind.rsi?Math.round(H*.2):0,pH=H-tH-rH,sim=!M[sel].live;
  g.textBaseline='middle';
  if(sim){g.font='700 34px "Bricolage Grotesque",system-ui,sans-serif';g.textAlign='center';g.fillStyle=C.fg;g.globalAlpha=.07;g.fillText('SIMULIERT',(W-ax)/2,pH/2);g.globalAlpha=1}
  if(S.length<2){geo=null;g.font='500 13px Inter,system-ui,sans-serif';g.textAlign='center';g.fillStyle=C.mute;
    g.fillText(M[sel].ready?'Der Chart baut sich aus den eintreffenden Kursen auf …':'Warte auf den ersten echten Kurs …',W/2,H/2);$('#ohlc').textContent='';$('#toLive').hidden=true;return}
  const n=Math.min(zoom,S.length);off=Math.max(0,Math.min(off,S.length-n));const end=S.length-off,st=end-n,cw=(W-ax)/Math.max(n,20);
  geo={cw,st,n,ax,W};
  const cl=S.map(k=>k[4]),bb=ind.bb?boll(cl):null;
  let lo=Infinity,hi=-Infinity;
  for(let i=st;i<end;i++){lo=Math.min(lo,S[i][3]);hi=Math.max(hi,S[i][2]);if(bb&&bb[i]){lo=Math.min(lo,bb[i][2]);hi=Math.max(hi,bb[i][0])}}
  const pad=(hi-lo)*.1||hi*.0005;lo-=pad;hi+=pad;
  const y=p=>(hi-p)/(hi-lo)*pH,x=i=>(i-st+.5)*cw,mono='500 10.5px "JetBrains Mono",ui-monospace,Menlo,monospace';
  g.font=mono;g.lineWidth=1;
  for(let k=0;k<5;k++){const p=lo+(hi-lo)*(k+.5)/5,yy=Math.round(y(p))+.5;g.strokeStyle=C.line;g.globalAlpha=.5;g.beginPath();g.moveTo(0,yy);g.lineTo(W-ax,yy);g.stroke();g.globalAlpha=1;
    g.fillStyle=C.mute;g.textAlign='left';g.fillText(nf(p,ins.d),W-ax+6,yy)}
  const step=Math.max(1,Math.ceil(Math.max(n,20)/4));g.textAlign='center';g.fillStyle=C.mute;
  for(let i=st;i<end;i++)if((i-st)%step===(step>>1))g.fillText(hm(S[i][0]),x(i),H-tH/2);
  if(bb){g.strokeStyle=C.mute;g.globalAlpha=.7;for(const j of [0,2]){g.beginPath();let f=1;for(let i=st;i<end;i++){if(!bb[i])continue;f?g.moveTo(x(i),y(bb[i][j])):g.lineTo(x(i),y(bb[i][j]));f=0}g.stroke()}g.globalAlpha=1}
  const bw=Math.max(1,cw*.68);
  for(let i=st;i<end;i++){const k=S[i],u=k[4]>=k[1];g.fillStyle=g.strokeStyle=u?C.up:C.dn;const xx=x(i);
    g.beginPath();g.moveTo(Math.round(xx)+.5,y(k[2]));g.lineTo(Math.round(xx)+.5,y(k[3]));g.stroke();
    const y1=y(Math.max(k[1],k[4])),y2=y(Math.min(k[1],k[4]));g.fillRect(xx-bw/2,y1,bw,Math.max(1,y2-y1))}
  if(ind.ema){[[9,C.acc],[21,C.fg]].forEach(([p,c])=>{const e=ema(cl,p);g.strokeStyle=c;g.lineWidth=1.3;g.globalAlpha=.9;g.beginPath();for(let i=st;i<end;i++)i===st?g.moveTo(x(i),y(e[i])):g.lineTo(x(i),y(e[i]));g.stroke();g.globalAlpha=1;g.lineWidth=1})}
  const hl=(p,c,txt,dash)=>{if(p<lo||p>hi)return;const yy=Math.round(y(p))+.5;g.strokeStyle=c;g.setLineDash(dash||[]);g.beginPath();g.moveTo(0,yy);g.lineTo(W-ax,yy);g.stroke();g.setLineDash([]);
    if(txt){g.font='600 10px Inter,system-ui,sans-serif';const w=g.measureText(txt).width+8;g.fillStyle=c;g.fillRect(4,yy-8,w,16);g.fillStyle=C.bg;g.textAlign='left';g.fillText(txt,8,yy+.5);g.font=mono}};
  for(const p of A.pos)if(p.s===sel){hl(p.entry,C.acc,p.side>0?'Long':'Short');if(p.sl)hl(p.sl,C.dn,'SL',[4,3]);if(p.tp)hl(p.tp,C.up,'TP',[4,3])}
  for(const o of A.ord)if(o.s===sel)hl(o.price,C.mute,'Order',[2,3]);
  const lp=M[sel].last,ly=Math.round(y(lp))+.5,lk=S[S.length-1],lu=lk[4]>=lk[1];
  if(lp>=lo&&lp<=hi){g.strokeStyle=lu?C.up:C.dn;g.setLineDash([2,2]);g.beginPath();g.moveTo(0,ly);g.lineTo(W-ax,ly);g.stroke();g.setLineDash([]);
    g.fillStyle=lu?C.up:C.dn;g.fillRect(W-ax,ly-9,ax,18);g.fillStyle=C.bg;g.textAlign='left';g.fillText(nf(lp,ins.d),W-ax+6,ly)}
  if(rH){const r=rsi(cl),y0=pH,ry=v=>y0+4+(100-v)/100*(rH-8);g.strokeStyle=C.line;g.beginPath();g.moveTo(0,y0+.5);g.lineTo(W,y0+.5);g.stroke();
    g.globalAlpha=.5;[30,70].forEach(v=>{g.setLineDash([3,3]);g.beginPath();g.moveTo(0,ry(v));g.lineTo(W-ax,ry(v));g.stroke()});g.setLineDash([]);g.globalAlpha=1;
    g.fillStyle=C.mute;g.textAlign='left';g.fillText('RSI 70',W-ax+6,ry(70));g.fillText('30',W-ax+6,ry(30));
    g.strokeStyle=C.acc;g.lineWidth=1.3;g.beginPath();let f=1;for(let i=st;i<end;i++){if(r[i]==null)continue;f?g.moveTo(x(i),ry(r[i])):g.lineTo(x(i),ry(r[i]));f=0}g.stroke();g.lineWidth=1}
  let k=lk;
  if(cross!=null&&cross>=st&&cross<end){k=S[cross];const xx=Math.round(x(cross))+.5;g.strokeStyle=C.mute;g.setLineDash([3,3]);g.beginPath();g.moveTo(xx,0);g.lineTo(xx,pH+rH);g.stroke();g.setLineDash([])}
  $('#ohlc').textContent=(cross!=null?hm(k[0])+'  ':'')+'O '+nf(k[1],ins.d)+'  H '+nf(k[2],ins.d)+'  L '+nf(k[3],ins.d)+'  C '+nf(k[4],ins.d);
  $('#toLive').hidden=off===0}
(()=>{const cv=$('#chart');let d=null;
  cv.addEventListener('pointerdown',e=>{d={x:e.clientX,o:off,m:0};cv.setPointerCapture(e.pointerId)});
  cv.addEventListener('pointermove',e=>{if(!d||!geo)return;const dx=e.clientX-d.x;if(Math.abs(dx)>5)d.m=1;if(d.m){off=d.o+Math.round(dx/geo.cw);draw()}});
  const up=e=>{if(d&&!d.m&&geo){const r=cv.getBoundingClientRect(),i=geo.st+Math.floor((e.clientX-r.left)/geo.cw);cross=(cross===i||e.clientX-r.left>geo.W-geo.ax)?null:i;draw()}d=null};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',()=>d=null)})();

/* ---------- Ansichten ---------- */
function chips(el,list,cur,act){el.innerHTML=list.map(([v,t,c])=>`<button class="chip ${c||''}" data-act="${act}" data-v="${v}" aria-pressed="${String(v)===String(cur)}">${t}</button>`).join('')}
let mBuilt=-1;
function buildMarkets(){mBuilt=mVer;
  chips($('#filt'),[['alle','Alle'],['live','Nur echte Kurse'],...Object.entries(CATS)],filt,'filt');
  let h='',lc='';
  for(const x of INS){if(filt==='live'?!M[x.s].live:(filt!=='alle'&&x.c!==filt))continue;
    if((filt==='alle'||filt==='live')&&x.c!==lc){h+=`<div class="cat">${CATS[x.c]}</div>`;lc=x.c}
    h+=`<button class="row" data-act="pick" data-v="${x.s}"><span><b>${x.s} <span id="ms${x.i}"></span></b><small>${x.n}</small></span><svg class="spark" viewBox="0 0 64 24" aria-hidden="true"><polyline id="sp${x.i}" points=""/></svg><span class="px"><b id="mp${x.i}"></b><small id="mc${x.i}"></small></span></button>`}
  $('#mrows').innerHTML=h||'<div class="empty">Keine Märkte in dieser Auswahl.</div>';liveMarkets()}
function liveMarkets(){if(mBuilt!==mVer)return buildMarkets();
  for(const x of INS){const e=$('#mp'+x.i);if(!e)continue;const m=M[x.s],ch=dayCh(x.s),c=m.c;
  e.textContent=known(x.s)?fp(x.s,m.last):'…';const mc=$('#mc'+x.i);mc.textContent=pct(ch);mc.className=cls(ch);
  const tg=$('#ms'+x.i),t=stTag(x.s);if(tg.dataset.h!==t){tg.innerHTML=t;tg.dataset.h=t}
  const sp=$('#sp'+x.i),pts=[];for(let i=Math.max(0,c.length-120);i<c.length;i+=4)pts.push(c[i][4]);
  if(pts.length<3){sp.setAttribute('points','');continue}const lo=Math.min(...pts),hi=Math.max(...pts),r=hi-lo||1;
  sp.setAttribute('points',pts.map((p,i)=>(i*64/(pts.length-1)).toFixed(1)+','+(22-(p-lo)/r*20).toFixed(1)).join(' '));
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
  let h=dot(bnUp,bnUp?'Verbunden':'Verbinde …');if(b.dataset.h!==h){b.innerHTML=h;b.dataset.h=h}
  const f=$('#srcFh'),fl=INS.filter(x=>!x.bn&&M[x.s].live).length,ft=INS.filter(x=>!x.bn).length;
  h=!FHKEY?'<i class="st simu">Simuliert</i>':fhUp?dot(true,fl+' von '+ft+' mit echtem Kurs'):`<i class="st wait">${fhErr||'Verbinde …'}</i>`;
  if(f.dataset.h!==h){f.innerHTML=h;f.dataset.h=h}}
function buildTrade(){
  $('#selIns').innerHTML=Object.entries(CATS).map(([c,t])=>`<optgroup label="${t}">${INS.filter(x=>x.c===c).map(x=>`<option value="${x.s}"${x.s===sel?' selected':''}>${x.s}${M[x.s].live?'':' (simuliert)'}</option>`).join('')}</optgroup>`).join('');
  $('#tools').innerHTML=[[1,'1 Min'],[5,'5 Min'],[15,'15 Min'],[60,'1 Std']].map(([v,t])=>`<button class="chip sm" data-act="tf" data-v="${v}" aria-pressed="${v===TF}">${t}</button>`).join('')+'<span class="sep"></span>'+
    [['ema','EMA 9/21'],['bb','Bollinger'],['rsi','RSI']].map(([v,t])=>`<button class="chip sm" data-act="ind" data-v="${v}" aria-pressed="${!!ind[v]}">${t}</button>`).join('')+'<span class="sep"></span>'+
    `<button class="chip sm" data-act="zoom" data-v="1.4" aria-label="Herauszoomen">−</button><button class="chip sm" data-act="zoom" data-v="0.7" aria-label="Hineinzoomen">+</button>`;
  $('#speed').innerHTML='<span class="mute" style="align-self:center;font-size:12px;margin-right:2px">Tempo der Simulation</span>'+[[0,'Pause'],[1,'Echtzeit'],[10,'10×'],[60,'60×']].map(([v,t])=>`<button class="chip sm" data-act="speed" data-v="${v}" aria-pressed="${v===speed}">${t}</button>`).join('')}
let tVer=-1;
function liveTrade(){if(tVer!==mVer){tVer=mVer;buildTrade()}
  const ch=dayCh(sel),ok=known(sel);$('#tPx').textContent=ok?fp(sel,M[sel].last):'…';const c=$('#tCh');c.textContent=ch==null?'–':pct(ch)+' · 24 h';c.className=cls(ch);
  const sr=$('#tSrc'),h=stTag(sel)+' '+srcTxt(sel);if(sr.dataset.h!==h){sr.innerHTML=h;sr.dataset.h=h}
  $('#speed').hidden=M[sel].live;
  $('#bBid').textContent=ok?fp(sel,bid(sel)):'–';$('#bAsk').textContent=ok?fp(sel,ask(sel)):'–';
  const ps=A.pos.filter(p=>p.s===sel),st=$('#posstrip');st.hidden=!ps.length;
  if(ps.length){const g=ps.reduce((a,p)=>a+pnl(p),0);st.innerHTML=`<span>${ps.length} offene Position${ps.length>1?'en':''} in ${sel}</span><b class="num ${cls(g)}">${sgn(g)} ›</b>`}}
const simTag=l=>l?'':'<span class="tag m">Simuliert</span>';
let pVer=-1;
function buildPortfolio(){pVer=ver;
  $('#pPos').innerHTML=A.pos.length?A.pos.map(p=>`<div class="item"><div><span class="t">${p.s}</span><span class="tag ${p.side>0?'l':'s'}">${p.side>0?'Long':'Short'} ${p.lev}×</span>${simTag(p.live)}
    <div class="d">Einstieg ${fp(p.s,p.entry)} · Einsatz ${eur(p.margin)}</div><div class="d">SL ${p.sl?fp(p.s,p.sl):'–'} · TP ${p.tp?fp(p.s,p.tp):'–'}</div></div>
    <div style="text-align:right"><div class="p" id="pl${p.id}"></div><button class="btn" data-act="close" data-v="${p.id}" style="margin-top:6px">Schließen</button></div></div>`).join(''):'<div class="empty">Keine offenen Positionen. Öffne im Tab „Handel“ deinen ersten Trade.</div>';
  $('#pOrd').innerHTML=A.ord.length?A.ord.map(o=>`<div class="item"><div><span class="t">${o.s}</span><span class="tag ${o.side>0?'l':'s'}">${o.side>0?'Kauf':'Verkauf'}-${o.kind==='limit'?'Limit':'Stop'}</span>${simTag(M[o.s].live)}
    <div class="d">bei ${fp(o.s,o.price)} · Einsatz ${eur(o.amt)} · ${o.lev}×</div></div><button class="btn" data-act="cancel" data-v="${o.id}">Löschen</button></div>`).join(''):'<div class="empty">Keine wartenden Orders.</div>';
  const H=A.hist,w=H.filter(h=>h.pnl>0),l=H.filter(h=>h.pnl<=0),sw=w.reduce((a,h)=>a+h.pnl,0),sl=-l.reduce((a,h)=>a+h.pnl,0),ns=H.filter(h=>!h.live).length;
  let st=`<div class="grid2"><div><small>Trades</small><b>${H.length}</b></div><div><small>Trefferquote</small><b>${H.length?nf(w.length/H.length*100,0)+' %':'–'}</b></div>
    <div><small>Ø Gewinn</small><b class="up">${w.length?eur(sw/w.length):'–'}</b></div><div><small>Ø Verlust</small><b class="dn">${l.length?eur(-sl/l.length):'–'}</b></div>
    <div><small>Profit-Faktor</small><b>${sl>0?nf(sw/sl,2):'–'}</b></div><div><small>Realisiert</small><b class="${cls(sw-sl)}">${sgn(sw-sl)}</b></div></div>`;
  if(ns)st+=`<div class="mute" style="font-size:12px;margin-top:6px">${ns} von ${H.length} Trades liefen auf simulierten Märkten.</div>`;
  if(H.length>1){const pts=[A.start];for(let i=H.length-1;i>=0;i--)pts.push(pts[pts.length-1]+H[i].pnl);const lo=Math.min(...pts),hi=Math.max(...pts),r=hi-lo||1;
    st+=`<svg class="curve" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Kontoverlauf nach abgeschlossenen Trades"><polyline fill="none" stroke="var(--acc)" stroke-width="1.6" vector-effect="non-scaling-stroke" points="${pts.map((p,i)=>(i*300/(pts.length-1)).toFixed(1)+','+(92-(p-lo)/r*84).toFixed(1)).join(' ')}"/></svg>
    <div class="mute" style="font-size:12px;margin-top:4px">Kontoverlauf nach jedem abgeschlossenen Trade (${eur(lo)} bis ${eur(hi)})</div>`}
  $('#pStat').innerHTML=st;
  $('#pHist').innerHTML=H.length?H.slice(0,40).map(h=>`<div class="item"><div><span class="t">${h.s}</span><span class="tag ${h.side>0?'l':'s'}">${h.side>0?'Long':'Short'} ${h.lev}×</span>${simTag(h.live)}
    <div class="d">${fp(h.s,h.entry)} → ${fp(h.s,h.exit)} · ${h.why}</div></div><div class="p ${cls(h.pnl)}">${sgn(h.pnl)}</div></div>`).join(''):'<div class="empty">Noch keine abgeschlossenen Trades.</div>';
  resetUI(false);livePortfolio()}
let resetCap=1e4;
function resetUI(ask){$('#resetbox').innerHTML=ask?`<span>Alle Positionen, Orders und den Verlauf löschen?</span><button class="btn danger" data-act="resetYes">Ja, neu starten</button><button class="btn" data-act="resetNo">Abbrechen</button>`
  :`<label for="cap" class="mute">Startkapital</label><select id="cap"><option value="1000">1.000 €</option><option value="10000" selected>10.000 €</option><option value="100000">100.000 €</option></select><button class="btn danger" data-act="resetAsk">Konto zurücksetzen</button>`}
function livePortfolio(){if(pVer!==ver)return buildPortfolio();const a=acct(),tot=a.eq-A.start;
  $('#pEq').textContent=eur(a.eq);const t=$('#pTot');t.textContent=sgn(tot)+' ('+pct(tot/A.start*100)+')';t.className='num '+cls(tot);
  $('#pFree').textContent=eur(a.free);$('#pUsed').textContent=eur(a.used);const o=$('#pOpen');o.textContent=sgn(a.open);o.className=cls(a.open);
  $('#pLvl').textContent=a.used?nf(a.eq/a.used*100,0)+' %':'–';
  for(const p of A.pos){const e=$('#pl'+p.id);if(e){const g=pnl(p);e.textContent=sgn(g);e.className='p '+cls(g)}}}

/* ---------- Order-Ticket ---------- */
let T={side:1,type:'market',lev:1};
const LEVS=[1,2,5,10,20,30],NOPX='Für diesen Markt liegt gerade kein aktueller Kurs vor (Markt geschlossen oder Verbindung getrennt).';
function openTicket(side){if(status(sel)==='wait')return toast(NOPX);
  T={side,type:'market',lev:Math.min(I[sel].lev,5)};const a=acct();
  $('#tkAmt').value=inp(Math.max(0,Math.floor(a.free*.05)),0);$('#tkSL').value='';$('#tkTP').value='';$('#tkPrice').value=inp(M[sel].last,I[sel].d);$('#tkErr').textContent='';
  chips($('#tkAmtQ'),[[1,'1 %','sm'],[2,'2 %','sm'],[5,'5 %','sm'],[10,'10 %','sm'],[25,'25 %','sm']],-1,'amtq');
  chips($('#tkSLQ'),[[1,'1 ATR','sm'],[2,'2 ATR','sm'],[0,'kein','sm']],-1,'slq');chips($('#tkTPQ'),[[2,'2 ATR','sm'],[4,'4 ATR','sm'],[0,'kein','sm']],-1,'tpq');
  $('#scrim').hidden=false;ticketUI()}
function ticketVals(){const ins=I[sel],mk=T.type==='market',px=T.side>0?ask(sel):bid(sel),entry=mk?px:parse($('#tkPrice').value);
  const amt=parse($('#tkAmt').value),slv=$('#tkSL').value.trim(),tpv=$('#tkTP').value.trim(),sl=slv?parse(slv):0,tp=tpv?parse(tpv):0,f=fx(ins.q);
  const units=amt*T.lev/(entry*f),risk=sl?Math.abs(entry-sl)*units*f:null,rew=tp?Math.abs(tp-entry)*units*f:null;
  const kind=mk?'market':(T.side>0?(entry<px?'limit':'stop'):(entry>px?'limit':'stop'));
  return{ins,mk,px,entry,amt,sl,tp,f,units,risk,rew,kind}}
function ticketUI(){const v=ticketVals(),a=acct();
  $('#tkTitle').textContent=sel+' handeln';$('#tkSrc').innerHTML=stTag(sel)+' '+srcTxt(sel);
  $$('#tkSide button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===T.side));
  $$('#tkType button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===T.type));
  $('#tkPriceF').hidden=v.mk;$('#tkKind').textContent=v.mk?'':(v.kind==='limit'?'Limit-Order':'Stop-Order')+' · aktuell '+fp(sel,v.px);
  $('#tkFree').textContent='verfügbar '+eur(a.free);$('#tkLevMax').textContent='max. '+v.ins.lev+'× für '+CATS[v.ins.c];
  chips($('#tkLev'),LEVS.filter(l=>l<=v.ins.lev).map(l=>[l,l+'×']),T.lev,'lev');
  const ok=isFinite(v.units)&&v.units>0,eqp=v.risk!=null&&a.eq>0?v.risk/a.eq*100:null;
  $('#tkSum').innerHTML=`<span>Kurs</span><span>${isFinite(v.entry)?fp(sel,v.entry):'–'}</span>
   <span>Positionswert</span><span>${ok?eur(v.amt*T.lev):'–'}</span>
   <span>Menge</span><span>${ok?nf(v.units,v.units<100?4:2):'–'}</span>
   <span>Spread-Kosten</span><span>${ok?eur(v.units*M[sel].last*v.ins.sp*v.f):'–'}</span>
   <span>Risiko bis Stop-Loss</span><span class="${eqp>2?'dn':''}">${v.risk!=null&&ok?eur(v.risk)+' ('+nf(eqp,2)+' % vom Konto)':'ohne Stop unbegrenzt'}</span>
   <span>Chance bis Take-Profit</span><span>${v.rew!=null&&ok?eur(v.rew):'–'}</span>
   <span>Chance-Risiko-Verhältnis</span><span>${v.risk&&v.rew&&ok?'1 : '+nf(v.rew/v.risk,1):'–'}</span>`;
  const go=$('#tkGo');go.style.background=T.side>0?'var(--up)':'var(--dn)';
  go.textContent=(v.mk?(T.side>0?'Long eröffnen':'Short eröffnen'):(T.side>0?'Kauf-Order':'Verkaufs-Order')+' platzieren')}
function submit(){const v=ticketVals(),a=acct(),E=t=>{$('#tkErr').textContent=t};
  if(status(sel)==='wait')return E(NOPX);
  if(!(v.entry>0))return E('Bitte einen gültigen Einstiegskurs eingeben.');
  if(!(v.amt>=1))return E('Der Einsatz muss mindestens 1 € betragen.');
  if(v.amt>a.free)return E('Zu wenig freie Margin. Verfügbar: '+eur(a.free)+'.');
  if(v.sl&&!(v.sl>0)||v.tp&&!(v.tp>0))return E('Stop-Loss und Take-Profit müssen Kurse sein, z. B. '+inp(v.entry,v.ins.d)+'.');
  if(v.sl&&(T.side>0?v.sl>=v.entry:v.sl<=v.entry))return E(T.side>0?'Bei Long muss der Stop-Loss unter dem Einstiegskurs liegen.':'Bei Short muss der Stop-Loss über dem Einstiegskurs liegen.');
  if(v.tp&&(T.side>0?v.tp<=v.entry:v.tp>=v.entry))return E(T.side>0?'Bei Long muss der Take-Profit über dem Einstiegskurs liegen.':'Bei Short muss der Take-Profit unter dem Einstiegskurs liegen.');
  if(v.mk){openPos(sel,T.side,v.amt,T.lev,v.entry,v.sl||0,v.tp||0);toast(sel+' '+(T.side>0?'Long':'Short')+' eröffnet zu '+fp(sel,v.entry))}
  else{A.ord.push({id:A.id++,s:sel,side:T.side,price:v.entry,kind:v.kind,amt:v.amt,lev:T.lev,sl:v.sl||0,tp:v.tp||0});ver++;save();toast(sel+': '+(v.kind==='limit'?'Limit':'Stop')+'-Order platziert bei '+fp(sel,v.entry))}
  $('#scrim').hidden=true;draw()}

/* ---------- Lektionen ---------- */
const L=window.LESSONS||[];
function buildLearn(){$('#lessons').innerHTML=L.map(([id,t,body,q,o],i)=>`<details class="${A.learn[id]?'done':''}" id="les-${id}"><summary><span class="ck"></span>${t}</summary><div class="lesson">${body}<div class="quiz"><p>${q}</p>${o.map((x,j)=>`<button data-act="quiz" data-v="${i}:${j}">${x}</button>`).join('')}<div class="why" hidden></div></div></div></details>`).join('');learnProg()}
function learnProg(){const n=L.filter(l=>A.learn[l[0]]).length;$('#lProg').textContent=n+' von '+L.length+' Lektionen abgeschlossen';$('#lBar').style.width=n/L.length*100+'%'}

/* ---------- Steuerung ---------- */
function setTab(t){tab=t;['markets','trade','portfolio','learn'].forEach(v=>$('#v-'+v).hidden=v!==t);
  $$('#nav button').forEach(b=>b.dataset.v===t?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  $('main').scrollTop=0;if(t==='trade'){liveTrade();requestAnimationFrame(draw)}if(t==='portfolio')buildPortfolio();if(t==='markets')liveMarkets()}
function pick(s){sel=s;off=0;cross=null;$('#selIns').value=s;save()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const v=b.dataset.v;
  switch(b.dataset.act){
   case'tab':setTab(v);break;
   case'filt':filt=v;buildMarkets();break;
   case'pick':pick(v);setTab('trade');break;
   case'tf':TF=+v;off=0;cross=null;buildTrade();draw();save();break;
   case'ind':ind[v]=!ind[v];buildTrade();draw();save();break;
   case'zoom':zoom=Math.max(20,Math.min(200,Math.round(zoom*+v)));draw();break;
   case'speed':speed=+v;buildTrade();break;
   case'live':off=0;cross=null;draw();break;
   case'ticket':openTicket(+v);break;
   case'closeTicket':$('#scrim').hidden=true;break;
   case'amtq':$('#tkAmt').value=inp(Math.max(0,Math.floor(acct().free*v/100)),0);ticketUI();break;
   case'lev':T.lev=+v;ticketUI();break;
   case'slq':case'tpq':{const t=ticketVals(),a=atr(sel),isSL=b.dataset.act==='slq',dir=isSL?-T.side:T.side;
     $(isSL?'#tkSL':'#tkTP').value=+v&&isFinite(t.entry)?inp(t.entry+dir*a*v,t.ins.d):'';ticketUI();break}
   case'submit':submit();break;
   case'close':{const p=A.pos.find(p=>p.id===+v);if(p){if(status(p.s)==='wait'){toast(NOPX);break}closePos(p,'manuell')}buildPortfolio();break}
   case'cancel':A.ord=A.ord.filter(o=>o.id!==+v);ver++;save();buildPortfolio();break;
   case'resetAsk':resetCap=+$('#cap').value;resetUI(true);break;
   case'resetNo':resetUI(false);break;
   case'resetYes':A.bal=A.start=resetCap;A.pos=[];A.ord=[];A.hist=[];ver++;save();buildPortfolio();toast('Neues Konto mit '+eur(resetCap)+' gestartet');break;
   case'fhSave':{const k=$('#fhKey').value.trim();if(!k){toast('Bitte zuerst den Schlüssel einfügen.');break}
     try{localStorage.setItem(KEY+'.fh',k)}catch(_){}FHKEY=k;fhErr='';fhTry=0;if(fhWs)try{fhWs.close()}catch(_){}fhWs=null;fhUp=false;fhStart();buildSrc();toast('Schlüssel gespeichert. Verbinde mit Finnhub …');break}
   case'fhDel':try{localStorage.removeItem(KEY+'.fh');localStorage.removeItem(KEY+'.lc')}catch(_){}
     for(const x of INS)if(!x.bn&&M[x.s].live){for(const p of A.pos.filter(p=>p.s===x.s))closePos(p,'Datenquelle entfernt');A.ord=A.ord.filter(o=>o.s!==x.s);delete A.last[x.s]}
     A.seen={};FHKEY='';INS.forEach(x=>{if(!x.bn)M[x.s].ready=false});save();location.reload();break;
   case'quiz':{const [i,j]=v.split(':').map(Number),l=L[i],box=b.parentElement,ok=j===l[5];b.classList.add(ok?'ok':'no');
     if(ok){const w=box.querySelector('.why');w.textContent=l[6];w.hidden=false;A.learn[l[0]]=1;$('#les-'+l[0]).classList.add('done');learnProg();save()}break}
  }});
$('#selIns').addEventListener('change',e=>{pick(e.target.value);liveTrade();draw()});
$('#tkSide').addEventListener('click',e=>{const b=e.target.closest('button');if(b){T.side=+b.dataset.v;$('#tkSL').value='';$('#tkTP').value='';ticketUI()}});
$('#tkType').addEventListener('click',e=>{const b=e.target.closest('button');if(b){T.type=b.dataset.v;if(T.type==='pending')$('#tkPrice').value=inp(M[sel].last,I[sel].d);ticketUI()}});
['tkAmt','tkSL','tkTP','tkPrice'].forEach(id=>$('#'+id).addEventListener('input',()=>{$('#tkErr').textContent='';ticketUI()}));
$('#scrim').addEventListener('click',e=>{if(e.target.id==='scrim')$('#scrim').hidden=true});
window.addEventListener('resize',()=>tab==='trade'&&draw());

function head(){$('#hEq').textContent=eur(acct().eq);let l=0,s=0,w=0;for(const x of INS){const st=status(x.s);st==='live'?l++:st==='sim'?s++:w++}
  $('#hStat').textContent=l+' live'+(s?' · '+s+' simuliert':'')+(w?' · '+w+' warten':'')}
buildMarkets();buildSrc();buildTrade();buildLearn();setTab('markets');head();
bnStart();fhStart();
let n=0;
setInterval(()=>{tick();checkOrders();n++;
  if(tab==='trade'){draw();if(n%2===0)liveTrade();if(!$('#scrim').hidden&&n%4===0&&T.type==='market')ticketUI()}
  if(n%2===0){head();if(tab==='portfolio')livePortfolio()}
  if(tab==='markets'&&n%4===0)liveMarkets();
  if(n%40===0)save();if(n%240===0)saveLC()},250);
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();saveLC()}else{bnStart();fhStart()}});
})();
