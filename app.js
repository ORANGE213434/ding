// Ding Chat client
{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS={
send:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
back:'<path d="m15 18-6-6 6-6"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
type:'<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',crop:'<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
rotl:'<path d="M2.5 2v6h6"/><path d="M2.66 15.57a10 10 0 1 0 .57-8.38"/>',rotr:'<path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>',
flip:'<path d="M12 3v18"/><path d="M8 7 3 12l5 5zM16 7l5 5-5 5z"/>',reply:'<path d="m9 17-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'};
const ic=(n,s=20)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;
$$('[data-ic]').forEach(e=>e.insertAdjacentHTML('afterbegin',ic(e.dataset.ic)));

const COLORS=['#2f5bff','#e5484d','#f76b15','#d6a100','#30a46c','#12a594','#0090ff','#8e4ec6','#d6409f','#5b5bd6','#3e3e4a','#ad7f58'];
const S={me:null,users:{},friends:[],incoming:[],outgoing:[],chats:{},active:null,msgs:[],more:false,tab:'chats',reply:null,editMsg:null,started:false,q:'',search:null,modal:null};
let socket=null,forceBottom=false;
const myId=()=>S.me&&S.me.id;
const uname=id=>S.users[id]?.name||'Someone';
const isFriend=id=>S.friends.includes(id);
const hashCol=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return COLORS[Math.abs(h)%COLORS.length]};
const okCol=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:'#2f5bff';
const imgUrl=id=>'/api/images/'+encodeURIComponent(id);
function av(id,cls=''){const u=S.users[id]||{};const ini=(u.name||'?').trim().slice(0,1).toUpperCase()||'?';
  return `<span class="av ${cls}" style="background:${okCol(u.color)}">${u.photo?`<img src="${esc(imgUrl(u.photo))}" alt="">`:esc(ini)}</span>`}
const vb=id=>S.users[id]&&S.users[id].verified?`<svg class="vb" width="16" height="16" viewBox="0 0 24 24" role="img" aria-label="Verified"><title>${S.users[id].owner?'Owner · verified':'Verified'}</title><path fill="${S.users[id].owner?'#ffcf33':'#2f8cff'}" d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3 1 3-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3L2.6 15.8l1-3-1-3 2.6-1.9 1-3 3.2.1z"/><path d="m8 12.3 2.7 2.7L16.2 9.4" fill="none" stroke="${S.users[id].owner?'#1a1400':'#fff'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`:'';
const RANK={user:0,mod:1,senior:2,owner:3};const myRank=()=>RANK[S.me&&S.me.role]||0;const rankOf=id=>RANK[S.users[id]&&S.users[id].role]||0;
const RNAME={owner:'Owner',senior:'Senior mod',mod:'Mod'};
const rtag=id=>{const r=S.users[id]&&S.users[id].role;return RNAME[r]?`<span class="rt rt-${r}">${RNAME[r]}</span>`:''};
const fmtUntil=b=>b.permanent?'permanently':'until '+new Date(b.until).toLocaleString([],{dateStyle:'medium',timeStyle:'short'});
const gav=(cid,c,cls='')=>`<span class="av grp ${cls}" style="background:${hashCol('g'+cid)}">${esc((c.name||'G').trim().slice(0,1).toUpperCase())}</span>`;
const other=c=>c.members.find(x=>x!==myId())||myId();
const chatName=c=>c.type==='group'?(c.name||'Group'):uname(other(c));
const imgSrc=img=>img&&img.id?imgUrl(img.id):'';
function fmtTime(t){const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString([],{day:'numeric',month:'short'})}
const fmtDay=t=>{const d=new Date(t),n=new Date(),y=new Date(Date.now()-864e5);return d.toDateString()===n.toDateString()?'Today':d.toDateString()===y.toDateString()?'Yesterday':d.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})};
let tT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(tT);tT=setTimeout(()=>t.classList.add('hidden'),3600)}

/* ---------- server calls ---------- */
async function api(method,url,body,file){
  const opt={method,headers:{},credentials:'same-origin'};
  if(file){opt.headers['Content-Type']=file.type||'image/jpeg';opt.body=file}
  else if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body)}
  let r;try{r=await fetch(url,opt)}catch{throw new Error('Can’t reach the server. Check your connection.')}
  let d={};try{d=await r.json()}catch{}
  if(r.status===401&&!/\/api\/(login|signup|me\/password)/.test(url)){showAuth();throw new Error(d.error||'Please log in.')}
  if(r.status===403&&d.banned){showBanned(d.banned);throw new Error('You are banned.')}
  if(!r.ok)throw new Error(d.error||'Something went wrong.');
  return d}
const act=p=>p.catch(e=>toast(e.message));

/* ---------- sound ---------- */
let AC=null,soundOn=true;try{soundOn=localStorage.getItem('ding-sound')!=='off'}catch{}
function unlockAudio(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();const p=AC.resume&&AC.resume();if(p&&p.then)p.then(updPill,()=>{})}catch{}updPill()}
function updPill(){$('#soundPill').classList.toggle('hidden',!soundOn||!!(AC&&AC.state==='running')||!S.started)}
addEventListener('pointerdown',unlockAudio);addEventListener('keydown',unlockAudio);
function ding(){if(!soundOn||!AC||AC.state!=='running')return;const t=AC.currentTime;
  [[1318.5,0,.32],[1975.5,.11,.22]].forEach(([f,d,v])=>{const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;
  g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(v,t+d+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d+.9);o.connect(g);g.connect(AC.destination);o.start(t+d);o.stop(t+d+.95)})}
$('#soundPill').addEventListener('click',()=>{unlockAudio();setTimeout(ding,60)});

/* ---------- boot / auth ---------- */
async function boot(){try{const d=await api('GET','/api/state');startApp(d)}catch(e){if($('#auth').classList.contains('hidden')&&$('#bannedScr').classList.contains('hidden'))$('#bootMsg').textContent=e.message+' Refresh to try again.'}}
function showBanned(b){S.started=false;if(socket){socket.disconnect();socket=null}closeModal();if(!$('#editor').classList.contains('hidden'))closeEditor();
  ['#boot','#app','#auth'].forEach(x=>$(x).classList.add('hidden'));$('#bannedScr').classList.remove('hidden');
  $('#banText').textContent=b.permanent?'Your account has been banned permanently.':`Your account is banned until ${new Date(b.until).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}.`;
  $('#banReason').textContent=b.reason?'Reason: '+b.reason:'';}
$('#banLogout').onclick=async()=>{try{await fetch('/api/logout',{method:'POST'})}catch{}$('#bannedScr').classList.add('hidden');showAuth();setAuthTab(true)};
function showAuth(){$('#bannedScr').classList.add('hidden');S.started=false;if(socket){socket.disconnect();socket=null}closeModal();
  $('#boot').classList.add('hidden');$('#app').classList.add('hidden');$('#auth').classList.remove('hidden');$('#suColors').innerHTML=swatchesHTML(suColor);suPrev()}
function setAuthTab(login){$('#tabLogin').setAttribute('aria-selected',login);$('#tabSignup').setAttribute('aria-selected',!login);
  $('#loginForm').classList.toggle('hidden',!login);$('#signupForm').classList.toggle('hidden',login);(login?$('#liLogin'):$('#suName')).focus()}
$('#tabLogin').onclick=()=>setAuthTab(true);$('#tabSignup').onclick=()=>setAuthTab(false);
$('#toSignup').onclick=e=>{e.preventDefault();setAuthTab(false)};
let suColor=COLORS[Math.floor(Math.random()*COLORS.length)],suPhotoBlob=null;
function swatchesHTML(sel){return COLORS.map(c=>`<button type="button" class="sw" style="background:${c}" data-c="${c}" aria-label="Colour ${c}" aria-pressed="${c===sel}"></button>`).join('')}
function suPrev(){const n=$('#suName').value||'?';$('#suPrev').innerHTML=`<span class="av lg" style="background:${suColor}">${suPhotoBlob?`<img src="${URL.createObjectURL(suPhotoBlob)}" alt="">`:esc(n.trim().slice(0,1).toUpperCase()||'?')}</span>`}
$('#suColors').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;suColor=b.dataset.c;$('#suColors').innerHTML=swatchesHTML(suColor);suPrev()});
$('#suName').addEventListener('input',suPrev);
$('#suPhoto').addEventListener('change',async e=>{const f=e.target.files[0];if(f){try{suPhotoBlob=await squareThumb(f)}catch{toast('Couldn’t read that photo.')}suPrev()}});
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('#liBtn');$('#liErr').textContent='';b.disabled=true;b.textContent='Logging in…';
  try{await api('POST','/api/login',{login:$('#liLogin').value,password:$('#liPass').value});$('#liPass').value='';await boot()}
  catch(x){$('#liErr').textContent=x.message}finally{b.disabled=false;b.textContent='Log in'}});
