/**
 * CareTrack - Patient Registry & Geofence Validator
 * Engine #167 (Haversine Geofencing) & Clinical Care Level Registry
 */

export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180;
  
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance in meters
}

export class PatientRegistry {
  constructor() {
    this.patients = new Map();
    this.idCounter = 100;
  }

  generateId() {
    this.idCounter += 1;
    return `PAT-${this.idCounter}-${Date.now().toString(36).slice(-4)}`;
  }

  registerPatient(data) {
    if (!data.dni || !data.fullName || !data.obraSocial) {
      throw new Error('DNI, Nombre Completo y Obra Social son obligatorios');
    }

    // Check duplicate DNI among active patients
    for (const pat of this.patients.values()) {
      if (pat.dni === String(data.dni).trim() && pat.status === 'active') {
        throw new Error(`Ya existe un paciente activo con el DNI ${data.dni}`);
      }
    }

    const patient = {
      id: data.id || this.generateId(),
      dni: String(data.dni).trim(),
      fullName: String(data.fullName).trim(),
      birthDate: data.birthDate || null,
      address: data.address || '',
      coordinates: {
        lat: Number(data.coordinates?.lat) || -34.6037, // Default Buenos Aires
        lng: Number(data.coordinates?.lng) || -58.3816
      },
      obraSocial: String(data.obraSocial).trim(),
      affiliateNumber: String(data.affiliateNumber || '').trim(),
      plan: data.plan || 'General',
      diagnosis: data.diagnosis || 'CIE-10 Sin especificar',
      careLevel: data.careLevel || 'Media Complejidad', // Baja, Media, Alta Complejidad
      tutor: {
        fullName: data.tutor?.fullName || 'Familiar / Tutor',
        relationship: data.tutor?.relationship || 'Familiar directo',
        phone: data.tutor?.phone || '+5491100000000',
        email: data.tutor?.email || ''
      },
      assignedStaff: Array.isArray(data.assignedStaff) ? data.assignedStaff : [],
      status: 'active', // active, hospitalized, discharged, deceased
      dischargeReason: null,
      dischargeDate: null,
      createdAt: data.createdAt || new Date().toISOString()
    };

    this.patients.set(patient.id, patient);
    return patient;
  }

  updatePatient(id, updates) {
    const patient = this.patients.get(id);
    if (!patient) throw new Error(`Paciente no encontrado: ${id}`);

    const safeUpdates = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates.createdAt;

    if (safeUpdates.coordinates) {
      safeUpdates.coordinates = {
        lat: Number(safeUpdates.coordinates.lat) || patient.coordinates.lat,
        lng: Number(safeUpdates.coordinates.lng) || patient.coordinates.lng
      };
    }

    Object.assign(patient, safeUpdates);
    this.patients.set(id, patient);
    return patient;
  }

  getPatient(id) {
    return this.patients.get(id) || null;
  }

  findPatientByDni(dni) {
    const cleanDni = String(dni).trim();
    for (const pat of this.patients.values()) {
      if (pat.dni === cleanDni) return pat;
    }
    return null;
  }

  listPatients(filter = {}) {
    let result = Array.from(this.patients.values());

    if (filter.status) {
      result = result.filter(p => p.status === filter.status);
    }
    if (filter.obraSocial) {
      result = result.filter(p => p.obraSocial.toLowerCase().includes(filter.obraSocial.toLowerCase()));
    }
    if (filter.careLevel) {
      result = result.filter(p => p.careLevel === filter.careLevel);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(p =>
        p.fullName.toLowerCase().includes(q) ||
        p.dni.includes(q) ||
        p.address.toLowerCase().includes(q)
      );
    }

    return result;
  }

  dischargePatient(id, reason = 'Alta Médica') {
    const patient = this.patients.get(id);
    if (!patient) throw new Error(`Paciente no encontrado: ${id}`);

    patient.status = 'discharged';
    patient.dischargeReason = reason;
    patient.dischargeDate = new Date().toISOString();

    return {
      patient,
      pendingEquipmentAlert: true,
      message: `Paciente dado de alta. Alerta generada para retiro y rescate de equipamiento biomédico dentro de las 48hs.`
    };
  }

  validateGeofence(patientId, currentLat, currentLng, maxDistanceMeters = 60) {
    const patient = this.patients.get(patientId);
    if (!patient) {
      throw new Error(`Paciente no encontrado para validación GPS: ${patientId}`);
    }

    const distance = calculateHaversineDistance(
      patient.coordinates.lat,
      patient.coordinates.lng,
      Number(currentLat),
      Number(currentLng)
    );

    const isWithinGeofence = distance <= maxDistanceMeters;

    return {
      patientId,
      targetLat: patient.coordinates.lat,
      targetLng: patient.coordinates.lng,
      currentLat: Number(currentLat),
      currentLng: Number(currentLng),
      distanceMeters: distance,
      maxAllowedMeters: maxDistanceMeters,
      isWithinGeofence,
      verifiedAt: new Date().toISOString()
    };
  }
}
