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
 * Retorna un objeto Date con la hora actual.
 * Con TZ=America/Bogota configurado globalmente, new Date() ya opera en Colombia.
 * Esta función centraliza la creación para facilitar testing y auditoría.
 */
const now = () => new Date();

/**
 * Retorna la fecha actual en formato "YYYY-MM-DD" en zona horaria Colombia.
 */
const todayString = () => {
  const d = now();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
 */
const toDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  // Con TZ=America/Bogota, getFullYear/getMonth/getDate ya son Colombia
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Retorna la hora "HH:mm:ss" de un Date en zona horaria Colombia.
 */
const toTimeString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Información de diagnóstico sobre la configuración de timezone.
 * Útil para debugging y logs de salud del sistema.
 */
const getTimezoneInfo = () => {
  const d = now();
  return {
    timezone_configured: TIMEZONE,
    process_tz: process.env.TZ || 'NOT SET',
    current_time_colombia: formatColombia(d),
    current_date_colombia: todayString(),
    current_iso: d.toISOString(),
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
