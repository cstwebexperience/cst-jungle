# CST / JUNGLA — site „flex" în stilul igloo.inc

Vite + Three.js (vanilla), Lenis. Dev: `npm run dev` (port 3030). Plimbare cu capturi: `node scripts/tour.mjs http://localhost:3030 desktop|mobile`.

## Idee
Aceeași rețetă ca igloo.inc, în junglă (verde smarald, licurici, ruină cu mușchi):
loader cu % + intrare cu/fără sunet → hero → manifest (cuvinte aprinse la scroll) → filozofie + cifre →
4 artefacte (proiecte) în câmpuri de scanare, cu panou HUD + detaliu cu iframe → portal de particule + contact.

## Modele 3D — DOAR de la user (regulă pe viață, nu inventez obiecte 3D)
Se pun în `public/models/`: `templu.glb` (obiectul central, se scalează la ~7.5 înălțime), `proiect-1.glb` … `proiect-4.glb` (artefactele, scalate la 1.6).
Dacă lipsesc, eticheta arată „ÎN AȘTEPTAREA MODELULUI". Când apar, intră cu efect de scanare de jos în sus (`addReveal` în `src/scene.js`).

## Fișiere
- `src/scene.js` — scena, camera pe 8 cadre cheie (una pe secțiune), shadere, bloom, aberație cromatică la scroll
- `src/main.js` — loader, HUD, etichete 3D, panou proiect, cursor
- `src/projects.js` — textele proiectelor
- `src/audio.js` — ambianță junglă generată din cod (Web Audio)

## De confirmat cu userul
Cifrele din „Filozofie" (40 / 12 / 100) sunt provizorii. Linkul de Instagram e generic.
