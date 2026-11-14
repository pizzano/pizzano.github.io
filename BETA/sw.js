/* KØL BETA: static app shell only. Menu, images, Firebase and orders bypass SW. */
'use strict';
const CACHE_NAME='kol-beta-static-v20261114-03';
const CACHE_PREFIX='kol-beta-static-';
const ROOT=new URL(self.registration.scope);
const INDEX_URL=new URL('index.html',ROOT).href;
const STATIC_URLS=[
  'index.html',
  'style.css?v=20261114-images-fallback13',
  'sepet.js?v=20261114-toast12',
  'app.js?v=20261114-images-fallback13',
  'profil.js?v=20261114-toast12',
].map(path=>new URL(path,ROOT).href);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_URLS);
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==ROOT.origin)return;
 // Navigation is network-first to avoid showing an out-of-date ordering interface.
 // Offline, use the matching-version HTML shell saved during installation.
 if(request.mode==='navigate'){
  if(url.pathname!==ROOT.pathname&&url.pathname!==new URL('index.html',ROOT).pathname)return;
  event.respondWith((async()=>{
   try{
    const fresh=await fetch(request);
    if(fresh.ok){
     const cache=await caches.open(CACHE_NAME);
     await cache.put(INDEX_URL,fresh.clone());
    }
    return fresh;
   }catch{
    const cache=await caches.open(CACHE_NAME);
    return await cache.match(INDEX_URL)||Response.error();
   }
  })());
  return;
 }
 // Only the precise local CSS/JS asset URLs listed above may use Cache Storage.
 // No images, remote origins, Firebase REST/SSE, order APIs or uploads are handled.
 const asset=url.pathname.slice(ROOT.pathname.length);
 if(!['style.css','app.js','sepet.js','profil.js'].includes(asset)||!url.searchParams.has('v'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const saved=await cache.match(request);
  if(saved)return saved;
  const fresh=await fetch(request);
  if(fresh.ok){
   await cache.put(request,fresh.clone());
   // Keep only the newest query-string version of each static file.
   const keys=await cache.keys();
   await Promise.all(keys.filter(entry=>
    new URL(entry.url).pathname===url.pathname && entry.url!==url.href
   ).map(entry=>cache.delete(entry)));
  }
  return fresh;
 })());
});
