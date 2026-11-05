/**
 * CareTrack - Professional Visit & Anti-Debit Verification Engine
 * Engine #245 (ePOD Forensic Signature & WhatsApp OTP) & Engine #159 (Crypto Hash Audit Ledger)
 */

import { sha256 } from '../utils/cryptoSeal.js';
import { evaluateVitals } from '../utils/formatters.js';

export const PROFESSIONAL_FEES = {
  'Enfermería': 12500,
  'Kinesiología / Fisioterapia': 18000,
  'Médico a Domicilio': 26000,
  'Fonoaudiología': 16500,
  'Terapia Ocupacional': 16500,
  'Psicología Domiciliaria': 18000,
  'Nutrición Clínica': 15000
};

export class VisitService {
  constructor(patientRegistry) {
    this.patientRegistry = patientRegistry;
    this.visits = new Map();
    this.otpStore = new Map(); // patientId -> { token, expiresAt, generatedAt }
    this.idCounter = 100;
  }

  generateVisitId() {
    this.idCounter += 1;
    return `VIS-${this.idCounter}-${Date.now().toString(36).slice(-4)}`;
  }

  // 1. Generate 6-digit WhatsApp OTP for cases where patient is alone or incapacitated
  generateOtpToken(patientId, validMinutes = 30) {
    const patient = this.patientRegistry.getPatient(patientId);
    if (!patient) throw new Error(`Paciente no encontrado: ${patientId}`);

    // Generate numeric 6-digit code
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();

    const otpData = {
      token,
      patientId,
      tutorName: patient.tutor.fullName,
      tutorPhone: patient.tutor.phone,
      generatedAt: new Date().toISOString(),
      expiresAt,
      isUsed: false
    };

    this.otpStore.set(patientId, otpData);
    return otpData;
  }

  verifyOtpToken(patientId, tokenInput) {
    const record = this.otpStore.get(patientId);
    if (!record) return { valid: false, reason: 'No se ha solicitado OTP para este paciente' };

    if (record.isUsed) return { valid: false, reason: 'Este código OTP ya fue utilizado' };

    if (new Date() > new Date(record.expiresAt)) {
      return { valid: false, reason: 'El código OTP ha expirado (validez 30 minutos)' };
    }

    if (record.token !== String(tokenInput).trim()) {
      return { valid: false, reason: 'Código OTP incorrecto' };
    }

    record.isUsed = true;
    this.otpStore.set(patientId, record);
    return { valid: true, verifiedAt: new Date().toISOString() };
  }

  // 2. Initial check-in with GPS Geofencing (<60 meters)
  createVisitCheckIn({
    patientId,
    professionalId,
    professionalName,
    specialty,
    currentLat,
    currentLng
  }) {
    const patient = this.patientRegistry.getPatient(patientId);
    if (!patient) throw new Error(`Paciente no encontrado: ${patientId}`);

    if (patient.status !== 'active') {
      throw new Error(`El paciente ${patient.fullName} no está activo (Estado actual: ${patient.status})`);
    }

    // Geofence check
    const geofence = this.patientRegistry.validateGeofence(patientId, currentLat, currentLng, 60);

    const visitId = this.generateVisitId();
    const fee = PROFESSIONAL_FEES[specialty] || 15000;

    const visit = {
      id: visitId,
      patientId,
      patientName: patient.fullName,
      patientDni: patient.dni,
      obraSocial: patient.obraSocial,
      affiliateNumber: patient.affiliateNumber,
      professionalId: String(professionalId || 'PROF-001'),
      professionalName: String(professionalName || 'Profesional de Guardia'),
      specialty: specialty || 'Enfermería',
      fee,
      checkInTime: new Date().toISOString(),
      checkInLocation: {
        lat: Number(currentLat),
        lng: Number(currentLng),
        distanceMeters: geofence.distanceMeters,
        isWithinGeofence: geofence.isWithinGeofence
      },
      status: 'checked_in', // 'checked_in', 'completed', 'disputed'
      vitals: null,
      vitalsEvaluation: null,
      clinicalNote: null,
      verificationMode: null, // 'tactile_signature' | 'whatsapp_otp'
      signatureData: null,
      signerInfo: null,
      hashSeal: null,
      completedAt: null
    };

    this.visits.set(visitId, visit);
    return visit;
  }

