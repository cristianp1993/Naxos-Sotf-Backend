// ─── SERIALIZACIÓN JSON DE FECHAS → SIEMPRE HORA COLOMBIA ───
// La BD guarda timestamps UTC reales. Al serializar a JSON convertimos
// a hora Colombia con Intl.DateTimeFormat (funciona en cualquier servidor).
// El frontend recibe la hora Colombia directamente, sin Z, sin conversiones.
Date.prototype.toJSON = function () {
  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(this).forEach(({ type, value }) => {
    parts[type] = value;
  });
  const h = parts.hour === '24' ? '00' : parts.hour;
  const ms = String(this.getMilliseconds()).padStart(3, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}:${parts.second}.${ms}`;
};

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

require("./server");