$('#signupForm').addEventListener('submit',async e=>{e.preventDefault();const err=$('#suErr'),b=$('#suBtn');err.textContent='';
  const body={name:$('#suName').value.trim(),username:$('#suUser').value.trim().toLowerCase(),email:$('#suEmail').value.trim(),password:$('#suPass').value,color:suColor};
  if(!body.name)return err.textContent='Add a display name.';
  if(!/^[a-z0-9_]{3,20}$/.test(body.username))return err.textContent='Usernames are 3–20 letters, numbers or underscores.';
  if(body.password.length<8)return err.textContent='Passwords need at least 8 characters.';
  b.disabled=true;b.textContent='Creating…';
  try{await api('POST','/api/signup',body);
    if(suPhotoBlob){try{const im=await api('POST','/api/images',undefined,suPhotoBlob);await api('PATCH','/api/me',{photo:im.id})}catch{}}
    $('#suPass').value='';await boot()}
  catch(x){err.textContent=x.message}finally{b.disabled=false;b.textContent='Create account'}});

/* ---------- app state ---------- */
function startApp(d){S.started=true;$('#boot').classList.add('hidden');$('#bannedScr').classList.add('hidden');$('#auth').classList.add('hidden');$('#app').classList.remove('hidden');applyState(d);connectSocket();updPill()}
let stBusy=false,stAgain=false,stT=null;
async function loadState(){if(stBusy){stAgain=true;return}stBusy=true;try{applyState(await api('GET','/api/state'))}catch{}finally{stBusy=false;if(stAgain){stAgain=false;loadState()}}}
const refresh=()=>{clearTimeout(stT);stT=setTimeout(loadState,120)};
function applyState(d){if(!S.started)return;S.me=d.me;Object.assign(S.users,d.users);S.friends=d.friends;S.incoming=d.incoming;S.outgoing=d.outgoing;
  const old=S.chats;S.chats={};d.chats.forEach(c=>{if(old[c.id])c.lastRead=Math.max(c.lastRead,old[c.id].lastRead||0);S.chats[c.id]=c});
  if(S.active&&!S.chats[S.active])closeChat();
  S.openReports=d.openReports||0;renderMe();renderSide();if(S.active){renderHead();renderMsgs();markRead(S.active)}if(S.modal==='group')groupModal();updTitle();
  if(d.warnings&&d.warnings.length&&S.modal!=='warn')showWarnings(d.warnings)}
let wasConnected=false;
function connectSocket(){if(socket)socket.disconnect();wasConnected=false;socket=io();
  socket.on('connect',()=>{$('#offline').classList.add('hidden');if(wasConnected){loadState();if(S.active)loadMsgs(S.active)}wasConnected=true});
  socket.on('disconnect',()=>{if(S.started)$('#offline').classList.remove('hidden')});
  socket.on('connect_error',e=>{if(e&&e.message==='banned'){boot();return}if(e&&e.message==='unauthorized')showAuth();else $('#offline').classList.remove('hidden')});
  socket.on('state',refresh);
  socket.on('friendRequest',async({from})=>{ding();await loadState();toast(`${uname(from)} sent you a friend request`)});
  socket.on('kicked',({chatId,name})=>{toast(`You were removed from “${name||'a group'}”`);if(S.active===chatId)closeChat();refresh()});
  socket.on('verified',()=>{ding();toast('You got a verified badge!')});
  socket.on('warned',w=>{ding();showWarnings([w])});
  socket.on('banned',b=>showBanned(b));
  socket.on('role',({role})=>{toast(role==='user'?'You are no longer a moderator.':`You are now a ${RNAME[role]}!`);loadState()});
  socket.on('reports',()=>{loadState();if(S.modal==='mod')modPanel(modTab)});
  socket.on('msg',onMsg)}
function onMsg({chatId,msg,isNew}){const c=S.chats[chatId],mine=msg.from===myId();
  if(isNew&&!mine)ding();
  if(!c){refresh();return}
  if(isNew){c.lastAt=msg.at;c.lastFrom=msg.from;c.lastText=msg.sys?msg.text:(msg.img?(msg.text?'Photo · '+msg.text:'Photo'):msg.text);if(mine)c.lastRead=msg.at}
  if(S.active===chatId){const i=S.msgs.findIndex(m=>m.id===msg.id);if(i>=0)S.msgs[i]=msg;else if(isNew)S.msgs.push(msg);
    if(!isNew)S.msgs.forEach(m=>{if(m.replyTo&&m.replyTo.id===msg.id)m.replyTo={...m.replyTo,text:msg.deleted?'Message deleted':(msg.text||'').slice(0,140),img:!!msg.img}});
    if(isNew&&mine)forceBottom=true;renderMsgs();markRead(chatId)}
  if(msg.sys)refresh();
  renderSide();updTitle()}
let readT;function markRead(cid){const c=S.chats[cid];if(!c||document.hidden||c.lastRead>=c.lastAt)return;c.lastRead=c.lastAt;clearTimeout(readT);
  readT=setTimeout(()=>api('POST',`/api/chats/${cid}/read`,{at:c.lastAt}).catch(()=>{}),600);renderSide();updTitle()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.active)markRead(S.active)});
const unread=c=>c&&c.lastFrom&&c.lastFrom!==myId()&&c.lastAt>c.lastRead;
function updTitle(){const n=Object.values(S.chats).filter(unread).length;document.title=n?`(${n}) Ding Chat`:'Ding Chat';const b=$('#chatBadge');b.textContent=n;b.classList.toggle('hidden',!n)}

/* ---------- sidebar ---------- */
function renderMe(){$('#modBtn').classList.toggle('hidden',myRank()<1);const mb=$('#modBadge');mb.textContent=S.openReports;mb.classList.toggle('hidden',!(myRank()>=1&&S.openReports));
  $('#meAv').innerHTML=av(myId());$('#meName').innerHTML=esc(S.me.name)+vb(myId())+rtag(myId());$('#meUser').textContent='@'+S.me.username;
  const n=S.incoming.length,b=$('#reqBadge');b.textContent=n;b.classList.toggle('hidden',!n)}
function setTab(t){S.tab=t;$$('.tabs button').forEach(x=>x.setAttribute('aria-selected',x.dataset.tab===t));$('#sideSearch').placeholder=t==='chats'?'Search chats':'Find people by username';$('#sideSearch').value='';S.q='';S.search=null;renderSide()}
$$('.tabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
let srT;$('#sideSearch').addEventListener('input',e=>{S.q=e.target.value.trim().toLowerCase();
  if(S.tab==='friends'){clearTimeout(srT);if(!S.q){S.search=null;renderSide();return}srT=setTimeout(async()=>{const q=S.q;try{const d=await api('GET','/api/users/search?q='+encodeURIComponent(q));if(q!==S.q)return;d.users.forEach(u=>S.users[u.id]=u);S.search=d.users.map(u=>u.id);renderSide()}catch(x){toast(x.message)}},250)}
  else renderSide()});
function renderSide(){if(!S.started)return;$('#sideBody').innerHTML=S.tab==='chats'?chatsHTML():friendsHTML()}
function chatsHTML(){const list=Object.values(S.chats).filter(c=>(c.type==='group'||c.lastAt||S.active===c.id)&&(!S.q||chatName(c).toLowerCase().includes(S.q))).sort((a,b)=>b.lastAt-a.lastAt);
  if(!list.length)return `<p class="emptyS">${S.q?'No chats match that.':'No chats yet. Open the Friends tab to add people, then message them or make a group.'}</p>`;
  return list.map(c=>{const u=unread(c);const pre=c.lastFrom===myId()?'You: ':(c.type==='group'&&c.lastFrom&&c.lastText&&!/^(.*) (created|renamed|added|removed|left)/.test(c.lastText)?uname(c.lastFrom).split(' ')[0]+': ':'');
    return `<button class="item ${S.active===c.id?'on':''} ${u?'unread':''}" data-open="${c.id}">${c.type==='group'?gav(c.id,c):av(other(c))}<span class="t"><b>${esc(chatName(c))}${c.type==='dm'?vb(other(c)):''}</b><span>${esc(pre+(c.lastText||'Say hi'))}</span></span><span class="r">${c.lastAt?esc(fmtTime(c.lastAt)):''}${u?'<span class="dot" aria-label="Unread"></span>':''}</span></button>`}).join('')}
function frow(id,btns,sub){const u=S.users[id]||{};return `<div class="frow">${av(id)}<button class="t plain" data-prof="${id}" aria-label="View ${esc(u.name)}'s profile"><b>${esc(u.name)}${vb(id)}${rtag(id)}</b><span>@${esc(u.username)}${sub?' · '+esc(sub):''}</span></button><span class="facts">${btns}</span></div>`}
function friendsHTML(){let h='';
  if(S.q){h+=`<div class="sec">Search results</div>`;if(!S.search)return h+'<p class="emptyS">Searching…</p>';
    return h+(S.search.length?S.search.map(id=>{let b;if(isFriend(id))b=`<button class="pbtn alt" data-dm="${id}">Message</button>`;else if(S.incoming.includes(id))b=`<button class="pbtn" data-accept="${id}">Accept</button>`;else if(S.outgoing.includes(id))b=`<button class="pbtn alt" disabled>Requested</button>`;else b=`<button class="pbtn" data-add="${id}">Add friend</button>`;return frow(id,b)}).join(''):`<p class="emptyS">Nobody with that name yet. Ask your friend to sign up first.</p>`)}
  if(S.incoming.length)h+=`<div class="sec">Friend requests <span>${S.incoming.length}</span></div>`+S.incoming.map(id=>frow(id,`<button class="pbtn" data-accept="${id}">Accept</button><button class="pbtn alt" data-decline="${id}">Decline</button>`)).join('');
  h+=`<div class="sec">Friends <span>${S.friends.length}</span></div>`;
  h+=S.friends.length?S.friends.map(id=>frow(id,`<button class="pbtn alt" data-dm="${id}">Message</button>`)).join(''):`<p class="emptyS">No friends yet. Search a username above to send a request. You can chat once they accept.</p>`;
  if(S.outgoing.length)h+=`<div class="sec">Sent requests</div>`+S.outgoing.map(id=>frow(id,`<button class="pbtn alt" data-cancel="${id}">Cancel</button>`,'waiting')).join('');
  return h}
$('#sideBody').addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  try{
    if(d.prof)profileModal(+d.prof);
    else if(d.open)openChat(+d.open);
    else if(d.add){t.disabled=true;const r=await api('POST','/api/friends/request',{userId:+d.add});toast(r.status==='friends'?`You and ${uname(+d.add)} are now friends`:`Friend request sent to ${uname(+d.add)}`);await loadState()}
    else if(d.accept){t.disabled=true;await api('POST','/api/friends/accept',{userId:+d.accept});toast(`You and ${uname(+d.accept)} are now friends`);await loadState()}
    else if(d.decline){t.disabled=true;await api('POST','/api/friends/decline',{userId:+d.decline});await loadState()}
    else if(d.cancel){t.disabled=true;await api('POST','/api/friends/cancel',{userId:+d.cancel});await loadState()}
    else if(d.dm)openDM(+d.dm)
  }catch(x){toast(x.message);t.disabled=false}});

