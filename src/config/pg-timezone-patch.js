/**
 * Parche global del driver pg para serializar SIEMPRE las fechas
 * en zona horaria de Colombia (America/Bogota, UTC-5).
 *
 * ¿Por qué es necesario?
 * - process.env.TZ = 'America/Bogota' NO funciona de forma confiable
 *   en todos los entornos (Docker Alpine, ciertos cloud providers).
 * - Node.js puede cachear la timezone del sistema ANTES de que tu código
 *   establezca TZ, dejando new Date() en UTC.
 * - Este parche intercepta TODA serialización de Date hacia PostgreSQL
 *   y la formatea explícitamente en hora Colombia con offset -05:00.
 *
 * Se debe requerir UNA SOLA VEZ, antes de cualquier conexión a la BD.
 */

const pg = require('pg');

const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');

/**
 * Formatea un Date en Colombia timezone para PostgreSQL.
 * Usa Intl.DateTimeFormat que SIEMPRE respeta el timeZone sin depender de TZ.
 * Retorna: "2025-03-10 22:05:00.123-05:00"
 */
function dateToStringColombia(date) {
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
  }).formatToParts(date).forEach(({ type, value }) => {
    parts[type] = value;
  });

  // hour12:false puede retornar "24" para medianoche → normalizar a "00"
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const ms = pad3(date.getMilliseconds());

  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}.${ms}-05:00`;
}

// ─── PARCHE 1: Serialización de Date → PostgreSQL ───────────────────
// Intercepta prepareValue del driver pg para que todo Date se envíe
// con hora Colombia explícita.
try {
  const pgUtils = require('pg/lib/utils');
  const originalPrepareValue = pgUtils.prepareValue;

  pgUtils.prepareValue = function patchedPrepareValue(val, seen) {
    if (val instanceof Date) {
      return dateToStringColombia(val);
    }
    return originalPrepareValue(val, seen);
  };

  console.log('✅ pg: serialización de fechas parcheada → Colombia (UTC-5)');
} catch (err) {
  console.error('⚠️ No se pudo parchar pg prepareValue:', err.message);
}

// ─── PARCHE 2: Lectura de TIMESTAMP WITHOUT TIME ZONE ───────────────
// Si alguna columna es TIMESTAMP (sin TZ), PostgreSQL devuelve el valor
// literal sin offset. Este parser lo interpreta como hora Colombia.
// OID 1114 = TIMESTAMP WITHOUT TIME ZONE
pg.types.setTypeParser(1114, (stringValue) => {
  // Interpretar el valor literal como hora Colombia
  return new Date(stringValue + '-05:00');
});

// OID 1184 = TIMESTAMP WITH TIME ZONE (ya incluye offset, parsear normal)
pg.types.setTypeParser(1184, (stringValue) => {
  return new Date(stringValue);
});

console.log('✅ pg: parseo de timestamps parcheado → Colombia (UTC-5)');

module.exports = { dateToStringColombia };
