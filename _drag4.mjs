import puppeteer from 'puppeteer'
const REF='gyovaszizetyivumixzz', FUTURE=Math.floor(Date.now()/1000)+86400
const SESSION={access_token:'fake',token_type:'bearer',expires_in:86400,expires_at:FUTURE,refresh_token:'r',
  user:{id:'u1',aud:'authenticated',role:'authenticated',email:'a@b.c',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}}
const mk=(n,p)=>({id:`e${n}`,note:null,created_at:`2026-08-0${n}T00:00:00Z`,position:p,wardrobe_item_id:`w${n}`,outfit_id:null,
  wardrobe_items:{name:`Piece ${n}`,category:'Dress',color_hex:'#c88b6e',image_url:`https://x.invalid/${n}.jpg`},outfits:null})
const TRIP=[{id:'t1',title:'Goa',created_at:'2026-08-01T00:00:00Z',trip_entries:[mk(1,0),mk(2,1),mk(3,2),mk(4,3),mk(5,4),mk(6,5)]}]
const b=await puppeteer.launch(); const p=await b.newPage()
await p.setViewport({width:414,height:896,hasTouch:true,isMobile:true})
const rpc=[],errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.setRequestInterception(true)
p.on('request',r=>{const u=r.url(),H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'}
  if(u.includes('rpc/reorder_trip_entries')){if(r.method()==='POST')rpc.push(1);return r.respond({status:200,headers:H,body:'null'})}
  if(u.includes('/rest/v1/trips'))return r.respond({status:200,headers:H,body:JSON.stringify(TRIP)})
  if(u.includes('/rest/v1/')||u.includes('/auth/v1/')||u.includes('storage/v1'))return r.respond({status:200,headers:H,body:'[]'})
  if(u.includes('x.invalid'))return r.abort(); r.continue()})
await p.evaluateOnNewDocument((ref,s)=>{localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify(s));localStorage.setItem('sakhi_onboarded','true')},REF,SESSION)
await p.goto('http://localhost:5173/trips/t1',{waitUntil:'networkidle0'}); await new Promise(r=>setTimeout(r,1200))
const order=()=>p.evaluate(()=>[...document.querySelectorAll('img[alt^="Piece"]')].map(i=>i.alt))
const boxes=()=>p.evaluate(()=>[...document.querySelectorAll('img[alt^="Piece"]')].map(i=>{const r=i.getBoundingClientRect();return{alt:i.alt,x:r.x+r.width/2,y:r.y+r.height/2}}))
console.log('classes on tile:', await p.evaluate(()=>document.querySelector('img[alt^="Piece"]').closest('button').className.split(' ')[0]))
async function td(f,t,l){const bs=await boxes(),a=bs.find(x=>x.alt===f),z=bs.find(x=>x.alt===t); if(!a||!z)return console.log(l,'missing')
  await p.touchscreen.touchStart(a.x,a.y); await new Promise(r=>setTimeout(r,320))
  for(let i=1;i<=10;i++){await p.touchscreen.touchMove(a.x+(z.x-a.x)*i/10,a.y+(z.y-a.y)*i/10);await new Promise(r=>setTimeout(r,25))}
  await new Promise(r=>setTimeout(r,120)); await p.touchscreen.touchEnd(); await new Promise(r=>setTimeout(r,700))
  console.log(`${l}: ${(await order()).join(', ')}`)}
await td('Piece 1','Piece 4','#1'); await td('Piece 2','Piece 6','#2'); await td('Piece 3','Piece 1','#3'); await td('Piece 5','Piece 1','#4')
console.log('RPC calls:',rpc.length,'| ERRORS:',errs.length?errs.join(';'):'none')
await b.close()