/* ---------- chats ---------- */
async function openDM(fid){try{const d=await api('POST','/api/dm',{userId:fid});await loadState();setTab('chats');openChat(d.id)}catch(x){toast(x.message)}}
function openChat(cid){if(!S.chats[cid])return;S.active=cid;S.msgs=[];S.more=false;S.reply=null;S.editMsg=null;
  document.body.classList.add('in-chat');$('#welcome').classList.add('hidden');$('#chat').classList.remove('hidden');
  $('#msgs').innerHTML='<p class="sys">Loading messages…</p>';renderHead();renderReply();renderSide();loadMsgs(cid);markRead(cid);
  if(matchMedia('(min-width:761px)').matches)$('#msgIn').focus()}
async function loadMsgs(cid){try{const d=await api('GET',`/api/chats/${cid}/messages`);if(S.active!==cid)return;S.msgs=d.messages;S.more=d.more;forceBottom=true;renderMsgs()}
  catch(x){if(S.active===cid)$('#msgs').innerHTML=`<p class="sys">${esc(x.message)}</p>`}}
async function loadOlder(){const cid=S.active;if(!S.msgs.length)return;const el=$('#msgs'),h0=el.scrollHeight,t0=el.scrollTop;
  try{const d=await api('GET',`/api/chats/${cid}/messages?before=${S.msgs[0].id}`);if(S.active!==cid)return;S.msgs=[...d.messages,...S.msgs];S.more=d.more;renderMsgs();el.scrollTop=t0+el.scrollHeight-h0}catch(x){toast(x.message)}}
function closeChat(){S.active=null;document.body.classList.remove('in-chat');$('#chat').classList.add('hidden');$('#welcome').classList.remove('hidden');if(S.modal==='group')closeModal();renderSide()}
$('#backBtn').addEventListener('click',closeChat);
function canSend(c){return c&&c.members.includes(myId())&&(c.type==='group'||isFriend(other(c)))}
function renderHead(){const c=S.chats[S.active];if(!c)return;
  if(c.type==='group'){$('#chAv').innerHTML=gav(c.id,c);$('#chName').textContent=c.name||'Group';$('#chSub').textContent=c.members.length+' members · leader '+uname(c.leader)}
  else{const o=other(c);$('#chAv').innerHTML=av(o);$('#chName').innerHTML=esc(uname(o))+vb(o);$('#chSub').textContent='@'+(S.users[o]?.username||'')}
  const ok=canSend(c);$('#composer').classList.toggle('hidden',!ok);$('#locked').classList.toggle('hidden',ok);
  if(!ok)$('#locked').textContent=c.type==='group'?'You are not in this group.':`You and ${uname(other(c))} aren't friends right now. Send a friend request to chat again.`}
function renderMsgs(){const el=$('#msgs'),c=S.chats[S.active];if(!c)return;const near=el.scrollHeight-el.scrollTop-el.clientHeight<120;
  if(!S.msgs.length){el.innerHTML=`<p class="sys">${c.type==='group'?'This group is quiet. Say hello!':'No messages yet. Say hi to '+esc(uname(other(c)))+'!'}</p>`;return}
  let h=S.more?'<button class="older" data-older>Load earlier messages</button>':'',prev=null,lastDay='';
  for(const m of S.msgs){const day=fmtDay(m.at);if(day!==lastDay){h+=`<div class="day">${esc(day)}</div>`;lastDay=day;prev=null}h+=msgHTML(m,prev,c);prev=m}
  el.innerHTML=h;if(near||forceBottom){el.scrollTop=el.scrollHeight;forceBottom=false}}
function msgHTML(m,prev,c){if(m.sys)return `<div class="sys">${esc(m.text)}</div>`;
  const mine=m.from===myId(),cont=prev&&!prev.sys&&prev.from===m.from&&m.at-prev.at<300000;const src=m.deleted?'':imgSrc(m.img);
  let h=`<div class="row ${mine?'mine':''} ${cont?'cont':''}" data-id="${m.id}">`+(mine?'':(cont?'<span class="avsp"></span>':av(m.from,'sm')))+'<div class="col">';
  if(c.type==='group'&&!mine&&!cont)h+=`<div class="who">${esc(uname(m.from))}${vb(m.from)}${rtag(m.from)}</div>`;
  h+='<div class="bub">';
  if(m.deleted)h+='<em class="del">Message deleted</em>';
  else{if(m.replyTo)h+=`<button class="quote" data-jump="${m.replyTo.id}"><b>${esc(uname(m.replyTo.from))}</b><span>${m.replyTo.img?'Photo ':''}${esc(m.replyTo.text||'')}</span></button>`;
    if(src){const w=+m.img.w||320,hh=+m.img.h||240;h+=`<img class="pic" src="${esc(src)}" width="${w}" height="${hh}" style="aspect-ratio:${w}/${hh}" data-view="${m.id}" alt="Photo from ${esc(uname(m.from))}" loading="lazy">`}
    if(m.text)h+=`<div class="txt">${esc(m.text)}</div>`}
  h+=`<span class="meta">${m.edited&&!m.deleted?'edited · ':''}${esc(fmtTime(m.at))}</span></div>`;
  if(!m.deleted&&canSend(c)){h+=`<div class="acts"><button data-act="reply">${ic('reply',14)}Reply</button>`;
    if(src)h+=`<button data-act="editimg">${ic('pen',14)}${mine?'Edit photo':'Edit &amp; send'}</button>`;
    if(mine&&m.text)h+=`<button data-act="edit">${ic('edit',14)}Edit</button>`;
    if(mine)h+=`<button data-act="del">${ic('trash',14)}Delete</button>`;else h+=`<button data-act="report">${ic('flag',14)}Report</button>`;h+='</div>'}
  return h+'</div></div>'}
const findMsg=id=>S.msgs.find(m=>m.id===id);
$('#msgs').addEventListener('click',e=>{if(e.target.closest('[data-older]'))return loadOlder();
  const row=e.target.closest('.row'),a=e.target.closest('[data-act]'),j=e.target.closest('[data-jump]'),v=e.target.closest('[data-view]');
  if(j){const t=$(`.row[data-id="${+j.dataset.jump}"]`);if(t){t.scrollIntoView({block:'center',behavior:'smooth'});t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),1400)}else toast('That message is further back. Tap “Load earlier messages”.');return}
  if(v){const m=findMsg(+v.dataset.view);if(m)lightbox(m);return}
  if(a&&row){const m=findMsg(+row.dataset.id);if(!m)return;const k=a.dataset.act;
    if(k==='reply')setReply(m);
    else if(k==='edit'){S.editMsg=m.id;S.reply=null;$('#msgIn').value=m.text||'';grow();renderReply();$('#msgIn').focus()}
    else if(k==='del')confirmBox('Delete this message?','It will show as “Message deleted” for everyone.','Delete',()=>act(api('DELETE','/api/messages/'+m.id)));
    else if(k==='editimg')editImageOf(m);
    else if(k==='report')reportModal(m.from,m);return}
  if(row&&!e.target.closest('a,button')){$$('.row.show').forEach(r=>r!==row&&r.classList.remove('show'));row.classList.toggle('show')}});
