// ─── FORZAR ZONA HORARIA COLOMBIA (America/Bogota, UTC-5) ───
// Esto DEBE ser lo primero que se ejecuta, antes de cualquier otro require.
// Hace que new Date() y todas las funciones de fecha de Node.js
// operen en hora de Colombia, sin importar dónde esté el servidor.
process.env.TZ = 'America/Bogota';

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

require("./server");
