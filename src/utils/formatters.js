/**
 * CareTrack Formatters - Formato Clínico y Financiero para Argentina
 */

export function formatARS(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

export function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Evaluación clínica rápida de signos vitales
 * Retorna estado: 'normal' | 'warning' | 'critical'
 */
export function evaluateVitals({ systolic, diastolic, heartRate, oxygenSat, temperature }) {
  const alerts = [];
  let severity = 'normal';

  const sys = Number(systolic);
  const dia = Number(diastolic);
  const hr = Number(heartRate);
  const o2 = Number(oxygenSat);
  const temp = Number(temperature);

  // Saturación de oxígeno
  if (o2 && o2 < 90) {
    alerts.push(`SatO2 Crítica (${o2}%)`);
    severity = 'critical';
  } else if (o2 && o2 < 94) {
    alerts.push(`SatO2 Baja (${o2}%)`);
    if (severity !== 'critical') severity = 'warning';
  }

  // Tensión arterial
  if (sys && (sys > 180 || sys < 90)) {
    alerts.push(`TA Sistólica de Alerta (${sys} mmHg)`);
    severity = 'critical';
  }
  if (dia && (dia > 110 || dia < 50)) {
    alerts.push(`TA Diastólica de Alerta (${dia} mmHg)`);
    severity = 'critical';
  }

  // Frecuencia cardíaca
  if (hr && (hr > 120 || hr < 50)) {
    alerts.push(`FC Anormal (${hr} lpm)`);
    if (severity !== 'critical') severity = 'warning';
  }

  // Temperatura
  if (temp && temp >= 38.5) {
    alerts.push(`Fiebre Alta (${temp}°C)`);
    if (severity !== 'critical') severity = 'warning';
  }

  return {
    severity,
    alerts,
    summary: alerts.length > 0 ? alerts.join(' · ') : 'Signos vitales estables'
  };
}