function setReply(m){S.reply={id:m.id,from:m.from,text:(m.text||'').slice(0,140),img:!!imgSrc(m.img)};S.editMsg=null;renderReply();$('#msgIn').focus()}
function renderReply(){const b=$('#replyBar');
  if(S.editMsg)b.innerHTML=`<div class="t"><b>Editing message</b><span>Change the text and press send</span></div><button class="ib" data-x aria-label="Cancel edit">${ic('x')}</button>`;
  else if(S.reply)b.innerHTML=`<div class="t"><b>Replying to ${esc(uname(S.reply.from))}</b><span>${S.reply.img?'Photo ':''}${esc(S.reply.text)}</span></div><button class="ib" data-x aria-label="Cancel reply">${ic('x')}</button>`;
  b.classList.toggle('hidden',!S.editMsg&&!S.reply)}
function cancelReply(){if(S.editMsg)$('#msgIn').value='';S.reply=null;S.editMsg=null;renderReply();grow()}
$('#replyBar').addEventListener('click',e=>{if(e.target.closest('[data-x]'))cancelReply()});
const grow=()=>{const t=$('#msgIn');t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'};
$('#msgIn').addEventListener('input',grow);
$('#msgIn').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#composer').requestSubmit()}else if(e.key==='Escape'&&(S.reply||S.editMsg))cancelReply()});
$('#composer').addEventListener('submit',e=>{e.preventDefault();const t=$('#msgIn'),text=t.value.trim();
  if(S.editMsg){const id=S.editMsg;S.editMsg=null;renderReply();t.value='';grow();if(text)act(api('PATCH','/api/messages/'+id,{text}));return}
  if(!text)return;t.value='';grow();send({text})});
async function send({text='',img=null,replyTo}){const cid=S.active,c=S.chats[cid];if(!canSend(c))return toast('You can’t send messages in this chat.');
  const rp=replyTo!==undefined?replyTo:(S.reply&&S.reply.id);S.reply=null;renderReply();forceBottom=true;
  try{await api('POST',`/api/chats/${cid}/messages`,{text,replyTo:rp||null,imageId:img&&img.id,w:img&&img.w,h:img&&img.h});if(!socket||!socket.connected)loadMsgs(cid)}
  catch(x){toast(x.message);if(text&&!$('#msgIn').value){$('#msgIn').value=text;grow()}}}

/* images in chat */
$('#attachBtn').addEventListener('click',()=>$('#fileIn').click());
$('#fileIn').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)composeImage(f)});
$('#msgIn').addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])].find(x=>x.type.startsWith('image/'));if(f){e.preventDefault();composeImage(f)}});
const chatEl=$('#chat');
chatEl.addEventListener('dragover',e=>{if(canSend(S.chats[S.active])){e.preventDefault();chatEl.classList.add('drop')}});
chatEl.addEventListener('dragleave',e=>{if(!chatEl.contains(e.relatedTarget))chatEl.classList.remove('drop')});
chatEl.addEventListener('drop',e=>{e.preventDefault();chatEl.classList.remove('drop');const f=[...e.dataTransfer.files].find(x=>x.type.startsWith('image/'));if(f)composeImage(f)});
async function storeImage(b,w,h){const d=await api('POST','/api/images',undefined,b);return{id:d.id,w,h}}
function composeImage(f){if(!f.type.startsWith('image/'))return toast('Pick an image file.');const url=URL.createObjectURL(f);
  openEditor(url,'Send',async(b,w,h)=>{const img=await storeImage(b,w,h);const cap=$('#msgIn').value.trim();$('#msgIn').value='';grow();await send({text:cap,img});URL.revokeObjectURL(url)})}
function editImageOf(m){const src=imgSrc(m.img);if(!src)return;
  if(m.from===myId())openEditor(src,'Save',async(b,w,h)=>{const img=await storeImage(b,w,h);await api('PATCH','/api/messages/'+m.id,{imageId:img.id,w,h})});
  else openEditor(src,'Send',async(b,w,h)=>{const img=await storeImage(b,w,h);await send({img,replyTo:m.id})})}
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
async function squareThumb(f){const u=URL.createObjectURL(f);try{const i=await loadImg(u);const s=Math.min(i.naturalWidth,i.naturalHeight),c=document.createElement('canvas');c.width=c.height=256;
  c.getContext('2d').drawImage(i,(i.naturalWidth-s)/2,(i.naturalHeight-s)/2,s,s,0,0,256,256);return await new Promise(r=>c.toBlob(r,'image/jpeg',.85))}finally{URL.revokeObjectURL(u)}}

/* ---------- modals ---------- */
function openModal(kind,html){S.modal=kind;$('#sheet').classList.toggle('wide',kind==='mod'||kind==='modchat');$('#sheet').innerHTML=html;$('#modal').classList.remove('hidden');const f=$('#sheet input:not([type=file]):not([type=checkbox]),#sheet button');if(f)f.focus()}
function closeModal(){S.modal=null;$('#modal').classList.add('hidden');$('#sheet').innerHTML=''}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal'||e.target.closest('[data-close]'))closeModal()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#editor').classList.contains('hidden')&&S.modal)closeModal()});
function confirmBox(title,body,ok,fn){openModal('confirm',`<h2>${esc(title)}</h2><p class="note">${esc(body)}</p><div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="cfOk">${esc(ok)}</button></div>`);
  $('#cfOk').onclick=()=>{closeModal();fn()}}
function lightbox(m){const src=imgSrc(m.img),c=S.chats[S.active];openModal('lb',`<div class="lightbox"><img src="${esc(src)}" alt="Photo"></div>${m.text?`<p>${esc(m.text)}</p>`:''}<p class="note">From ${esc(uname(m.from))} · ${esc(fmtTime(m.at))}</p><div class="foot"><button class="btn ghost" data-close>Close</button>${canSend(c)?`<button class="btn ghost" id="lbReply">Reply</button><button class="btn" id="lbEdit">${m.from===myId()?'Edit photo':'Edit &amp; send'}</button>`:''}</div>`);
  const r=$('#lbReply'),ed=$('#lbEdit');if(r)r.onclick=()=>{closeModal();setReply(m)};if(ed)ed.onclick=()=>{closeModal();editImageOf(m)}}
$('#infoBtn').addEventListener('click',()=>{const c=S.chats[S.active];if(!c)return;if(c.type==='group')groupModal();else profileModal(other(c))});
function profileModal(id){const u=S.users[id]||{},me=id===myId(),own=S.me.owner&&!me;
  const role=(rtag(id)||'')+(u.verified&&!u.owner?'<span class="tag vt">Verified</span>':'');
  openModal('profile',`<div style="text-align:center">${av(id,'lg')}<h2 style="margin-top:12px">${esc(u.name)}${vb(id)}</h2><p class="note">@${esc(u.username)} ${role}</p></div>
  ${own?`<div class="pwBox"><p class="note" style="margin-top:4px">${u.verified?'This account has a verified badge.':'Give this account a verified badge so people know it’s really them.'}</p><button class="btn ${u.verified?'ghost':''}" id="vfy" style="width:100%">${u.verified?'Remove verified badge':'Give verified badge'}</button></div>`:''}
  ${!me&&myRank()>=1?'<div class="pwBox modSec" id="modSec"><p class="note">Loading moderator tools…</p></div>':''}
  <div class="foot">${me?'':'<button class="btn ghost" id="repU" style="margin-right:auto">'+ic('flag',16)+'Report</button>'}<button class="btn ghost" data-close>Close</button>${me?'':isFriend(id)?`<button class="btn danger" id="unf">Unfriend</button>`:S.outgoing.includes(id)?`<button class="btn ghost" disabled>Request sent</button>`:S.incoming.includes(id)?`<button class="btn" id="acc">Accept request</button>`:`<button class="btn" id="refr">Send friend request</button>`}</div>`);
  const b=$('#unf');if(b)b.onclick=()=>{closeModal();confirmBox(`Unfriend ${u.name}?`,'You won’t be able to message each other until one of you sends a new request and it is accepted.','Unfriend',()=>act(api('DELETE','/api/friends/'+id).then(loadState)))};
  const r=$('#refr');if(r)r.onclick=()=>{closeModal();act(api('POST','/api/friends/request',{userId:id}).then(()=>{toast('Friend request sent');return loadState()}))};
  const a=$('#acc');if(a)a.onclick=()=>{closeModal();act(api('POST','/api/friends/accept',{userId:id}).then(()=>{toast(`You and ${u.name} are now friends`);return loadState()}))};
  const ru=$('#repU');if(ru)ru.onclick=()=>reportModal(id);
  if(!me&&myRank()>=1)loadModSec(id);
  const v=$('#vfy');if(v)v.onclick=async()=>{v.disabled=true;try{const d=await api('POST','/api/admin/verify',{userId:id,verified:!u.verified});S.users[id]=d.user;toast(d.user.verified?`${u.name} is now verified`:`Removed ${u.name}'s verified badge`);profileModal(id);renderSide();if(S.active){renderHead();renderMsgs()}}catch(x){v.disabled=false;toast(x.message)}}}
