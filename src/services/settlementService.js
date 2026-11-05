/**
 * CareTrack - Settlement & Obra Social Batch Engine
 * Engine #134 (Insurance Billing Batches) & Engine #132 (Professional Commission Settlement)
 * Zero-External-Dependencies Universal CSV Exporter with UTF-8 BOM (Directiva 17)
 */

import { sha256 } from '../utils/cryptoSeal.js';
import { formatARS } from '../utils/formatters.js';

export class SettlementService {
  constructor(visitService, biomedicalCatalog, patientRegistry) {
    this.visitService = visitService;
    this.biomedicalCatalog = biomedicalCatalog;
    this.patientRegistry = patientRegistry;
    this.obraSocialBatches = new Map();
    this.professionalLiquidations = new Map();
    this.batchCounter = 100;
  }

  generateBatchId() {
    this.batchCounter += 1;
    return `LOT-${this.batchCounter}-${Date.now().toString(36).slice(-4)}`;
  }

  // 1. Generate Obra Social Batch for a given month and OS
  generateObraSocialBatch({ obraSocial, periodYearMonth }) {
    if (!obraSocial || !periodYearMonth) {
      throw new Error('Obra Social y Período (AAAA-MM) son obligatorios');
    }

    const cleanOs = obraSocial.trim();
    const period = periodYearMonth.trim();

    // Find all completed visits for patients with this Obra Social in the period
    const allVisits = this.visitService.listVisits({ status: 'completed' });
    const eligibleVisits = allVisits.filter(v => {
      const isSameOs = v.obraSocial.toLowerCase() === cleanOs.toLowerCase();
      const isSamePeriod = v.completedAt && v.completedAt.startsWith(period);
      return isSameOs && isSamePeriod;
    });

    // Check for audit risks (débito risk)
    const auditAnomalies = [];
    eligibleVisits.forEach(v => {
      if (!v.hashSeal) {
        auditAnomalies.push(`Visita ${v.id} sin sello criptográfico SHA-256`);
      }
      if (!v.checkInLocation.isWithinGeofence) {
        auditAnomalies.push(`Visita ${v.id} fuera del perímetro geográfico (${v.checkInLocation.distanceMeters}m > 60m)`);
      }
    });

    const totalVisitsAmount = eligibleVisits.reduce((acc, v) => acc + (v.fee || 0), 0);

    // Calculate Comodato Equipment Fees for active patients of this Obra Social
    const activePatients = this.patientRegistry.listPatients({ status: 'active' })
      .filter(p => p.obraSocial.toLowerCase() === cleanOs.toLowerCase());
    
    const activePatientIds = new Set(activePatients.map(p => p.id));
    const allAssignedEquipment = this.biomedicalCatalog.listEquipment({ status: 'assigned' });
    
    const coveredEquipment = allAssignedEquipment.filter(e => activePatientIds.has(e.assignedPatientId));
    const totalComodatoAmount = coveredEquipment.reduce((acc, e) => acc + (e.monthlyComodatoFee || 0), 0);

    const grandTotal = totalVisitsAmount + totalComodatoAmount;
    const batchId = this.generateBatchId();

    const batch = {
      id: batchId,
      obraSocial: cleanOs,
      period,
      generatedAt: new Date().toISOString(),
      visitsCount: eligibleVisits.length,
      visitsTotal: totalVisitsAmount,
      equipmentCount: coveredEquipment.length,
      comodatoTotal: totalComodatoAmount,
      grandTotal,
      auditStatus: auditAnomalies.length === 0 ? 'audited_zero_debit_risk' : 'requires_review',
      auditAnomalies,
      visitsList: eligibleVisits.map(v => ({
        visitId: v.id,
        patientName: v.patientName,
        patientDni: v.patientDni,
        specialty: v.specialty,
        fee: v.fee,
        verifiedMode: v.verificationMode,
        completedAt: v.completedAt,
        hashSeal: v.hashSeal
      })),
      equipmentList: coveredEquipment.map(e => ({
        equipmentId: e.id,
        type: e.type,
        serialNumber: e.serialNumber,
        assignedPatientId: e.assignedPatientId,
        monthlyFee: e.monthlyComodatoFee
      })),
      batchHash: null
    };

    // Cryptographic batch seal
    const payload = JSON.stringify({
      batchId,
      obraSocial: batch.obraSocial,
      period: batch.period,
      visitsCount: batch.visitsCount,
      grandTotal: batch.grandTotal,
      generatedAt: batch.generatedAt
    });
    batch.batchHash = sha256(payload);

    this.obraSocialBatches.set(batchId, batch);
    return batch;
  }

