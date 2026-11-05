/**
 * CareTrack - Biomedical Equipment & Comodato Engine
 * Engine #121 (Asset Health Scoring & Calibration) & #120 (Swap Management)
 */

export class BiomedicalEquipmentCatalog {
  constructor() {
    this.equipment = new Map();
    this.idCounter = 100;
  }

  generateId() {
    this.idCounter += 1;
    return `BIO-${this.idCounter}-${Date.now().toString(36).slice(-4)}`;
  }

  registerEquipment(data) {
    if (!data.serialNumber || !data.type || !data.brand) {
      throw new Error('Número de serie, Tipo y Marca son obligatorios');
    }

    // Check duplicate serial
    for (const eq of this.equipment.values()) {
      if (eq.serialNumber === String(data.serialNumber).trim()) {
        throw new Error(`Ya existe un equipo con el número de serie ${data.serialNumber}`);
      }
    }

    const item = {
      id: data.id || this.generateId(),
      serialNumber: String(data.serialNumber).trim(),
      type: String(data.type).trim(), // 'Concentrador de Oxígeno', 'Cama Ortopédica Eléctrica', etc.
      brand: String(data.brand).trim(),
      model: data.model || 'Standard',
      hoursOfUse: Number(data.hoursOfUse) || 0,
      monthlyComodatoFee: Number(data.monthlyComodatoFee) || 0,
      lastCalibrationDate: data.lastCalibrationDate || new Date().toISOString(),
      nextMaintenanceDate: data.nextMaintenanceDate || this.calculateNextMaintenance(data.lastCalibrationDate),
      assignedPatientId: data.assignedPatientId || null,
      assignedAt: data.assignedAt || null,
      status: data.status || 'in_warehouse', // 'in_warehouse', 'assigned', 'maintenance_needed', 'damaged', 'retired'
      notes: data.notes || '',
      createdAt: data.createdAt || new Date().toISOString()
    };

    item.healthScore = this.calculateHealthScore(item);
    this.equipment.set(item.id, item);
    return item;
  }

  calculateNextMaintenance(lastCalibrationIso) {
    const d = lastCalibrationIso ? new Date(lastCalibrationIso) : new Date();
    d.setMonth(d.getMonth() + 6); // 6 months standard biomedical calibration
    return d.toISOString();
  }

  calculateHealthScore(item) {
    let score = 100;

    // Deduct for hours of use
    if (item.hoursOfUse > 10000) score -= 30;
    else if (item.hoursOfUse > 5000) score -= 15;
    else if (item.hoursOfUse > 2000) score -= 5;

    // Check calibration freshness
    if (item.nextMaintenanceDate) {
      const now = new Date();
      const nextMaint = new Date(item.nextMaintenanceDate);
      if (now > nextMaint) {
        score -= 40; // Calibration expired
      } else {
        const daysRemaining = (nextMaint - now) / (1000 * 60 * 60 * 24);
        if (daysRemaining < 30) score -= 15; // Due soon
      }
    }

    if (item.status === 'damaged') score = 0;
    if (item.status === 'maintenance_needed') score = Math.min(score, 40);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  assignToPatient(equipmentId, patientId) {
    const item = this.equipment.get(equipmentId);
    if (!item) throw new Error(`Equipo biomédico no encontrado: ${equipmentId}`);

    if (item.status !== 'in_warehouse') {
      throw new Error(`El equipo ${item.serialNumber} (${item.type}) no está disponible en depósito (Estado actual: ${item.status})`);
    }

    if (item.healthScore < 50) {
      throw new Error(`El equipo ${item.serialNumber} tiene un índice de salud crítico (${item.healthScore}/100) y requiere calibración previa`);
    }

    item.assignedPatientId = patientId;
    item.assignedAt = new Date().toISOString();
    item.status = 'assigned';

    this.equipment.set(equipmentId, item);
    return item;
  }

  unassignFromPatient(equipmentId, destination = 'in_warehouse', returnNotes = '') {
    const item = this.equipment.get(equipmentId);
    if (!item) throw new Error(`Equipo biomédico no encontrado: ${equipmentId}`);

    const previousPatientId = item.assignedPatientId;
    item.assignedPatientId = null;
    item.assignedAt = null;
    item.status = destination; // usually in_warehouse or maintenance_needed
    if (returnNotes) {
      item.notes = `${item.notes ? item.notes + ' | ' : ''}Retorno: ${returnNotes}`;
    }

    item.healthScore = this.calculateHealthScore(item);
    this.equipment.set(equipmentId, item);

    return {
      equipment: item,
      previousPatientId,
      returnedAt: new Date().toISOString()
    };
  }

  getEquipment(id) {
    return this.equipment.get(id) || null;
  }

  getEquipmentBySerial(serialNumber) {
    const clean = String(serialNumber).trim();
    for (const item of this.equipment.values()) {
      if (item.serialNumber === clean) return item;
    }
    return null;
  }

  listEquipment(filter = {}) {
    let result = Array.from(this.equipment.values());

    if (filter.status) {
      result = result.filter(e => e.status === filter.status);
    }
    if (filter.type) {
      result = result.filter(e => e.type.toLowerCase().includes(filter.type.toLowerCase()));
    }
    if (filter.patientId) {
      result = result.filter(e => e.assignedPatientId === filter.patientId);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(e =>
        e.serialNumber.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.brand.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q)
      );
    }

    return result;
  }

  findAvailableReplacement(type, minHealthScore = 70) {
    const available = Array.from(this.equipment.values()).filter(e =>
      e.type === type &&
      e.status === 'in_warehouse' &&
      e.healthScore >= minHealthScore
    );

    // Return the one with highest health score
    return available.sort((a, b) => b.healthScore - a.healthScore)[0] || null;
  }
}