$('#newGroupBtn').addEventListener('click',()=>{const fr=S.friends;
  openModal('newgroup',`<h2>New group</h2><label class="l" for="ngName">Group name</label><input class="f" id="ngName" maxlength="40" placeholder="Weekend crew">
  <label class="l">Add friends</label>${fr.length?fr.map(id=>`<label class="chk"><input type="checkbox" value="${id}">${av(id,'sm')}<span>${esc(uname(id))}</span></label>`).join(''):'<p class="note">Add some friends first, then you can put them in a group.</p>'}
  <p class="err" id="ngErr"></p><div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="ngOk" ${fr.length?'':'disabled'}>Create group</button></div>`);
  const ok=$('#ngOk');ok.onclick=async()=>{const name=$('#ngName').value.trim(),ids=$$('#sheet input[type=checkbox]:checked').map(x=>+x.value);
    if(!name)return $('#ngErr').textContent='Give the group a name.';if(!ids.length)return $('#ngErr').textContent='Pick at least one friend.';ok.disabled=true;
    try{const d=await api('POST','/api/groups',{name,memberIds:ids});await loadState();closeModal();setTab('chats');openChat(d.id)}catch(x){ok.disabled=false;$('#ngErr').textContent=x.message}}});
function groupModal(){const c=S.chats[S.active];if(!c||c.type!=='group'){if(S.modal==='group')closeModal();return}const lead=c.leader===myId();
  const keep=S.modal==='group'?$('#gName')?.value:null;const addable=lead?S.friends.filter(id=>!c.members.includes(id)):[];
  const html=`<div style="display:flex;gap:12px;align-items:center">${gav(c.id,c,'lg')}<div><h2>${esc(c.name)}</h2><p class="note" style="margin:0">${c.members.length} members</p></div></div>
  <label class="l" for="gName">Group name</label><div class="inline"><input class="f" id="gName" maxlength="40" value="${esc(keep??c.name)}"><button class="btn" id="gRen">Save</button></div>
  <label class="l">Members</label>${c.members.map(id=>`<div class="mrow" data-gprof="${id}" style="cursor:pointer">${av(id,'sm')}<span class="t"><b>${esc(uname(id))}${vb(id)}${rtag(id)}${id===myId()?' (you)':''}</b>${id===c.leader?'<span class="tag">Leader</span>':''}<span>@${esc(S.users[id]?.username||'')}</span></span>${lead&&id!==myId()?`<button class="btn danger sm" data-kick="${id}">Kick</button>`:''}</div>`).join('')}
  ${lead?`<label class="l">Add friends</label>${addable.length?addable.map(id=>`<div class="mrow">${av(id,'sm')}<span class="t"><b>${esc(uname(id))}</b></span><button class="btn ghost sm" data-addm="${id}">Add</button></div>`).join(''):'<p class="note">All your friends are already here.</p>'}`:'<p class="note">Only the group leader can add or kick members.</p>'}
  <div class="foot"><button class="btn danger" id="gLeave">Leave group</button><button class="btn ghost" data-close>Done</button></div>`;
  if(S.modal==='group'){const sc=$('#sheet').scrollTop;$('#sheet').innerHTML=html;$('#sheet').scrollTop=sc}else openModal('group',html);
  $('#gRen').onclick=async()=>{const n=$('#gName').value.trim();if(!n||n===c.name)return;try{await api('PATCH','/api/chats/'+c.id,{name:n});toast('Group renamed');await loadState()}catch(x){toast(x.message)}};
  $('#gName').onkeydown=e=>{if(e.key==='Enter')$('#gRen').click()};
  $$('[data-kick]',$('#sheet')).forEach(b=>b.onclick=()=>{const id=+b.dataset.kick;confirmBox(`Kick ${uname(id)}?`,`They will be removed from “${c.name}” and stop getting its messages.`,'Kick',
    ()=>act(api('DELETE',`/api/chats/${c.id}/members/${id}`).then(()=>{toast(`${uname(id)} was removed`);return loadState()})))});
  $$('[data-gprof]',$('#sheet')).forEach(r=>r.onclick=e=>{if(!e.target.closest('button'))profileModal(+r.dataset.gprof)});
  $$('[data-addm]',$('#sheet')).forEach(b=>b.onclick=()=>{b.disabled=true;act(api('POST',`/api/chats/${c.id}/members`,{userId:+b.dataset.addm}).then(loadState))});
  $('#gLeave').onclick=()=>confirmBox(`Leave “${c.name}”?`,lead&&c.members.length>1?'You are the leader, so leadership passes to the next member.':'You will stop getting messages from this group.','Leave',
    ()=>act(api('DELETE',`/api/chats/${c.id}/members/${myId()}`).then(()=>{closeChat();return loadState()})))}

/* ---------- reports ---------- */
const REASONS=['Spam','Harassment or bullying','Hate or threats','Inappropriate photo or content','Pretending to be someone else','Other'];
function reportModal(uid,m){const u=S.users[uid]||{};
  openModal('report',`<h2>Report ${esc(u.name||'user')}</h2><p class="note">Moderators will see this report and anything you attach. ${esc(u.name||'They')} won’t know who reported them.</p>
  <div class="rep"><label class="l" for="rpR">Reason</label><select id="rpR">${REASONS.map(r=>`<option>${r}</option>`).join('')}</select></div>
  <label class="l" for="rpD">Details (optional)</label><textarea class="f" id="rpD" rows="3" maxlength="1000" placeholder="What happened?"></textarea>
  <label class="l">Attach their messages or photos <span class="note" id="rpCount" style="font-weight:400">(optional, up to 10)</span></label>
  <div class="pickList" id="rpMsgs"><p class="note" style="padding:6px">Loading their messages…</p></div>
  <p class="err" id="rpErr"></p><div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="rpOk">Send report</button></div>`);
  const count=()=>{const n=$$('#rpMsgs input:checked').length;$('#rpCount').textContent=n?`(${n} attached, up to 10)`:'(optional, up to 10)'};
  api('GET','/api/reports/messages?userId='+uid).then(d=>{if(S.modal!=='report')return;let list=d.messages;
    if(m&&!list.some(x=>x.id===m.id))list=[{id:m.id,chatName:S.chats[S.active]?chatName(S.chats[S.active]):'',text:m.text,img:m.img,at:m.at},...list];
    $('#rpMsgs').innerHTML=list.length?list.map(x=>`<label class="pick"><input type="checkbox" value="${x.id}" ${m&&m.id===x.id?'checked':''}><span>${x.img?`<img src="${esc(imgUrl(x.img.id))}" alt="Photo">`:''}<span class="pt">${esc(x.text||(x.img?'':'(empty)'))}</span><span class="pm">${esc(x.chatName||'')} · ${esc(fmtTime(x.at))}</span></span></label>`).join('')
      :`<p class="note" style="padding:6px">Nothing to attach. You don’t share a chat with ${esc(u.name||'them')}, or they haven’t sent anything there yet.</p>`;
    count()}).catch(x=>{$('#rpMsgs').innerHTML=`<p class="err" style="padding:6px">${esc(x.message)}</p>`});
  $('#rpMsgs').addEventListener('change',e=>{if($$('#rpMsgs input:checked').length>10){e.target.checked=false;toast('You can attach up to 10.')}count()});
  $('#rpOk').onclick=async()=>{$('#rpOk').disabled=true;const ids=$$('#rpMsgs input:checked').map(x=>+x.value);
    try{const d=await api('POST','/api/reports',{userId:uid,reason:$('#rpR').value,details:$('#rpD').value,messageIds:ids});closeModal();toast(d.attached?`Report sent with ${d.attached} attached message${d.attached===1?'':'s'}. Thanks.`:'Thanks. Your report was sent to the moderators.')}
    catch(x){$('#rpOk').disabled=false;$('#rpErr').textContent=x.message}}}

/* ---------- warnings for me ---------- */
function showWarnings(ws){openModal('warn',`<h2>You’ve been warned</h2><p class="note">A moderator sent you ${ws.length>1?'these warnings':'this warning'}. Repeated problems can lead to a ban.</p>
  ${ws.map(w=>`<div class="warnBox"><b>${esc(w.reason)}</b><div class="note" style="margin:4px 0 0">${esc(new Date(w.at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}))}</div></div>`).join('')}
  <div class="foot"><button class="btn" id="wOk">I understand</button></div>`);
  $('#wOk').onclick=()=>{closeModal();api('POST','/api/me/warnings/seen').catch(()=>{})}}

