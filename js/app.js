const $=s=>document.querySelector(s);
const LS={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){toast("Не удалось сохранить: память браузера заполнена");return false}}};
function toast(t){const e=$("#toast");e.textContent=t;e.style.display="block";clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display="none",2600)}

/* ---------- данные ---------- */
const FM=[["10×15 см",100,150,25],["13×18 см",130,180,45],["15×21 см",150,210,60],["A4, 21×30 см",210,297,150],["Фото на документы 3×4",30,40,120]];
const sat=s=>[.213+.787*s,.715-.715*s,.072-.072*s,.213-.213*s,.715+.285*s,.072-.072*s,.213-.213*s,.715-.715*s,.072+.928*s];
const FX={none:{n:"Оригинал"},
  bw:{n:"Чёрно-белое",m:[.3,.59,.11,.3,.59,.11,.3,.59,.11],c:1.1},
  sepia:{n:"Сепия",m:[.393,.769,.189,.349,.686,.168,.272,.534,.131],c:1},
  warm:{n:"Тёплое",m:[1.1,.05,0,0,1,0,0,.05,.88],c:1.05},
  cool:{n:"Холодное",m:[.9,0,.05,0,1,.05,.05,.05,1.1],c:1},
  pop:{n:"Контраст",m:sat(1.35),c:1.3},
  fade:{n:"Плёнка",m:sat(.8),c:.88,b:22}};
const STK=["🎩","🕶️","👑","🎀","🧢","👒","🎅","🌸","⭐","❄️","🎈","🎉"];
const LOOKS={"Деловой":[["🎩",.5,.12,.3],["🕶️",.5,.4,.32]],"Пляж":[["👒",.5,.12,.34],["🕶️",.5,.4,.32],["🌴",.88,.86,.22]],
  "Праздник":[["👑",.5,.1,.28],["🎉",.12,.88,.2],["🎈",.88,.2,.2]],"Новый год":[["🎅",.5,.12,.3],["❄️",.12,.15,.15],["🎄",.88,.85,.22]]};
let S={img:null,fx:"none",ov:null,vig:false,st:[],sel:-1,fmt:0,land:false,frame:"none"};
let user=LS.get("session",null), cache={k:"",c:null};

/* ---------- отрисовка ---------- */
function dims(){let w=FM[S.fmt][1],h=FM[S.fmt][2];if(S.land)[w,h]=[h,w];return[900,Math.round(900*h/w)]}
function filtered(iw,ih){
  const key=[S.fx,iw,ih,S.img&&S.img.src.length].join();
  if(cache.k===key)return cache.c;
  const c=document.createElement("canvas");c.width=iw;c.height=ih;const x=c.getContext("2d");
  const r=Math.max(iw/S.img.width,ih/S.img.height),w=S.img.width*r,h=S.img.height*r;
  x.drawImage(S.img,(iw-w)/2,(ih-h)/2,w,h);
  const f=FX[S.fx];
  if(f.m){const d=x.getImageData(0,0,iw,ih),p=d.data,m=f.m,k=f.c||1,b=f.b||0;
    for(let i=0;i<p.length;i+=4){const R=p[i],G=p[i+1],B=p[i+2];
      for(let j=0;j<3;j++){let v=R*m[j*3]+G*m[j*3+1]+B*m[j*3+2];v=(v-128)*k+128+b;p[i+j]=v<0?0:v>255?255:v}}
    x.putImageData(d,0,0)}
  cache={k:key,c:c};return c}
function draw(c){
  const[W,H]=dims();c.width=W;c.height=H;const x=c.getContext("2d");
  x.fillStyle="#fff";x.fillRect(0,0,W,H);
  const m=S.frame==="polaroid"?W*.05:S.frame==="thin"?W*.03:0,mb=S.frame==="polaroid"?W*.16:m;
  const iw=Math.round(W-2*m),ih=Math.round(H-m-mb);
  if(S.img){x.drawImage(filtered(iw,ih),m,m);
    if(S.vig){const g=x.createRadialGradient(W/2,m+ih/2,ih*.3,W/2,m+ih/2,Math.max(iw,ih)*.75);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.55)");x.save();x.beginPath();x.rect(m,m,iw,ih);x.clip();x.fillStyle=g;x.fillRect(m,m,iw,ih);x.restore()}
    if(S.ov)x.drawImage(S.ov,m,m,iw,ih)}
  else{x.fillStyle="#e7e5dc";x.fillRect(m,m,iw,ih)}
  x.textAlign="center";x.textBaseline="middle";
  S.st.forEach((s,i)=>{x.font=(s.s*W)+"px sans-serif";x.fillText(s.e,s.x*W,s.y*W);
    if(i===S.sel){x.strokeStyle="#0E8FA8";x.lineWidth=3;x.setLineDash([8,6]);x.strokeRect(s.x*W-s.s*W*.6,s.y*W-s.s*W*.6,s.s*W*1.2,s.s*W*1.2);x.setLineDash([])}})}
