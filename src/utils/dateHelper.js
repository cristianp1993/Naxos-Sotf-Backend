/**
 * DateHelper - Utilidad centralizada para manejo de fechas en zona horaria Colombia
 * 
 * IMPORTANTE: Este módulo complementa la configuración global de TZ=America/Bogota
 * que se establece en index.js. Todas las funciones aquí garantizan que las fechas
 * se manejen consistentemente en hora de Colombia (UTC-5).
 * 
 * Uso:
 *   const { now, todayString, startOfDay, endOfDay } = require('../utils/dateHelper');
 *   
 *   // Obtener fecha/hora actual en Colombia
 *   const currentDate = now();
 *   
 *   // Obtener string de fecha "YYYY-MM-DD" en Colombia
 *   const today = todayString();
 *   
 *   // Rango de un día completo para queries
 *   const start = startOfDay('2025-03-10');
 *   const end = endOfDay('2025-03-10');
 */

const TIMEZONE = 'America/Bogota';
const LOCALE = 'es-CO';

/**
 * Retorna la fecha/hora actual en Colombia como STRING con offset explícito.
 * Formato: "2026-03-10T22:05:00.123-05:00"
 *
 * ¿Por qué string y no Date?
 * - new Date() en un servidor UTC retorna hora UTC.
 * - El driver pg serializa Date usando la timezone LOCAL del servidor.
 * - En producción (UTC), eso envía "03:05:00+00:00" en vez de "22:05:00-05:00".
 * - Un string con offset explícito -05:00 FUERZA a PostgreSQL a interpretar
 *   la hora como Colombia, sin importar dónde corra el servidor.
 * - Sequelize acepta strings para campos DataTypes.DATE sin problema.
 */
const now = () => {
  const d = new Date();
  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d).forEach(({ type, value }) => {
    parts[type] = value;
  });
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}.${ms}-05:00`;
};

/**
 * Retorna la fecha actual en formato "YYYY-MM-DD" en zona horaria Colombia.
 * Usa Intl.DateTimeFormat para NO depender de process.env.TZ.
 */
const todayString = () => {
  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).forEach(({ type, value }) => {
    parts[type] = value;
  });
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/**
 * Retorna un Date representando el inicio del día (00:00:00) en Colombia
 * para una fecha dada en formato "YYYY-MM-DD".
 */
const startOfDay = (dateString) => {
  return new Date(dateString + 'T00:00:00-05:00');
};

/**
 * Retorna un Date representando el final del día (23:59:59.999) en Colombia
 * para una fecha dada en formato "YYYY-MM-DD".
 */
const endOfDay = (dateString) => {
  return new Date(dateString + 'T23:59:59.999-05:00');
};

/**
 * Formatea un Date a string legible en formato Colombia.
 * Ejemplo: "10/3/2025, 2:30:00 p. m."
 */
const formatColombia = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleString(LOCALE, { timeZone: TIMEZONE });
};

/**
 * Formatea un Date a ISO string con offset Colombia (-05:00).
 * Ejemplo: "2025-03-10T14:30:00-05:00"
 */
const toColombiaISO = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const offset = -5 * 60; // Colombia offset en minutos
  const local = new Date(d.getTime() - (offset * 60000));
  const iso = local.toISOString().replace('Z', '-05:00');
  return iso;
};

/**
 * Retorna la fecha "YYYY-MM-DD" de un Date en zona horaria Colombia.
 * Usa Intl para NO depender de process.env.TZ.
 */
const toDateString = (date) => {
  if (!date) return null;
  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(date)).forEach(({ type, value }) => {
    parts[type] = value;
  });
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/**
 * Retorna la hora "HH:mm:ss" de un Date en zona horaria Colombia.
 * Usa Intl para NO depender de process.env.TZ.
 */
const toTimeString = (date) => {
  if (!date) return null;
  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(date)).forEach(({ type, value }) => {
    parts[type] = value;
  });
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${hour}:${parts.minute}:${parts.second}`;
};

/**
 * Información de diagnóstico sobre la configuración de timezone.
 * Útil para debugging y logs de salud del sistema.
 */
const getTimezoneInfo = () => {
  const d = new Date();
  return {
    timezone_configured: TIMEZONE,
    process_tz: process.env.TZ || 'NOT SET',
    current_time_colombia: formatColombia(d),
    current_date_colombia: todayString(),
    now_returns: now(),
    current_iso_utc: d.toISOString(),
    timezone_offset_minutes: d.getTimezoneOffset(),
  };
};

module.exports = {
  TIMEZONE,
  LOCALE,
  now,
  todayString,
  startOfDay,
  endOfDay,
  formatColombia,
  toColombiaISO,
  toDateString,
  toTimeString,
  getTimezoneInfo,
};
