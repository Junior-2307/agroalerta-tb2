self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>{
    event.waitUntil((async()=>{
        const prefix='agroalerta-shell-'+new URL(self.registration.scope).pathname+'::';
        const keys=await caches.keys();
        await Promise.all(keys.filter(k=>k==='agroalerta-shell-v1'||k.startsWith(prefix)).map(k=>caches.delete(k)));
        await self.registration.unregister();
    })());
});