/* ---------- moderator tools on a profile ---------- */
async function loadModSec(id){let d;try{d=await api('GET','/api/mod/users/'+id)}catch(x){const e=$('#modSec');if(e)e.innerHTML=`<p class="err">${esc(x.message)}</p>`;return}
  const el=$('#modSec');if(!el||S.modal!=='profile')return;S.users[id]={...S.users[id],...d.user};const u=d.user,mr=myRank(),tr=RANK[u.role]||0;
  let h=`<h3>Moderation</h3><p class="note" style="margin:0 0 6px">${d.ban?`<span class="pill">Banned</span> ${esc(fmtUntil(d.ban))}${d.bannedBy?' by '+esc(d.bannedBy):''}${d.ban.reason?' · '+esc(d.ban.reason):''}`:'Not banned'} · ${d.warnings.length} warning${d.warnings.length===1?'':'s'} · ${d.reports} report${d.reports===1?'':'s'}</p>`;
  if(d.warnings.length)h+=`<ul class="wlist">${d.warnings.slice(0,4).map(w=>`<li>${esc(w.reason)} <span>(${esc(w.by)}, ${esc(fmtTime(w.at))})</span></li>`).join('')}</ul>`;
  if(!d.canAct){h+=`<p class="note">They’re ranked the same as or above you, so you can’t warn, ban or change their role.</p>`;el.innerHTML=h;return}
  if(mr===3)h+=`<label class="l" for="mRole">Role</label><div class="inline"><select id="mRole"><option value="user">Regular user</option><option value="mod">Mod</option><option value="senior">Senior mod</option></select><button class="btn ghost" id="mRoleOk">Save role</button></div>`;
  else if(mr===2&&tr<=1)h+=`<label class="l">Role</label><button class="btn ghost" id="mMod" style="width:100%">${tr===1?'Remove mod':'Make mod'}</button>`;
  h+=`<label class="l" for="mWarn">Warn</label><div class="inline"><input class="f" id="mWarn" maxlength="500" placeholder="Reason they'll see"><button class="btn ghost" id="mWarnOk">Warn</button></div>
  <label class="l" for="mBanN">${d.ban?'Change ban':'Ban'}</label><div class="grid"><input class="f" id="mBanN" type="number" min="1" value="1" inputmode="numeric"><select id="mBanU"><option value="60">Hours</option><option value="1440" selected>Days</option><option value="10080">Weeks</option><option value="1">Minutes</option><option value="perm">Permanent</option></select></div>
  <input class="f" id="mBanR" maxlength="500" placeholder="Reason they'll see" style="margin-top:8px">
  <div class="inline" style="margin-top:8px"><button class="btn danger" id="mBanOk" style="flex:1">Ban</button>${d.ban?'<button class="btn ghost" id="mUnban" style="flex:1">Unban now</button>':''}</div>
  <p class="err" id="mErr"></p>`;
  el.innerHTML=h;const err=m=>$('#mErr').textContent=m;
  const rs=$('#mRole');if(rs){rs.value=u.role==='owner'?'user':u.role;$('#mRoleOk').onclick=()=>setRole(id,rs.value)}
  const mm=$('#mMod');if(mm)mm.onclick=()=>setRole(id,tr===1?'user':'mod');
  $('#mBanU').onchange=e=>{$('#mBanN').disabled=e.target.value==='perm'};
  $('#mWarnOk').onclick=async()=>{const r=$('#mWarn').value.trim();if(!r)return err('Write a reason for the warning.');try{await api('POST','/api/mod/warn',{userId:id,reason:r});toast(`Warned ${u.name}`);loadModSec(id)}catch(x){err(x.message)}};
  $('#mBanOk').onclick=()=>{const r=$('#mBanR').value.trim(),unit=$('#mBanU').value,n=+$('#mBanN').value;if(!r)return err('Write a reason for the ban.');
    if(unit!=='perm'&&!(n>=1))return err('Enter how long the ban lasts.');
    const len=unit==='perm'?'permanently':`for ${n} ${$('#mBanU').selectedOptions[0].textContent.toLowerCase().replace(/s$/,n===1?'':'s')}`;
    confirmBox(`Ban ${u.name} ${len}?`,`They’ll be logged out and can’t use Ding until the ban ends. Reason: ${r}`,'Ban',async()=>{
      try{await api('POST','/api/mod/ban',unit==='perm'?{userId:id,permanent:true,reason:r}:{userId:id,minutes:n*+unit,reason:r});toast(`${u.name} is banned ${len}`)}catch(x){toast(x.message)}})};
  const ub=$('#mUnban');if(ub)ub.onclick=async()=>{try{await api('POST','/api/mod/unban',{userId:id});toast(`${u.name} is unbanned`);loadModSec(id)}catch(x){err(x.message)}}}
async function setRole(id,role){try{const d=await api('POST','/api/mod/role',{userId:id,role});S.users[id]={...S.users[id],...d.user};toast(role==='user'?`${uname(id)} is now a regular user`:`${uname(id)} is now a ${RNAME[role]}`);profileModal(id)}catch(x){toast(x.message)}}

/* ---------- moderation panel ---------- */
let modTab='open',lastReports=[];
async function modChat(rid,cid,around,hl){const shell=`<button class="btn ghost sm" id="mcBack">${ic('back',16)}Back to reports</button><h2 id="mcName" style="margin-top:12px">Loading chat…</h2>
  <p class="note">Read-only view for moderators. Reported messages are highlighted; deleted messages are shown so you can review them.</p><div class="mcList" id="mcList"></div>`;
  openModal('modchat',shell);$('#mcBack').onclick=()=>modPanel(modTab);
  let d;try{d=await api('GET',`/api/mod/reports/${rid}/chat/${cid}?around=${around}`)}catch(x){$('#mcName').textContent='Can’t open this chat';$('#mcList').innerHTML=`<p class="err" style="padding:8px">${esc(x.message)}</p>`;return}
  if(S.modal!=='modchat')return;Object.values(d.users).forEach(u=>S.users[u.id]={...S.users[u.id],...u});$('#mcName').textContent=d.chat.name;
  const ms=d.messages;let h=d.moreBefore&&ms.length?`<div class="mcsys"><button class="older" data-mcgo="${ms[0].id-1}">Show earlier</button></div>`:'';
  h+=ms.map(m=>m.sys?`<div class="mcsys">${esc(m.text)} · ${esc(fmtTime(m.at))}</div>`:`<div class="mcm ${hl.has(m.id)?'hl':''} ${m.deleted?'del':''}" data-mcid="${m.id}">${av(m.from,'sm')}<div class="b"><div class="h"><b>${esc(uname(m.from))}</b>${rtag(m.from)} · ${esc(fmtTime(m.at))}${m.edited?' · edited':''}${m.deleted?' · <span class="dl">deleted by sender</span>':''}${hl.has(m.id)?' · <span class="dl" style="color:#9a6b00">reported</span>':''}</div>${m.text?`<div class="tx">${esc(m.text)}</div>`:''}${m.img?`<img src="${esc(imgUrl(m.img))}" alt="Photo" loading="lazy">`:''}</div></div>`).join('');
  if(d.moreAfter&&ms.length)h+=`<div class="mcsys"><button class="older" data-mcgo="${ms[ms.length-1].id}">Show later</button></div>`;
  if(!ms.length)h='<p class="note" style="padding:8px">This chat has no messages.</p>';
  const L=$('#mcList');L.innerHTML=h;$$('[data-mcgo]',L).forEach(b=>b.onclick=()=>modChat(rid,cid,+b.dataset.mcgo,hl));
  const t=L.querySelector(`[data-mcid="${around}"]`)||L.querySelector('.mcm.hl');if(t)L.scrollTop=t.offsetTop-L.clientHeight/2+t.clientHeight/2}