  // 2. Liquidate professional fees
  liquidateProfessionalFees(professionalId, periodYearMonth) {
    const visits = this.visitService.listVisits({ status: 'completed' })
      .filter(v => v.professionalId === professionalId && (!periodYearMonth || v.completedAt.startsWith(periodYearMonth)));

    if (visits.length === 0) {
      throw new Error(`No hay visitas completadas para el profesional ${professionalId} en el período`);
    }

    const professionalName = visits[0].professionalName;
    const specialty = visits[0].specialty;
    const totalEarned = visits.reduce((sum, v) => sum + (v.fee || 0), 0);
    const liqId = `LIQ-${professionalId}-${Date.now().toString(36).slice(-4)}`;

    const liquidation = {
      id: liqId,
      professionalId,
      professionalName,
      specialty,
      period: periodYearMonth || 'Acumulado',
      generatedAt: new Date().toISOString(),
      visitsCount: visits.length,
      totalEarned,
      status: 'pending_payment', // 'pending_payment', 'settled'
      visitsIds: visits.map(v => v.id)
    };

    this.professionalLiquidations.set(liqId, liquidation);
    return liquidation;
  }

  // 3. Native UTF-8 BOM CSV Exporter for Batch (Directiva 17)
  exportBatchCSV(batchId) {
    const batch = this.obraSocialBatches.get(batchId);
    if (!batch) throw new Error(`Lote no encontrado: ${batchId}`);

    const lines = [];
    lines.push(`LOTE DE LIQUIDACIÓN OBRA SOCIAL - CARETRACK`);
    lines.push(`Lote ID;${batch.id}`);
    lines.push(`Obra Social;${batch.obraSocial}`);
    lines.push(`Período;${batch.period}`);
    lines.push(`Total Prestaciones;${formatARS(batch.grandTotal)}`);
    lines.push(`Estado Auditoría;${batch.auditStatus}`);
    lines.push(`Sello Hash;${batch.batchHash}`);
    lines.push(``);
    lines.push(`DETALLE DE VISITAS CERTIFICADAS`);
    lines.push(`ID Visita;Paciente;DNI;Especialidad;Importe ARS;Modo Validación;Fecha Finalización;Hash Auditoría`);

    batch.visitsList.forEach(v => {
      lines.push(
        `"${v.visitId}";"${v.patientName}";"${v.patientDni}";"${v.specialty}";"${v.fee}";"${v.verifiedMode}";"${v.completedAt}";"${v.hashSeal}"`
      );
    });

    lines.push(``);
    lines.push(`DETALLE DE COMODATOS DE EQUIPAMIENTO`);
    lines.push(`ID Equipo;Tipo;Número de Serie;ID Paciente;Abono Mensual ARS`);

    batch.equipmentList.forEach(e => {
      lines.push(
        `"${e.equipmentId}";"${e.type}";"${e.serialNumber}";"${e.assignedPatientId}";"${e.monthlyFee}"`
      );
    });

    // Add BOM (\uFEFF) for Excel on Windows
    return '\uFEFF' + lines.join('\r\n');
  }

  getBatch(batchId) {
    return this.obraSocialBatches.get(batchId) || null;
  }

  listBatches() {
    return Array.from(this.obraSocialBatches.values());
  }

  getLiquidation(liqId) {
    return this.professionalLiquidations.get(liqId) || null;
  }

  listLiquidations() {
    return Array.from(this.professionalLiquidations.values());
  }
}