  // 3. Complete visit with clinical note, vitals, and cryptographic signature/OTP
  completeVisit({
    visitId,
    vitals = {},
    clinicalNote,
    verificationMode = 'tactile_signature', // 'tactile_signature' | 'whatsapp_otp'
    signatureData = null,
    otpToken = null,
    signerRole = 'Familiar Directo / Tutor',
    signerName = ''
  }) {
    const visit = this.visits.get(visitId);
    if (!visit) throw new Error(`Visita no encontrada: ${visitId}`);

    if (visit.status === 'completed') {
      throw new Error(`La visita ${visitId} ya ha sido finalizada y sellada criptográficamente.`);
    }

    if (!clinicalNote || clinicalNote.trim().length < 10) {
      throw new Error('La evolución clínica es obligatoria (mínimo 10 caracteres explicativos)');
    }

    // Validate Signature or OTP
    let verifiedSigner = null;

    if (verificationMode === 'tactile_signature') {
      if (!signatureData || signatureData.length < 20) {
        throw new Error('La firma táctil del familiar o paciente es obligatoria para certificar la prestación');
      }
      verifiedSigner = {
        role: signerRole,
        name: signerName || 'Familiar Presente',
        mode: 'tactile_signature'
      };
    } else if (verificationMode === 'whatsapp_otp') {
      const otpCheck = this.verifyOtpToken(visit.patientId, otpToken);
      if (!otpCheck.valid) {
        throw new Error(`Falla en verificación OTP: ${otpCheck.reason}`);
      }
      verifiedSigner = {
        role: 'Tutor Legal Remoto',
        name: signerName || 'Tutor vía WhatsApp OTP',
        mode: 'whatsapp_otp',
        verifiedAt: otpCheck.verifiedAt
      };
    } else {
      throw new Error(`Modo de verificación inválido: ${verificationMode}`);
    }

    // Evaluate vitals
    const vitalsEvaluation = evaluateVitals(vitals);

    visit.completedAt = new Date().toISOString();
    visit.vitals = vitals;
    visit.vitalsEvaluation = vitalsEvaluation;
    visit.clinicalNote = String(clinicalNote).trim();
    visit.verificationMode = verificationMode;
    visit.signatureData = signatureData;
    visit.signerInfo = verifiedSigner;
    visit.status = 'completed';

    // Generate SHA-256 seal (Engine #159)
    const sealPayload = JSON.stringify({
      visitId: visit.id,
      patientId: visit.patientId,
      patientDni: visit.patientDni,
      professionalId: visit.professionalId,
      checkInTime: visit.checkInTime,
      completedAt: visit.completedAt,
      distanceMeters: visit.checkInLocation.distanceMeters,
      vitals: visit.vitals,
      clinicalNote: visit.clinicalNote,
      verificationMode: visit.verificationMode,
      signerInfo: visit.signerInfo
    });

    visit.hashSeal = sha256(sealPayload);

    this.visits.set(visitId, visit);
    return visit;
  }

  getVisit(visitId) {
    return this.visits.get(visitId) || null;
  }

  listVisits(filter = {}) {
    let result = Array.from(this.visits.values());

    if (filter.status) {
      result = result.filter(v => v.status === filter.status);
    }
    if (filter.patientId) {
      result = result.filter(v => v.patientId === filter.patientId);
    }
    if (filter.professionalId) {
      result = result.filter(v => v.professionalId === filter.professionalId);
    }
    if (filter.specialty) {
      result = result.filter(v => v.specialty === filter.specialty);
    }

    return result;
  }

  verifyVisitIntegrity(visitId) {
    const visit = this.visits.get(visitId);
    if (!visit) throw new Error(`Visita no encontrada: ${visitId}`);

    if (!visit.hashSeal || visit.status !== 'completed') {
      return { isTampered: false, isCompleted: false, message: 'Visita no completada ni sellada aún' };
    }

    const sealPayload = JSON.stringify({
      visitId: visit.id,
      patientId: visit.patientId,
      patientDni: visit.patientDni,
      professionalId: visit.professionalId,
      checkInTime: visit.checkInTime,
      completedAt: visit.completedAt,
      distanceMeters: visit.checkInLocation.distanceMeters,
      vitals: visit.vitals,
      clinicalNote: visit.clinicalNote,
      verificationMode: visit.verificationMode,
      signerInfo: visit.signerInfo
    });

    const expectedHash = sha256(sealPayload);
    const matches = expectedHash === visit.hashSeal;

    return {
      visitId,
      isTampered: !matches,
      hashMatches: matches,
      currentHash: expectedHash,
      storedSeal: visit.hashSeal
    };
  }
}
