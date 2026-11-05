/**
 * CareTrack - 24/7 Biomedical Emergency Swap Engine
 * Engine #120 (Zero Downtime Swap Workshop) & SLA Sentinel (<120 minutes)
 */

import { sha256 } from '../utils/cryptoSeal.js';

export class EmergencySwapService {
  constructor(biomedicalCatalog, patientRegistry) {
    this.catalog = biomedicalCatalog;
    this.patientRegistry = patientRegistry;
    this.orders = new Map();
    this.idCounter = 100;
  }

  generateOrderId() {
    this.idCounter += 1;
    return `EMG-${this.idCounter}-${Date.now().toString(36).slice(-4)}`;
  }

  createEmergencyOrder({
    patientId,
    failingEquipmentId,
    issueDescription,
    reporterName = 'Familiar de Guardia',
    reporterPhone = ''
  }) {
    const patient = this.patientRegistry.getPatient(patientId);
    if (!patient) throw new Error(`Paciente no encontrado: ${patientId}`);

    const failingEquipment = this.catalog.getEquipment(failingEquipmentId);
    if (!failingEquipment) {
      throw new Error(`Equipo biomédico averiado no encontrado: ${failingEquipmentId}`);
    }

    if (failingEquipment.assignedPatientId !== patientId) {
      throw new Error(`El equipo ${failingEquipment.serialNumber} no está registrado en el domicilio del paciente ${patient.fullName}`);
    }

    if (!issueDescription || issueDescription.trim().length < 5) {
      throw new Error('Debe describir la falla o anomalía del equipo biomédico');
    }

    // Auto-search available replacement in warehouse
    const replacement = this.catalog.findAvailableReplacement(failingEquipment.type, 70);

    const now = new Date();
    const targetSlaDeadline = new Date(now.getTime() + 120 * 60 * 1000); // 2 hours SLA
    const orderId = this.generateOrderId();

    const order = {
      id: orderId,
      patientId,
      patientName: patient.fullName,
      patientAddress: patient.address,
      patientPhone: reporterPhone || patient.tutor.phone,
      failingEquipmentId,
      failingEquipmentSerial: failingEquipment.serialNumber,
      equipmentType: failingEquipment.type,
      issueDescription: String(issueDescription).trim(),
      suggestedReplacementId: replacement ? replacement.id : null,
      suggestedReplacementSerial: replacement ? replacement.serialNumber : null,
      status: 'dispatched', // 'dispatched', 'in_transit', 'completed', 'cancelled'
      slaMinutesTarget: 120,
      createdAt: now.toISOString(),
      slaDeadline: targetSlaDeadline.toISOString(),
      dispatchedTechnician: null,
      replacementEquipmentId: null,
      replacementEquipmentSerial: null,
      handoverSignature: null,
      swapNotes: null,
      completedAt: null,
      turnaroundMinutes: null,
      isWithinSla: null,
      hashSeal: null
    };

    this.orders.set(orderId, order);
    return order;
  }

  assignTechnician(orderId, technicianName, technicianPhone = '') {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Orden de emergencia no encontrada: ${orderId}`);

    if (order.status === 'completed') {
      throw new Error(`La orden ${orderId} ya ha sido completada`);
    }

    order.dispatchedTechnician = {
      name: String(technicianName).trim(),
      phone: String(technicianPhone).trim(),
      assignedAt: new Date().toISOString()
    };
    order.status = 'in_transit';

    this.orders.set(orderId, order);
    return order;
  }

  executeSwap({
    orderId,
    replacementEquipmentId,
    familySignature,
    failureDiagnosticNotes = 'Equipo descalibrado / alarma persistente'
  }) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Orden de emergencia no encontrada: ${orderId}`);

    if (order.status === 'completed') {
      throw new Error(`La orden ${orderId} ya fue ejecutada`);
    }

    if (!familySignature || familySignature.length < 20) {
      throw new Error('Es obligatoria la firma de conformidad del familiar al recibir el equipo sustituto');
    }

    const replacement = this.catalog.getEquipment(replacementEquipmentId);
    if (!replacement) {
      throw new Error(`Equipo sustituto no encontrado: ${replacementEquipmentId}`);
    }

    if (replacement.status !== 'in_warehouse') {
      throw new Error(`El equipo sustituto ${replacement.serialNumber} no está disponible en depósito`);
    }

    const now = new Date();
    const created = new Date(order.createdAt);
    const turnaroundMinutes = Math.round((now - created) / (1000 * 60));
    const isWithinSla = turnaroundMinutes <= order.slaMinutesTarget;

    // 1. Unassign failing equipment from patient and send to maintenance
    this.catalog.unassignFromPatient(
      order.failingEquipmentId,
      'maintenance_needed',
      `Falla en domicilio paciente ${order.patientName}: ${order.issueDescription} (${failureDiagnosticNotes})`
    );

    // 2. Assign replacement equipment to patient
    this.catalog.assignToPatient(replacementEquipmentId, order.patientId);

    // 3. Complete order
    order.status = 'completed';
    order.completedAt = now.toISOString();
    order.replacementEquipmentId = replacement.id;
    order.replacementEquipmentSerial = replacement.serialNumber;
    order.handoverSignature = familySignature;
    order.swapNotes = String(failureDiagnosticNotes).trim();
    order.turnaroundMinutes = turnaroundMinutes;
    order.isWithinSla = isWithinSla;

    // Cryptographic seal of the emergency swap
    const sealPayload = JSON.stringify({
      orderId: order.id,
      patientId: order.patientId,
      failingEquipmentId: order.failingEquipmentId,
      failingSerial: order.failingEquipmentSerial,
      replacementEquipmentId: order.replacementEquipmentId,
      replacementSerial: order.replacementEquipmentSerial,
      completedAt: order.completedAt,
      turnaroundMinutes,
      isWithinSla
    });

    order.hashSeal = sha256(sealPayload);

    this.orders.set(orderId, order);
    return order;
  }

  getSlaStatus(orderId) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);

    const now = new Date();
    const deadline = new Date(order.slaDeadline);

    if (order.status === 'completed') {
      return {
        orderId,
        status: 'completed',
        turnaroundMinutes: order.turnaroundMinutes,
        isWithinSla: order.isWithinSla,
        message: order.isWithinSla
          ? `Resuelto dentro de SLA (${order.turnaroundMinutes} min)`
          : `Resuelto fuera de SLA (${order.turnaroundMinutes} min > 120 min)`
      };
    }

    const remainingMinutes = Math.round((deadline - now) / (1000 * 60));
    const isOverdue = remainingMinutes < 0;

    return {
      orderId,
      status: order.status,
      remainingMinutes,
      isOverdue,
      message: isOverdue
        ? `ALERTA ROJA: SLA VENCIDO hace ${Math.abs(remainingMinutes)} minutos!`
        : `Tiempo restante SLA: ${remainingMinutes} minutos`
    };
  }

  getOrder(orderId) {
    return this.orders.get(orderId) || null;
  }

  listOrders(filter = {}) {
    let result = Array.from(this.orders.values());

    if (filter.status) {
      result = result.filter(o => o.status === filter.status);
    }
    if (filter.patientId) {
      result = result.filter(o => o.patientId === filter.patientId);
    }

    return result;
  }
}