$('#modBtn').addEventListener('click',()=>modPanel('open'));
async function modPanel(tab){modTab=tab;const head=`<h2>Moderation</h2><div class="mtabs" role="tablist">${[['open','Open reports'],['closed','Handled'],['bans','Bans']].map(([k,l])=>`<button role="tab" data-mt="${k}" aria-selected="${k===tab}">${l}${k==='open'&&S.openReports?' ('+S.openReports+')':''}</button>`).join('')}</div><div id="mBody"><p class="note">Loading…</p></div><div class="foot"><button class="btn ghost" data-close>Close</button></div>`;
  if(S.modal==='mod'){const sc=$('#sheet').scrollTop;$('#sheet').innerHTML=head;$('#sheet').scrollTop=sc}else openModal('mod',head);
  $$('[data-mt]',$('#sheet')).forEach(b=>b.onclick=()=>modPanel(b.dataset.mt));
  try{let h='';
    if(tab==='bans'){const d=await api('GET','/api/mod/bans');d.bans.forEach(b=>S.users[b.user.id]={...S.users[b.user.id],...b.user});
      h=d.bans.length?d.bans.map(b=>`<div class="rcard"><div class="top">${av(b.user.id,'sm')}<b>${esc(b.user.name)}${rtag(b.user.id)}</b><span class="pill">Banned</span></div>
        <div class="meta2">@${esc(b.user.username)} · ${esc(fmtUntil(b.ban))} · by ${esc(b.by)}</div>${b.ban.reason?`<div class="qt">${esc(b.ban.reason)}</div>`:''}
        <div class="row2"><button class="btn ghost sm" data-mprof="${b.user.id}">Open profile</button>${b.canAct?`<button class="btn sm" data-unban="${b.user.id}">Unban</button>`:''}</div></div>`).join(''):'<p class="note">Nobody is banned right now.</p>'}
    else{const d=await api('GET','/api/mod/reports'+(tab==='closed'?'?status=closed':''));lastReports=d.reports;Object.values(d.users).forEach(u=>S.users[u.id]={...S.users[u.id],...u});
      h=d.reports.length?d.reports.map(r=>`<div class="rcard"><div class="top">${av(r.target,'sm')}<b>${esc(uname(r.target))}${rtag(r.target)}</b>${r.targetBanned?'<span class="pill">Banned</span>':''}</div>
        <div class="meta2"><b>${esc(r.reason)}</b> · reported by ${esc(uname(r.reporter))} · ${esc(fmtTime(r.at))}${r.status!=='open'?` · ${esc(r.status)} by ${esc(r.handledBy||'a mod')}`:''}</div>
        ${r.items.length?`<div class="meta2" style="margin-bottom:0">${r.items.length} attached message${r.items.length===1?'':'s'}</div>`+r.items.map(i=>`<div class="ev">${i.img?`<img src="${esc(imgUrl(i.img))}" alt="Reported photo" data-zoom="${esc(i.img)}">`:''}${i.text?`<div class="t2">${esc(i.text)}</div>`:''}<div class="m2"><span>${esc(i.chatName)} · ${esc(fmtTime(i.at))}</span>${i.chatGone?'':`<button class="btn ghost sm" data-vchat="${r.id}:${i.chatId}:${i.messageId}">View chat</button>`}</div></div>`).join(''):''}
        ${!r.items.length&&(r.messageText||r.messageImg)?`<div class="ev">${r.messageImg?`<img src="${esc(imgUrl(r.messageImg))}" alt="Reported photo" data-zoom="${esc(r.messageImg)}">`:''}<div class="t2">${esc(r.messageText||'')}</div></div>`:''}
        ${r.details?`<div class="meta2" style="color:var(--ink)">“${esc(r.details)}”</div>`:''}
        <div class="row2"><button class="btn ghost sm" data-mprof="${r.target}">Open profile</button>${r.status==='open'?`<button class="btn sm" data-res="${r.id}">Mark handled</button><button class="btn ghost sm" data-dis="${r.id}">Dismiss</button>`:''}</div></div>`).join('')
        :`<p class="note">${tab==='open'?'No open reports. Nice and quiet.':'No handled reports yet.'}</p>`}
    if(S.modal!=='mod'||modTab!==tab)return;$('#mBody').innerHTML=h;
    $$('[data-mprof]',$('#sheet')).forEach(b=>b.onclick=()=>profileModal(+b.dataset.mprof));
    $$('[data-vchat]',$('#sheet')).forEach(b=>b.onclick=()=>{const [rid,cid,mid]=b.dataset.vchat.split(':').map(Number);const r=lastReports.find(x=>x.id===rid);
      modChat(rid,cid,mid,new Set((r?r.items:[]).filter(i=>i.chatId===cid).map(i=>i.messageId)))});
    $$('[data-zoom]',$('#sheet')).forEach(im=>im.onclick=()=>window.open(im.src,'_blank'));
    $$('[data-res],[data-dis]',$('#sheet')).forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('POST','/api/mod/reports/'+(b.dataset.res||b.dataset.dis),{status:b.dataset.res?'resolved':'dismissed'});await loadState();modPanel(tab)}catch(x){toast(x.message)}});
    $$('[data-unban]',$('#sheet')).forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('POST','/api/mod/unban',{userId:+b.dataset.unban});toast('Unbanned');modPanel('bans')}catch(x){toast(x.message)}});
  }catch(x){const e=$('#mBody');if(e)e.innerHTML=`<p class="err">${esc(x.message)}</p>`}}

/* settings */
$('#settingsBtn').addEventListener('click',()=>{const u=S.me;let col=okCol(u.color),photo=u.photo||null,newBlob=null;
  const draw=()=>{const n=$('#stName')?.value??u.name;$('#stPrev').innerHTML=`<span class="av lg" style="background:${col}">${newBlob?`<img src="${URL.createObjectURL(newBlob)}" alt="">`:photo?`<img src="${esc(imgUrl(photo))}" alt="">`:esc((n||'?').trim().slice(0,1).toUpperCase())}</span>`;$('#stCols').innerHTML=swatchesHTML(col)};
  openModal('settings',`<h2>Your account${vb(myId())}</h2><p class="note">@${esc(u.username)} · ${esc(u.email)}</p>${u.owner?'<p class="note"><span class="tag" style="margin:0 6px 0 0">Owner</span>You can give or remove verified badges. Open anyone’s profile (tap their name in Friends, a search result, a group member, or the info button in a chat).</p>':''}
  <div class="photoRow" style="margin-top:12px"><span id="stPrev"></span><label class="btn ghost sm" for="stPhoto">Change photo</label><input type="file" id="stPhoto" accept="image/*" class="hidden"><button class="btn ghost sm" id="stRm">Remove</button></div>
  <label class="l" for="stName">Display name</label><input class="f" id="stName" maxlength="30" value="${esc(u.name)}">
  <label class="l">Colour</label><div class="swatches" id="stCols"></div>
  <label class="chk" style="margin-top:14px"><input type="checkbox" id="stSound" ${soundOn?'checked':''}><span>Play a ding when a message arrives</span></label>
  <p class="err" id="stErr"></p><div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="stOk">Save</button></div>
  <div class="pwBox"><label class="l" for="pwCur">Change password</label><input class="f" id="pwCur" type="password" placeholder="Current password" autocomplete="current-password">
  <input class="f" id="pwNew" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" style="margin-top:8px">
  <p class="err" id="pwErr"></p><div class="foot" style="margin-top:4px"><button class="btn ghost" id="pwOk">Update password</button></div></div>
  <div class="pwBox"><div class="foot" style="justify-content:space-between;align-items:center"><span class="note">Signed in as ${esc(u.email)}</span><button class="btn danger" id="logout">Log out</button></div></div>`);
  draw();$('#stName').oninput=draw;$('#stCols').onclick=e=>{const b=e.target.closest('[data-c]');if(b){col=b.dataset.c;draw()}};
  $('#stPhoto').onchange=async e=>{const f=e.target.files[0];if(f){newBlob=await squareThumb(f);draw()}};$('#stRm').onclick=()=>{photo=null;newBlob=null;draw()};
  $('#stOk').onclick=async()=>{const n=$('#stName').value.trim();if(!n)return $('#stErr').textContent='Add a display name.';$('#stOk').disabled=true;
    soundOn=$('#stSound').checked;try{localStorage.setItem('ding-sound',soundOn?'on':'off')}catch{}updPill();if(soundOn){unlockAudio();setTimeout(ding,80)}
    try{if(newBlob)photo=(await api('POST','/api/images',undefined,newBlob)).id;await api('PATCH','/api/me',{name:n,color:col,photo});await loadState();closeModal()}catch(x){$('#stOk').disabled=false;$('#stErr').textContent=x.message}};
  $('#pwOk').onclick=async()=>{const e=$('#pwErr');e.textContent='';const cur=$('#pwCur').value,nw=$('#pwNew').value;if(nw.length<8)return e.textContent='New passwords need at least 8 characters.';
    try{await api('POST','/api/me/password',{current:cur,next:nw});$('#pwCur').value='';$('#pwNew').value='';toast('Password updated. Other devices have been logged out.')}catch(x){e.textContent=x.message}};
  $('#logout').onclick=async()=>{try{await api('POST','/api/logout')}catch{}S.me=null;S.chats={};S.users={};S.active=null;closeChat();showAuth();setAuthTab(true)}});

