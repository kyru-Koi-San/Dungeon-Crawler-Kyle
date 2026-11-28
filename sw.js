const CACHE='dck-shell-v419';const FILES=['./','./index.html','./style.css?v=0419','./music.js?v=0419','./game.js?v=0419','./multiplayer.js?v=0419','./manifest.webmanifest','./icon.svg','./item-art.svg','./hero-front.png','./hero-back.png','./hero-side.png','./hero-slash.png','./hero-strike.png','./skeleton.png','./goblin.png','./spider.png','./wraith.png','./archer.png','./shaman.png','./sewer-rat.png','./pack-llama.png','./flood-grub.png','./mire-leprechaun.png','./mob-walk.png','./scenery.png','./guild-hall.png','./spider-boss.png','./bone-champion.png'];
// Keep a complete offline shell. A failed update must not discard the previous cache.
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dck-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 const url=new URL(e.request.url),scope=new URL(self.registration.scope);
 if(!url.pathname.startsWith(scope.pathname))return;
 const shell=FILES.some(file=>new URL(file,scope).href===url.href);
 if(!shell&&e.request.mode!=='navigate')return;
 // Await cache writes so mobile suspension cannot interrupt an otherwise successful refresh.
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Versioned assets belong to the installed shell; avoid mixing releases.
  if(url.searchParams.get('v')==='0419'){const installed=await cache.match(e.request);if(installed)return installed}
  try{
   const response=await fetch(e.request,{cache:'no-store'});
   if(response.ok&&response.type!=='opaque'){
    try{await cache.put(e.request,response.clone())}catch{/* Storage pressure must not prevent online play. */}
   }
   if(response.status>=500){const saved=await cache.match(e.request)||(e.request.mode==='navigate'?await cache.match('./index.html'):null);if(saved)return saved}
   return response;
  }catch{
   return await cache.match(e.request)||(e.request.mode==='navigate'?await cache.match('./index.html'):null)||Response.error();
  }
 })());
});
