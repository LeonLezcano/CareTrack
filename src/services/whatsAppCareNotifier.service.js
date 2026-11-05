/**
 * CareTrack - WhatsApp E.164 Notification Engine
 * Engine #108 & #157 (Client & Family Real-Time Notifier)
 */

export class WhatsAppCareNotifier {
  static cleanPhoneNumber(phone) {
    if (!phone) return '';
    // Strip non-digits except initial '+'
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '549' + cleaned.slice(1);
    } else if (cleaned.startsWith('+549')) {
      cleaned = cleaned.slice(1);
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }
    // Default to Argentina E.164 if missing country code
    if (!cleaned.startsWith('549') && cleaned.length === 10) {
      cleaned = '549' + cleaned;
    }
    return cleaned;
  }

  static generateOtpWhatsAppUrl({ tutorPhone, tutorName, patientName, professionalName, token }) {
    const cleanPhone = this.cleanPhoneNumber(tutorPhone);
    const text = 
      `Hola *${tutorName || 'Tutor'}*, el profesional *${professionalName}* está presente en el domicilio del paciente *${patientName}*.\n\n` +
      `🔑 Su código de validación y consentimiento de visita médica es: *${token}*\n\n` +
      `⏱️ Este código tiene validez por 30 minutos.\n` +
      `_CareTrack - Internación Domiciliaria Segura_`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  static generateVitalsAlertWhatsAppUrl({ tutorPhone, tutorName, patientName, professionalName, vitals, summary }) {
    const cleanPhone = this.cleanPhoneNumber(tutorPhone);
    const vitalsText = vitals
      ? `• TA: ${vitals.systolic || '-'}/${vitals.diastolic || '-'} mmHg\n• SatO2: ${vitals.oxygenSat || '-'}%\n• Frecuencia Cardíaca: ${vitals.heartRate || '-'} lpm\n• Temperatura: ${vitals.temperature || '-'}°C`
      : 'Signos vitales registrados en ficha';

    const text =
      `📋 *CareTrack - Reporte de Evolución Domiciliaria*\n\n` +
      `Estimado/a *${tutorName || 'Familiar'}*, se ha completado la visita de *${professionalName}* para el paciente *${patientName}*.\n\n` +
      `🩺 *Signos Vitales:*\n${vitalsText}\n\n` +
      `💡 *Estado:* ${summary || 'Estable'}\n\n` +
      `_La atención ha sido certificada con firma digital y sello criptográfico auditado._`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  static generateEmergencySwapWhatsAppUrl({ technicianPhone, orderId, patientName, patientAddress, equipmentType, serialNumber, issueDescription }) {
    const cleanPhone = this.cleanPhoneNumber(technicianPhone);
    const text =
      `🚨 *ALERTA URGENTE 24/7 - RECAMBIO BIOMÉDICO (SWAP)* 🚨\n\n` +
      `Orden: *${orderId}*\n` +
      `Paciente: *${patientName}*\n` +
      `Dirección: *${patientAddress}*\n` +
      `Equipo Averiado: *${equipmentType}* (S/N: ${serialNumber})\n` +
      `Falla Reportada: ${issueDescription}\n\n` +
      `⚠️ *SLA de Entrega: Menos de 120 minutos.*\n` +
      `_Despacho inmediato CareTrack Biomédica._`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  static generateEquipmentRecallWhatsAppUrl({ tutorPhone, patientName, equipmentType, serialNumber }) {
    const cleanPhone = this.cleanPhoneNumber(tutorPhone);
    const text =
      `📦 *CareTrack - Coordinación de Retiro de Equipamiento en Comodato*\n\n` +
      `Estimada familia del paciente *${patientName}*:\n` +
      `Ante la actualización del plan de cuidados o alta médica, coordinamos el retiro seguro del equipo *${equipmentType}* (S/N: ${serialNumber}).\n\n` +
      `Por favor responda a este mensaje para coordinar la franja horaria de visita de nuestro técnico.\n` +
      `Muchas gracias.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }
}