/* ---------- image editor ---------- */
const cv=$('#edCv'),ctx=cv.getContext('2d',{willReadFrequently:true});
const ED={undo:[],mode:'draw',f:{b:100,c:100,s:100,g:0},color:'#ff3b30',size:8,done:null,drag:null,crop:null,txt:null};
const PEN=['#ff3b30','#ffcf33','#30d158','#2f5bff','#bf5af2','#ffffff','#111111'];
function edColors(){$('#edColors').innerHTML=PEN.map(c=>`<button type="button" class="sw" style="background:${c}" data-pc="${c}" aria-label="Pen colour ${c}" aria-pressed="${c===ED.color}"></button>`).join('')}
$('#edColors').addEventListener('click',e=>{const b=e.target.closest('[data-pc]');if(b){ED.color=b.dataset.pc;edColors()}});
$('#edSize').addEventListener('input',e=>ED.size=+e.target.value);
const fIds={b:'fB',c:'fC',s:'fS',g:'fG'};
const filt=()=>`brightness(${ED.f.b}%) contrast(${ED.f.c}%) saturate(${ED.f.s}%) grayscale(${ED.f.g}%)`;
for(const k in fIds)$('#'+fIds[k]).addEventListener('input',e=>{ED.f[k]=+e.target.value;cv.style.filter=filt()});
function syncF(){for(const k in fIds)$('#'+fIds[k]).value=ED.f[k];cv.style.filter=filt()}
$('#edReset').addEventListener('click',()=>{ED.f={b:100,c:100,s:100,g:0};syncF()});
function openEditor(src,label,done){loadImg(src).then(img=>{const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));cv.width=Math.max(1,Math.round(img.naturalWidth*k));cv.height=Math.max(1,Math.round(img.naturalHeight*k));
  ctx.drawImage(img,0,0,cv.width,cv.height);ED.undo=[];ED.f={b:100,c:100,s:100,g:0};syncF();edColors();setMode('draw');ED.done=done;const d=$('#edDone');d.textContent=label;d.disabled=false;
  $('#editor').classList.remove('hidden')}).catch(()=>toast('Couldn’t open that image.'))}
function closeEditor(){$('#editor').classList.add('hidden');hideText();$('#cropBox').classList.add('hidden');ED.undo=[]}
function snap(){ED.undo.push({w:cv.width,h:cv.height,d:ctx.getImageData(0,0,cv.width,cv.height)});if(ED.undo.length>10)ED.undo.shift()}
$('#edUndo').addEventListener('click',()=>{const u=ED.undo.pop();if(!u)return toast('Nothing to undo');cv.width=u.w;cv.height=u.h;ctx.putImageData(u.d,0,0)});
const HINTS={draw:'Drag on the photo to draw.',text:'Tap the photo where the text should go.',crop:'Drag a box over the part to keep, then Apply crop.'};
function setMode(m){ED.mode=m;$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m));$('#edHint').textContent=HINTS[m]||'';
  ED.crop=null;$('#cropBox').classList.add('hidden');$('#edCropOk').classList.add('hidden');hideText()}
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
function rotate(dir){snap();const t=document.createElement('canvas');t.width=cv.height;t.height=cv.width;const x=t.getContext('2d');x.translate(t.width/2,t.height/2);x.rotate(dir*Math.PI/2);x.drawImage(cv,-cv.width/2,-cv.height/2);
  cv.width=t.width;cv.height=t.height;ctx.drawImage(t,0,0)}
$('#edRotL').addEventListener('click',()=>rotate(-1));$('#edRotR').addEventListener('click',()=>rotate(1));
$('#edFlip').addEventListener('click',()=>{snap();const t=document.createElement('canvas');t.width=cv.width;t.height=cv.height;t.getContext('2d').drawImage(cv,0,0);ctx.save();ctx.setTransform(-1,0,0,1,cv.width,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(t,0,0);ctx.restore()});
const pt=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height,k:cv.width/r.width}};
cv.addEventListener('pointerdown',e=>{const p=pt(e);
  if(ED.mode==='draw'){snap();cv.setPointerCapture(e.pointerId);ED.drag=p;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=ED.color;ctx.lineWidth=ED.size*p.k;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.01,p.y);ctx.stroke()}
  else if(ED.mode==='crop'){cv.setPointerCapture(e.pointerId);ED.drag=p;ED.crop={x:p.x,y:p.y,w:0,h:0};showCrop()}
  else if(ED.mode==='text'){showText(e,p)}});
cv.addEventListener('pointermove',e=>{if(!ED.drag)return;const p=pt(e);
  if(ED.mode==='draw'){ctx.beginPath();ctx.moveTo(ED.drag.x,ED.drag.y);ctx.lineTo(p.x,p.y);ctx.stroke();ED.drag=p}
  else if(ED.mode==='crop'){const a=ED.drag,cx=v=>Math.max(0,Math.min(cv.width,v)),cy=v=>Math.max(0,Math.min(cv.height,v));const x1=cx(p.x),y1=cy(p.y);ED.crop={x:Math.min(a.x,x1),y:Math.min(a.y,y1),w:Math.abs(x1-a.x),h:Math.abs(y1-a.y)};showCrop()}});
const endDrag=()=>{if(ED.mode==='crop'&&ED.crop)$('#edCropOk').classList.toggle('hidden',!(ED.crop.w>8&&ED.crop.h>8));ED.drag=null};
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
function showCrop(){const c=ED.crop,r=cv.getBoundingClientRect(),s=$('#edStage').getBoundingClientRect(),k=r.width/cv.width,b=$('#cropBox');
  b.style.left=(r.left-s.left+c.x*k)+'px';b.style.top=(r.top-s.top+c.y*k)+'px';b.style.width=c.w*k+'px';b.style.height=c.h*k+'px';b.classList.remove('hidden')}
$('#edCropOk').addEventListener('click',()=>{const c=ED.crop;if(!c||c.w<8||c.h<8)return;snap();const x=Math.round(c.x),y=Math.round(c.y),w=Math.round(c.w),h=Math.round(c.h);
  const d=ctx.getImageData(x,y,w,h);cv.width=w;cv.height=h;ctx.putImageData(d,0,0);setMode('crop')});
function showText(e,p){const t=$('#edText'),s=$('#edStage').getBoundingClientRect();ED.txt=p;t.value='';t.style.left=Math.min(e.clientX-s.left,s.width-170)+'px';t.style.top=(e.clientY-s.top-20)+'px';t.style.color=ED.color;t.classList.remove('hidden');setTimeout(()=>t.focus(),0)}
function hideText(){$('#edText').classList.add('hidden');ED.txt=null}
function commitText(){const t=$('#edText'),v=t.value.trim(),p=ED.txt;hideText();if(!v||!p)return;snap();const fs=Math.max(14,ED.size*3.2)*p.k;
  ctx.font=`700 ${fs}px Inter, system-ui, sans-serif`;ctx.textBaseline='top';ctx.lineJoin='round';ctx.lineWidth=fs/7;ctx.strokeStyle=ED.color==='#111111'?'#ffffff':'#000000';
  ctx.strokeText(v,p.x,p.y);ctx.fillStyle=ED.color;ctx.fillText(v,p.x,p.y)}
$('#edText').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitText()}else if(e.key==='Escape'){e.stopPropagation();hideText()}});
$('#edText').addEventListener('blur',()=>{if(ED.txt)commitText()});
$('#edCancel').addEventListener('click',closeEditor);
addEventListener('keydown',e=>{if($('#editor').classList.contains('hidden'))return;if(e.key==='Escape'&&document.activeElement!==$('#edText'))closeEditor();
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&document.activeElement!==$('#edText')){e.preventDefault();$('#edUndo').click()}});
function bake(){const o=document.createElement('canvas');o.width=cv.width;o.height=cv.height;const x=o.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,o.width,o.height);x.drawImage(cv,0,0);
  const {b,c,s,g}=ED.f;if(b!==100||c!==100||s!==100||g!==0){const id=x.getImageData(0,0,o.width,o.height),d=id.data,B=b/100,C=c/100,Sa=s/100,G=g/100;
    for(let i=0;i<d.length;i+=4){let r=d[i]*B,gg=d[i+1]*B,bb=d[i+2]*B;r=(r-128)*C+128;gg=(gg-128)*C+128;bb=(bb-128)*C+128;
      let l=.2126*r+.7152*gg+.0722*bb;r=l+(r-l)*Sa;gg=l+(gg-l)*Sa;bb=l+(bb-l)*Sa;l=.2126*r+.7152*gg+.0722*bb;d[i]=r+(l-r)*G;d[i+1]=gg+(l-gg)*G;d[i+2]=bb+(l-bb)*G}x.putImageData(id,0,0)}
  return new Promise(res=>o.toBlob(bl=>res({bl,w:o.width,h:o.height}),'image/jpeg',.88))}
$('#edDone').addEventListener('click',async()=>{if(ED.txt)commitText();const d=$('#edDone'),label=d.textContent;d.disabled=true;d.textContent=label==='Send'?'Sending…':'Saving…';
  try{const {bl,w,h}=await bake();await ED.done(bl,w,h);closeEditor()}catch(x){toast(x&&x.code?errMsg(x):'Couldn’t upload that photo. Try a smaller one.')}finally{d.disabled=false;d.textContent=label}});


boot();
}