function render(){draw($("#cv"));price()}
function price(){const q=Math.max(1,+$("#qty").value||1);$("#price").textContent=Math.round(FM[S.fmt][3]*q*+$("#paper").value)+" ₽"}

/* ---------- элементы управления ---------- */
FM.forEach((f,i)=>$("#fmt").add(new Option(f[0]+" — от "+f[3]+" ₽",i)));
$("#fxBtns").innerHTML=Object.keys(FX).map(k=>`<button data-fx="${k}" aria-pressed="${k==="none"}">${FX[k].n}</button>`).join("");
$("#fxBtns").onclick=e=>{const k=e.target.dataset.fx;if(!k)return;S.fx=k;document.querySelectorAll("[data-fx]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.fx===k));render()};
$("#looks").innerHTML=Object.keys(LOOKS).map(k=>`<button data-look="${k}">${k}</button>`).join("")+"<br>"+STK.map(e=>`<button class="look" data-stk="${e}" aria-label="Наклейка ${e}">${e}</button>`).join("");
$("#looks").onclick=e=>{const l=e.target.dataset.look,s=e.target.dataset.stk;
  if(l){S.st=LOOKS[l].map(a=>{const[W,H]=dims();return{e:a[0],x:a[1],y:a[2]*W/W*(H/W>1?1:1)*(1)+0,s:a[3]*.45}});const[W,H]=dims();S.st.forEach((o,i)=>o.y=LOOKS[l][i][2]*H/W);S.sel=-1}
  else if(s){const[W,H]=dims();S.st.push({e:s,x:.5,y:H/W/2,s:.18});S.sel=S.st.length-1;$("#sz").value=18}
  render()};
$("#sz").oninput=e=>{if(S.sel>=0){S.st[S.sel].s=e.target.value/100;render()}};
$("#delSt").onclick=()=>{if(S.sel>=0){S.st.splice(S.sel,1);S.sel=-1;render()}};
$("#clrSt").onclick=()=>{S.st=[];S.sel=-1;render()};
$("#fmt").onchange=e=>{S.fmt=+e.target.value;cache.k="";render()};
$("#frame").onchange=e=>{S.frame=e.target.value;cache.k="";render()};
$("#land").onchange=e=>{S.land=e.target.checked;cache.k="";render()};
$("#vig").onchange=e=>{S.vig=e.target.checked;render()};
$("#qty").oninput=price;$("#paper").onchange=price;

function loadImg(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src})}
function readFile(f){return new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)})}
$("#file").onchange=async e=>{const f=e.target.files[0];if(!f)return;S.img=await loadImg(await readFile(f));cache.k="";$("#hint").hidden=true;render()};

/* перетаскивание наклеек */
let drag=-1;const cv=$("#cv");
function pt(e){const r=cv.getBoundingClientRect(),k=cv.width/r.width;return[(e.clientX-r.left)*k/cv.width,(e.clientY-r.top)*k/cv.width]}
cv.onpointerdown=e=>{const[x,y]=pt(e);drag=-1;
  for(let i=S.st.length-1;i>=0;i--){const s=S.st[i];if(Math.hypot(s.x-x,s.y-y)<s.s*.6){drag=i;break}}
  S.sel=drag;if(drag>=0){$("#sz").value=Math.round(S.st[drag].s*100);cv.setPointerCapture(e.pointerId)}render()};
cv.onpointermove=e=>{if(drag<0)return;const[x,y]=pt(e);S.st[drag].x=x;S.st[drag].y=y;render()};
cv.onpointerup=()=>drag=-1;

