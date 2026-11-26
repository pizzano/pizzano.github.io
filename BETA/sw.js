/* BETA: static app shell only. Menu, images, Firebase and orders bypass SW. */
'use strict';
const CACHE_NAME='fatih1-static-opt-a5285d83bb69c7ea';
const CACHE_PREFIX='fatih1-static-';
const LEGACY_CACHE_PREFIX='kol-beta-static-';
const ROOT=new URL(self.registration.scope);
const INDEX_URL=new URL('index.html',ROOT).href;
const STATIC_URLS=[
  'index.html',
  'index/style.min.css?v=ce3b3640d61228e4',
  'shared/firebase-io.min.js?v=cb0b7ee328faadaa',
  'shared/bonus.min.js?v=8aaf3f3ed5930626',
  'index/sepet.min.js?v=ae79d44428549d4c',
  'index/app.min.js?v=e93544fbdbb7628d',
  'index/profil.min.js?v=4487b54a67951757',
].map(path=>new URL(path,ROOT).href);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_URLS);
  // A deployment can change index.html while this worker is installing.
  // Only activate when the precached document refers to this exact asset set.
  const shell=await cache.match(INDEX_URL);
  const html=await shell.text();
  if(!STATIC_URLS.filter(url=>url!==INDEX_URL).every(url=>html.includes('./'+url.slice(ROOT.href.length)))){
   await caches.delete(CACHE_NAME);
   throw Error('App shell and asset versions do not match');
  }
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>(name.startsWith(CACHE_PREFIX)||name.startsWith(LEGACY_CACHE_PREFIX))&&name!==CACHE_NAME).map(name=>caches.delete(name)));
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
    // Always return current network HTML, but retain the matching installed
    // offline shell until the next worker has cached its complete asset set.
    return await fetch(request);
   }catch{
    const cache=await caches.open(CACHE_NAME);
    return await cache.match(INDEX_URL)||Response.error();
   }
  })());
  return;
 }
 // Only exact asset versions from this installed shell are cached.
 // New deployment assets are served normally until its worker activates.
 if(!STATIC_URLS.includes(url.href)||url.href===INDEX_URL)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const saved=await cache.match(request);
  if(saved)return saved;
  const fresh=await fetch(request);
  if(fresh.ok)await cache.put(request,fresh.clone());
  return fresh;
 })());
});