/* ---------- аккаунт ---------- */
async function hash(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
let reg=false;
$("#authSw").onclick=()=>{reg=!reg;$("#nameRow").hidden=!reg;$("#authTtl").textContent=reg?"Регистрация":"Вход";$("#authGo").textContent=reg?"Создать аккаунт":"Войти";$("#authSw").textContent=reg?"У меня есть аккаунт":"Создать аккаунт"};
$("#authGo").onclick=async()=>{
  const mail=$("#aMail").value.trim().toLowerCase(),pw=$("#aPass").value,name=$("#aName").value.trim();
  if(!/^\S+@\S+\.\S+$/.test(mail))return toast("Введите корректную почту");
  if(pw.length<6)return toast("Пароль короче 6 символов");
  const users=LS.get("users",{}),h=await hash(pw);
  if(reg){if(users[mail])return toast("Эта почта уже зарегистрирована");if(!name)return toast("Укажите имя");users[mail]={name,h};LS.set("users",users)}
  else if(!users[mail]||users[mail].h!==h)return toast("Неверная почта или пароль");
  user={mail,name:users[mail].name};LS.set("session",user);toast("Добро пожаловать, "+user.name);location.hash="#editor";route()};
$("#out").onclick=()=>{user=null;LS.set("session",null);location.hash="#cabinet";route()};

/* ---------- библиотека эффектов ---------- */
const libKey=()=>"fx:"+user.mail;
$("#ovFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;
  const im=await loadImg(await readFile(f));S.ov=im;render();
  if(!user){toast("Эффект применён. Войдите, чтобы сохранить его в кабинете");return}
  const c=document.createElement("canvas"),k=Math.min(1,600/im.width);c.width=im.width*k;c.height=im.height*k;c.getContext("2d").drawImage(im,0,0,c.width,c.height);
  const l=LS.get(libKey(),[]);l.push(c.toDataURL("image/png"));if(LS.set(libKey(),l))toast("Эффект сохранён в кабинете");drawLib()};
function drawLib(){
  const l=user?LS.get(libKey(),[]):[];
  const html=l.map((s,i)=>`<div><img src="${s}" data-use="${i}" alt="Эффект ${i+1}"><b data-del="${i}" title="Удалить">×</b></div>`).join("");
  $("#lib").innerHTML=html;$("#lib2").innerHTML=html;$("#libEmpty").hidden=l.length>0}
document.addEventListener("click",async e=>{
  const u=e.target.dataset.use,d=e.target.dataset.del;
  if(u!==undefined){S.ov=await loadImg(LS.get(libKey(),[])[u]);render()}
  if(d!==undefined){const l=LS.get(libKey(),[]);l.splice(d,1);LS.set(libKey(),l);S.ov=null;drawLib();render()}});

/* ---------- заказ ---------- */
$("#send").onclick=()=>{
  if(!S.img)return toast("Сначала загрузите фото");
  if(!user){toast("Войдите, чтобы отправить заказ");location.hash="#cabinet";return}
  const t=document.createElement("canvas");const[W,H]=dims();t.width=240;t.height=Math.round(240*H/W);t.getContext("2d").drawImage(cv,0,0,t.width,t.height);
  const list=LS.get("orders:"+user.mail,[]);
  const o={id:1000+list.length+1,date:new Date().toLocaleString("ru-RU"),fmt:FM[S.fmt][0],paper:$("#paper").selectedOptions[0].text,qty:+$("#qty").value||1,recv:$("#recv").value,note:$("#note").value.trim(),sum:$("#price").textContent,fx:FX[S.fx].n,th:t.toDataURL("image/jpeg",.6),st:"Принят"};
  list.unshift(o);if(LS.set("orders:"+user.mail,list)){toast("Заказ №"+o.id+" отправлен в печать");location.hash="#orders"}};
$("#dl").onclick=()=>{if(!S.img)return toast("Сначала загрузите фото");const a=document.createElement("a");a.download="maket.jpg";a.href=cv.toDataURL("image/jpeg",.92);a.click()};
function drawOrders(){
  const el=$("#ordList");
  if(!user){el.innerHTML='<p class="empty">Заказы доступны после входа. <a href="#cabinet">Войти</a></p>';return}
  const l=LS.get("orders:"+user.mail,[]);
  el.innerHTML=l.length?l.map(o=>`<div class="ord"><img src="${o.th}" alt="Макет заказа ${o.id}"><div><b>Заказ №${o.id}</b> · ${o.sum}<br><small>${o.fmt}, ${o.paper}, ${o.qty} шт., эффект: ${o.fx}<br>${o.recv} · ${o.date}${o.note?"<br>"+o.note.replace(/</g,"&lt;"):""}</small></div><span class="st">${o.st}</span></div>`).join(""):'<p class="empty">Заказов пока нет. Соберите макет в <a href="#editor">редакторе</a>.</p>'}

/* ---------- маршруты ---------- */
function route(){
  const v=["editor","orders","cabinet"].includes(location.hash.slice(1))?location.hash.slice(1):"editor";
  ["editor","orders","cabinet"].forEach(n=>$("#v-"+n).hidden=n!==v);
  document.querySelectorAll("nav a").forEach(a=>a.removeAttribute("aria-current"));
  const cur=document.querySelector(`nav a[href="#${v}"]`);if(cur)cur.setAttribute("aria-current","page");
  $("#navCab").textContent=user?user.name:"Войти";
  $("#authBox").hidden=!!user;$("#cabBox").hidden=!user;
  if(user){$("#cabName").textContent=user.name;$("#cabMail").textContent=user.mail}
  drawLib();drawOrders();if(v==="editor")render()}
addEventListener("hashchange",route);route();
