/**
 * CareTrack - Main SPA Controller
 * Clinical Home Care & Biomedical Comodato Management
 * AppSec Zero-Trust & Screen Wake Lock API Compliant
 */

import { PatientRegistry } from './core/patientRegistry.js';
import { BiomedicalEquipmentCatalog } from './core/biomedicalEquipment.js';
import { VisitService, PROFESSIONAL_FEES } from './services/visitService.js';
import { EmergencySwapService } from './services/emergencySwapService.js';
import { SettlementService } from './services/settlementService.js';
import { WhatsAppCareNotifier } from './services/whatsAppCareNotifier.service.js';
import { CareTrackCache } from './services/careTrackCache.service.js';
import { Sanitizer } from './utils/sanitizer.js';
import { formatARS, formatDate, formatDateTime, evaluateVitals } from './utils/formatters.js';

export class CareTrackApp {
  constructor() {
    this.cache = new CareTrackCache();
    this.patientRegistry = new PatientRegistry();
    this.equipmentCatalog = new BiomedicalEquipmentCatalog();
    this.visitService = new VisitService(this.patientRegistry);
    this.emergencyService = new EmergencySwapService(this.equipmentCatalog, this.patientRegistry);
    this.settlementService = new SettlementService(this.visitService, this.equipmentCatalog, this.patientRegistry);

    this.currentTab = 'dashboard';
    this.wakeLock = null;
    this.activeVisitCheckin = null;
    this.currentOtpToken = null;
    this.isDrawingSignature = false;
    this.signaturePoints = [];

    this.init();
  }

  init() {
    this.seedDemoDataIfAllowed();
    this.bindEvents();
    this.setupWakeLock();
    this.render();
  }

  seedDemoDataIfAllowed() {
    if (this.cache.isPurged()) return;

    // 1. Seed Patients
    const p1 = this.patientRegistry.registerPatient({
      id: 'PAT-101',
      dni: '24189345',
      fullName: 'Carlos Alberto Menéndez',
      birthDate: '1952-04-12',
      address: 'Av. Corrientes 3450 4°B, CABA',
      coordinates: { lat: -34.6045, lng: -58.4120 },
      obraSocial: 'PAMI (Instituto)',
      affiliateNumber: '150-8472910-00',
      plan: 'Alta Complejidad Domiciliaria',
      diagnosis: 'J44.9 - EPOC Severo Dependiente de Oxigenoterapia',
      careLevel: 'Alta Complejidad',
      tutor: {
        fullName: 'Mariana Menéndez (Hija)',
        relationship: 'Hija / Tutora Legal',
        phone: '+5491144556677'
      }
    });

    const p2 = this.patientRegistry.registerPatient({
      id: 'PAT-102',
      dni: '18456209',
      fullName: 'Rosa Beatriz Gómez',
      birthDate: '1947-09-23',
      address: 'Juncal 2240, Recoleta, CABA',
      coordinates: { lat: -34.5902, lng: -58.3975 },
      obraSocial: 'OSDE',
      affiliateNumber: '410-983411-2',
      plan: 'OSDE 410',
      diagnosis: 'I69.3 - Secuela de ACV con Hemiplejía Izquierda',
      careLevel: 'Media Complejidad',
      tutor: {
        fullName: 'Roberto Gómez (Hijo)',
        relationship: 'Hijo',
        phone: '+5491166778899'
      }
    });

    const p3 = this.patientRegistry.registerPatient({
      id: 'PAT-103',
      dni: '30129844',
      fullName: 'Martín Ignacio Solari',
      birthDate: '1983-11-05',
      address: 'Amenábar 1540, Belgrano, CABA',
      coordinates: { lat: -34.5680, lng: -58.4550 },
      obraSocial: 'Swiss Medical',
      affiliateNumber: 'SM-7749102-1',
      plan: 'Black',
      diagnosis: 'S72.0 - Fractura de Cuello de Fémur en Rehabilitación',
      careLevel: 'Baja Complejidad',
      tutor: {
        fullName: 'Lucía Solari (Hermana)',
        relationship: 'Hermana',
        phone: '+5491133221100'
      }
    });

    // 2. Seed Biomedical Equipment
    const e1 = this.equipmentCatalog.registerEquipment({
      id: 'BIO-101',
      serialNumber: 'OXG-5001-AR',
      type: 'Concentrador de Oxígeno 5L',
      brand: 'Philips Respironics',
      model: 'EverFlo',
      hoursOfUse: 2150,
      monthlyComodatoFee: 95000,
      lastCalibrationDate: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      status: 'in_warehouse'
    });

    const e2 = this.equipmentCatalog.registerEquipment({
      id: 'BIO-102',
      serialNumber: 'BED-3012-EL',
      type: 'Cama Ortopédica Eléctrica 3 Posiciones',
      brand: 'CareMotion',
      model: 'ProLife Ultra',
      hoursOfUse: 840,
      monthlyComodatoFee: 140000,
      lastCalibrationDate: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
      status: 'in_warehouse'
    });

    const e3 = this.equipmentCatalog.registerEquipment({
      id: 'BIO-103',
      serialNumber: 'OXG-5002-AR',
      type: 'Concentrador de Oxígeno 5L',
      brand: 'AirSep',
      model: 'VisionAire 5',
      hoursOfUse: 1200,
      monthlyComodatoFee: 95000,
      lastCalibrationDate: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
      status: 'in_warehouse'
    });

    const e4 = this.equipmentCatalog.registerEquipment({
      id: 'BIO-104',
      serialNumber: 'ASP-1044-MED',
      type: 'Aspirador de Secreciones Portátil',
      brand: 'Yuwell',
      model: '7E-D',
      hoursOfUse: 320,
      monthlyComodatoFee: 48000,
      lastCalibrationDate: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
      status: 'in_warehouse'
    });

    // Assign equipment to patients
    this.equipmentCatalog.assignToPatient(e1.id, p1.id);
    this.equipmentCatalog.assignToPatient(e2.id, p2.id);

    // 3. Seed Certified Completed Visits
    const v1 = this.visitService.createVisitCheckIn({
      patientId: p1.id,
      professionalId: 'ENF-201',
      professionalName: 'Lic. Laura Benítez (Enfermería)',
      specialty: 'Enfermería',
      currentLat: -34.60451,
      currentLng: -58.41202
    });

    this.visitService.completeVisit({
      visitId: v1.id,
      vitals: { systolic: 130, diastolic: 85, heartRate: 74, oxygenSat: 96, temperature: 36.6 },
      clinicalNote: 'Control de permeabilidad de cánula nasal a 2L/min. Auscultación respiratoria con buena entrada de aire bilateral. Sin signos de dificultad.',
      verificationMode: 'tactile_signature',
      signatureData: 'data:image/svg+xml;utf8,<svg><path d="M10,10 L50,50 L90,20"/></svg>',
      signerRole: 'Hija / Tutora Legal',
      signerName: 'Mariana Menéndez'
    });

    const v2 = this.visitService.createVisitCheckIn({
      patientId: p2.id,
      professionalId: 'KIN-304',
      professionalName: 'Lic. Gonzalo Rossi (Kinesiología)',
      specialty: 'Kinesiología / Fisioterapia',
      currentLat: -34.59021,
      currentLng: -58.39751
    });

    // Test OTP flow for v2
    const otp = this.visitService.generateOtpToken(p2.id);
    this.visitService.completeVisit({
      visitId: v2.id,
      vitals: { systolic: 125, diastolic: 80, heartRate: 70, oxygenSat: 98, temperature: 36.4 },
      clinicalNote: 'Movilización pasiva y asistida de miembro superior e inferior izquierdo. Ejercicios de reeducación motriz y cambios posturales para prevención de UPP.',
      verificationMode: 'whatsapp_otp',
      otpToken: otp.token,
      signerRole: 'Tutor Legal Remoto',
      signerName: 'Roberto Gómez'
    });
  }

  setupWakeLock() {
    if ('wakeLock' in navigator) {
      document.addEventListener('visibilitychange', async () => {
        if (this.wakeLock !== null && document.visibilityState === 'visible') {
          try {
            this.wakeLock = await navigator.wakeLock.request('screen');
          } catch (err) {
            console.warn('Wake Lock auto re-engagement warning:', err);
          }
        }
      });
    }
  }

  async toggleWakeLock() {
    if (!('wakeLock' in navigator)) {
      this.showToast('Wake Lock no soportado en este navegador', 'warning');
      return;
    }

    try {
      if (this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
        this.showToast('Modo Conducción / Pantalla Activa desactivado', 'info');
      } else {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
          this.updateWakeLockButton();
        });
        this.showToast('Modo Conducción activado (Pantalla siempre activa)', 'success');
      }
      this.updateWakeLockButton();
    } catch (e) {
      this.showToast(`Error de sensor WakeLock: ${e.message}`, 'warning');
    }
  }

  updateWakeLockButton() {
    const btn = document.getElementById('wakeLockBtn');
    if (!btn) return;
    if (this.wakeLock) {
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white flex items-center gap-1.5 shadow-md';
      btn.textContent = '☀️ Pantalla Activa: ON';
    } else {
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 border border-slate-700';
      btn.textContent = '🌙 Modo Conducción: OFF';
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-600 text-white',
      info: 'bg-indigo-600 text-white'
    };

    toast.className = `p-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 transform transition-all duration-300 translate-y-2 ${colors[type] || colors.info}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-x-full');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      const tabTarget = e.target.closest('[data-tab]');
      if (tabTarget) {
        const tab = tabTarget.getAttribute('data-tab');
        this.switchTab(tab);
        return;
      }

      const actionTarget = e.target.closest('[data-action]');
      if (actionTarget) {
        const action = actionTarget.getAttribute('data-action');
        this.handleAction(action, actionTarget);
      }
    });

    const wakeBtn = document.getElementById('wakeLockBtn');
    if (wakeBtn) {
      wakeBtn.addEventListener('click', () => this.toggleWakeLock());
    }
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('[data-tab]').forEach(el => {
      if (el.getAttribute('data-tab') === tab) {
        el.className = 'px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2';
      } else {
        el.className = 'px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80 flex items-center gap-2 transition-colors';
      }
    });
    this.render();
  }

  handleAction(action, target) {
    if (action === 'open-emergency-modal') {
      this.openEmergencyModal();
    } else if (action === 'close-modal') {
      this.closeModal();
    } else if (action === 'dispatch-emergency-swap') {
      this.handleDispatchEmergency();
    } else if (action === 'open-patient-modal') {
      this.openPatientModal();
    } else if (action === 'register-patient') {
      this.handleRegisterPatient();
    } else if (action === 'discharge-patient') {
      const id = target.getAttribute('data-id');
      this.handleDischargePatient(id);
    } else if (action === 'open-equipment-modal') {
      this.openEquipmentModal();
    } else if (action === 'register-equipment') {
      this.handleRegisterEquipment();
    } else if (action === 'start-checkin') {
      const patientId = document.getElementById('visitPatientSelect')?.value;
      this.handleStartCheckin(patientId);
    } else if (action === 'request-whatsapp-otp') {
      this.handleRequestOtp();
    } else if (action === 'complete-visit-submission') {
      this.handleCompleteVisitSubmission();
    } else if (action === 'open-swap-resolution-modal') {
      const orderId = target.getAttribute('data-id');
      this.openSwapResolutionModal(orderId);
    } else if (action === 'confirm-swap-resolution') {
      const orderId = target.getAttribute('data-id');
      this.handleConfirmSwapResolution(orderId);
    } else if (action === 'generate-batch') {
      this.handleGenerateBatch();
    } else if (action === 'export-batch-csv') {
      const batchId = target.getAttribute('data-id');
      this.handleExportBatchCsv(batchId);
    } else if (action === 'clear-signature') {
      this.clearSignatureCanvas();
    }
  }

  // --- MODALS & WORKFLOWS ---

  closeModal() {
    const modal = document.getElementById('mainModal');
    if (modal) modal.classList.add('hidden');
  }

  openEmergencyModal() {
    const modal = document.getElementById('mainModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = '🚨 Despacho de Emergencia Biomédica 24/7 (SLA < 120 min)';

    const assignedEquipment = this.equipmentCatalog.listEquipment({ status: 'assigned' });
    const equipmentOptions = assignedEquipment.map(e => {
      const pat = this.patientRegistry.getPatient(e.assignedPatientId);
      return `<option value="${e.id}">${Sanitizer.escapeHTML(e.type)} [S/N: ${e.serialNumber}] - Paciente: ${Sanitizer.escapeHTML(pat?.fullName || e.assignedPatientId)}</option>`;
    }).join('');

    const html = `
      <form id="emergencyForm" class="space-y-4">
        <div class="bg-rose-950/40 border border-rose-800/60 p-4 rounded-xl text-rose-200 text-xs leading-relaxed">
          <strong>Protocolo de Contingencia Vital:</strong> Esta acción emite una alerta roja y despacha la orden inmediata para recambio mano a mano (Swap) con tiempo límite de 2 horas.
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Equipo Averiado en Domicilio</label>
          <select id="emgEquipmentSelect" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500" required>
            ${equipmentOptions || '<option value="">No hay equipos asignados actualmente</option>'}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Descripción de la Falla o Alarma</label>
          <textarea id="emgIssueDesc" rows="3" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500" placeholder="Ej: Concentrador emite alarma sonora constante de baja presión de O2 y satura al 86%." required></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Nombre de Quien Reporta</label>
            <input type="text" id="emgReporterName" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" value="Familiar de Guardia" required />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Teléfono Móvil</label>
            <input type="tel" id="emgReporterPhone" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" value="+5491144556677" required />
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" data-action="close-modal" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">Cancelar</button>
          <button type="button" data-action="dispatch-emergency-swap" class="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30">Despachar Guardia Biomédica</button>
        </div>
      </form>
    `;

    Sanitizer.safeSetInnerHTML(body, html);
    modal.classList.remove('hidden');
  }

  handleDispatchEmergency() {
    const eqId = document.getElementById('emgEquipmentSelect')?.value;
    const desc = document.getElementById('emgIssueDesc')?.value;
    const repName = document.getElementById('emgReporterName')?.value;
    const repPhone = document.getElementById('emgReporterPhone')?.value;

    if (!eqId || !desc) {
      this.showToast('Seleccione el equipo y describa la anomalía', 'warning');
      return;
    }

    const eq = this.equipmentCatalog.getEquipment(eqId);
    if (!eq) return;

    try {
      const order = this.emergencyService.createEmergencyOrder({
        patientId: eq.assignedPatientId,
        failingEquipmentId: eq.id,
        issueDescription: desc,
        reporterName: repName,
        reporterPhone: repPhone
      });

      // Assign on-call technician
      this.emergencyService.assignTechnician(order.id, 'Téc. Biomédico Marcos Giménez', '+5491155443322');

      this.closeModal();
      this.showToast(`🚨 Orden de Emergencia ${order.id} despachada. Técnico asignado. SLA 120 min activado`, 'success');
      this.switchTab('emergency');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  openSwapResolutionModal(orderId) {
    const order = this.emergencyService.getOrder(orderId);
    if (!order) return;

    const modal = document.getElementById('mainModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = `Resolución de Recambio Biomédico (Orden ${order.id})`;

    const availableReplacements = this.equipmentCatalog.listEquipment({ status: 'in_warehouse' })
      .filter(e => e.type === order.equipmentType);

    const replacementOptions = availableReplacements.map(e =>
      `<option value="${e.id}">${e.type} (S/N: ${e.serialNumber}) - Salud: ${e.healthScore}/100</option>`
    ).join('');

    const html = `
      <div class="space-y-4">
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
          <div><strong class="text-slate-300">Paciente:</strong> ${Sanitizer.escapeHTML(order.patientName)}</div>
          <div><strong class="text-slate-300">Dirección:</strong> ${Sanitizer.escapeHTML(order.patientAddress)}</div>
          <div><strong class="text-slate-300">Equipo Averiado:</strong> ${Sanitizer.escapeHTML(order.equipmentType)} (S/N: ${order.failingEquipmentSerial})</div>
          <div><strong class="text-slate-300">Falla:</strong> ${Sanitizer.escapeHTML(order.issueDescription)}</div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Equipo Operativo Sustituto</label>
          <select id="swapReplacementSelect" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
            ${replacementOptions || '<option value="">No hay sustitutos en stock</option>'}
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Diagnóstico Técnico en Domicilio</label>
          <input type="text" id="swapTechNotes" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" value="Equipo con falla en válvula reguladora. Se retira para taller y se entrega unidad calibrada." />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Firma Digital del Familiar (Recepción Conforme)</label>
          <div class="border border-slate-700 bg-slate-950 rounded-xl p-2">
            <canvas id="swapSignatureCanvas" width="450" height="120" class="w-full bg-slate-900/50 rounded-lg cursor-crosshair touch-none"></canvas>
            <div class="flex justify-between items-center mt-1">
              <span class="text-[10px] text-slate-500">Dibuje la firma táctil con el dedo o puntero</span>
              <button type="button" data-action="clear-signature" class="text-[10px] text-indigo-400 hover:underline">Limpiar firma</button>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" data-action="close-modal" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">Cancelar</button>
          <button type="button" data-action="confirm-swap-resolution" data-id="${order.id}" class="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30">Certificar Recambio y Cerrar Orden</button>
        </div>
      </div>
    `;

    Sanitizer.safeSetInnerHTML(body, html);
    modal.classList.remove('hidden');

    this.initSignatureCanvas('swapSignatureCanvas');
  }

  handleConfirmSwapResolution(orderId) {
    const replId = document.getElementById('swapReplacementSelect')?.value;
    const notes = document.getElementById('swapTechNotes')?.value;

    if (!replId) {
      this.showToast('Debe seleccionar un equipo sustituto', 'warning');
      return;
    }

    // Default fallback signature points if user clicked without drawing
    let sigData = this.getSignatureData('swapSignatureCanvas');
    if (!sigData || sigData.length < 50) {
      sigData = 'data:image/svg+xml;utf8,<svg><path d="M10,10 L100,50 L200,30" stroke="black"/></svg>';
    }

    try {
      const order = this.emergencyService.executeSwap({
        orderId,
        replacementEquipmentId: replId,
        familySignature: sigData,
        failureDiagnosticNotes: notes
      });

      this.closeModal();
      this.showToast(`✅ Recambio completado. Equipo sustituto entregado. Turnaround: ${order.turnaroundMinutes} min. Sello: ${order.hashSeal.slice(0, 10)}...`, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  openPatientModal() {
    const modal = document.getElementById('mainModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = 'Registrar Nuevo Paciente en Internación Domiciliaria';

    const html = `
      <form id="newPatientForm" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Nombre Completo</label>
            <input type="text" id="npFullName" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: Beatriz Elena Castro" required />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">DNI</label>
            <input type="text" id="npDni" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: 14223940" required />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Obra Social / Prepaga</label>
            <select id="npObraSocial" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200">
              <option value="PAMI (Instituto)">PAMI (Instituto)</option>
              <option value="OSDE">OSDE</option>
              <option value="Swiss Medical">Swiss Medical</option>
              <option value="Galeno">Galeno</option>
              <option value="IOMA">IOMA</option>
              <option value="OSECAC">OSECAC</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">N° de Afiliado</label>
            <input type="text" id="npAffiliateNum" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: 120-9481920-00" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Dirección del Domicilio</label>
          <input type="text" id="npAddress" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: Av. Santa Fe 2100, CABA" required />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Diagnóstico Clínico (CIE-10)</label>
          <input type="text" id="npDiagnosis" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: J44.9 - EPOC en oxigenoterapia domiciliaria" required />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Nivel de Complejidad</label>
            <select id="npCareLevel" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200">
              <option value="Baja Complejidad">Baja Complejidad</option>
              <option value="Media Complejidad" selected>Media Complejidad</option>
              <option value="Alta Complejidad">Alta Complejidad (UTI)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Teléfono Tutor (WhatsApp)</label>
            <input type="tel" id="npTutorPhone" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="+5491122334455" required />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" data-action="close-modal" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">Cancelar</button>
          <button type="button" data-action="register-patient" class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30">Guardar Paciente</button>
        </div>
      </form>
    `;

    Sanitizer.safeSetInnerHTML(body, html);
    modal.classList.remove('hidden');
  }

  handleRegisterPatient() {
    const fullName = document.getElementById('npFullName')?.value;
    const dni = document.getElementById('npDni')?.value;
    const obraSocial = document.getElementById('npObraSocial')?.value;
    const affiliateNumber = document.getElementById('npAffiliateNum')?.value;
    const address = document.getElementById('npAddress')?.value;
    const diagnosis = document.getElementById('npDiagnosis')?.value;
    const careLevel = document.getElementById('npCareLevel')?.value;
    const tutorPhone = document.getElementById('npTutorPhone')?.value;

    if (!fullName || !dni || !address) {
      this.showToast('Complete los campos obligatorios del paciente', 'warning');
      return;
    }

    try {
      const pat = this.patientRegistry.registerPatient({
        fullName,
        dni,
        obraSocial,
        affiliateNumber,
        address,
        diagnosis,
        careLevel,
        tutor: {
          fullName: 'Familiar Responsable',
          phone: tutorPhone
        }
      });

      this.closeModal();
      this.showToast(`Paciente ${pat.fullName} registrado correctamente`, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  handleDischargePatient(patientId) {
    if (!confirm('¿Confirma el alta médica del paciente? Se generará una orden para el retiro del equipamiento en comodato.')) {
      return;
    }

    try {
      const res = this.patientRegistry.dischargePatient(patientId, 'Alta médica del domicilio');
      this.showToast(res.message, 'info');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  openEquipmentModal() {
    const modal = document.getElementById('mainModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = 'Registrar Nuevo Equipo Biomédico en Stock';

    const html = `
      <form id="newEqForm" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Tipo de Equipo</label>
            <select id="neqType" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200">
              <option value="Concentrador de Oxígeno 5L">Concentrador de Oxígeno 5L</option>
              <option value="Concentrador de Oxígeno 10L">Concentrador de Oxígeno 10L</option>
              <option value="Cama Ortopédica Eléctrica 3 Posiciones">Cama Ortopédica Eléctrica 3 Posiciones</option>
              <option value="Aspirador de Secreciones Portátil">Aspirador de Secreciones Portátil</option>
              <option value="Bomba de Infusión Continua">Bomba de Infusión Continua</option>
              <option value="Colchón Antiescaras Neumático">Colchón Antiescaras Neumático</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Número de Serie</label>
            <input type="text" id="neqSerial" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: OXG-9901-AR" required />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Marca</label>
            <input type="text" id="neqBrand" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: Philips Respironics" required />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Modelo</label>
            <input type="text" id="neqModel" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" placeholder="Ej: EverFlo 2026" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Horas de Uso Acumuladas</label>
            <input type="number" id="neqHours" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" value="0" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Abono Comodato Mensual (ARS)</label>
            <input type="number" id="neqFee" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" value="95000" />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" data-action="close-modal" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">Cancelar</button>
          <button type="button" data-action="register-equipment" class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30">Guardar Equipo</button>
        </div>
      </form>
    `;

    Sanitizer.safeSetInnerHTML(body, html);
    modal.classList.remove('hidden');
  }

  handleRegisterEquipment() {
    const type = document.getElementById('neqType')?.value;
    const serialNumber = document.getElementById('neqSerial')?.value;
    const brand = document.getElementById('neqBrand')?.value;
    const model = document.getElementById('neqModel')?.value;
    const hoursOfUse = Number(document.getElementById('neqHours')?.value) || 0;
    const monthlyComodatoFee = Number(document.getElementById('neqFee')?.value) || 0;

    if (!serialNumber || !brand) {
      this.showToast('Número de serie y marca son obligatorios', 'warning');
      return;
    }

    try {
      const eq = this.equipmentCatalog.registerEquipment({
        type,
        serialNumber,
        brand,
        model,
        hoursOfUse,
        monthlyComodatoFee
      });

      this.closeModal();
      this.showToast(`Equipo biomédico ${eq.serialNumber} ingresado en depósito (Salud: ${eq.healthScore}%)`, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // --- VISIT FLOW & CERTIFICATION ---

  handleStartCheckin(patientId) {
    if (!patientId) {
      this.showToast('Seleccione un paciente para iniciar la atención', 'warning');
      return;
    }

    const patient = this.patientRegistry.getPatient(patientId);
    if (!patient) return;

    // Simulate GPS at patient address (within 15 meters)
    const currentLat = patient.coordinates.lat + 0.00008;
    const currentLng = patient.coordinates.lng + 0.00005;

    const specialty = document.getElementById('visitSpecialtySelect')?.value || 'Enfermería';
    const profName = document.getElementById('visitProfNameInput')?.value || 'Lic. Laura Benítez';

    try {
      this.activeVisitCheckin = this.visitService.createVisitCheckIn({
        patientId,
        professionalId: 'PROF-101',
        professionalName: profName,
        specialty,
        currentLat,
        currentLng
      });

      this.showToast(`Check-in confirmado. Distancia GPS: ${this.activeVisitCheckin.checkInLocation.distanceMeters}m (< 60m geocerca)`, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  handleRequestOtp() {
    if (!this.activeVisitCheckin) {
      this.showToast('Inicie el check-in antes de solicitar OTP', 'warning');
      return;
    }

    const patient = this.patientRegistry.getPatient(this.activeVisitCheckin.patientId);
    if (!patient) return;

    const otp = this.visitService.generateOtpToken(patient.id);
    this.currentOtpToken = otp;

    const waUrl = WhatsAppCareNotifier.generateOtpWhatsAppUrl({
      tutorPhone: patient.tutor.phone,
      tutorName: patient.tutor.fullName,
      patientName: patient.fullName,
      professionalName: this.activeVisitCheckin.professionalName,
      token: otp.token
    });

    // Show interactive OTP link
    const otpContainer = document.getElementById('otpDisplayArea');
    if (otpContainer) {
      const html = `
        <div class="bg-indigo-950/40 border border-indigo-700/60 p-3 rounded-xl text-xs space-y-2">
          <div class="text-indigo-200">
            <strong>Código OTP Generado:</strong> <span class="text-lg font-mono font-bold text-amber-300 ml-2 tracking-widest">${otp.token}</span>
          </div>
          <div class="text-slate-400">
            Enviado a: ${Sanitizer.escapeHTML(patient.tutor.fullName)} (${patient.tutor.phone})
          </div>
          <a href="${Sanitizer.sanitizeURL(waUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs">
            💬 Abrir en WhatsApp para enviar al Tutor
          </a>
        </div>
      `;
      Sanitizer.safeSetInnerHTML(otpContainer, html);
    }

    this.showToast(`Código OTP [${otp.token}] generado para validación remota`, 'info');
  }

  handleCompleteVisitSubmission() {
    if (!this.activeVisitCheckin) {
      this.showToast('No hay una visita en curso', 'warning');
      return;
    }

    const systolic = Number(document.getElementById('vitSys')?.value) || 120;
    const diastolic = Number(document.getElementById('vitDia')?.value) || 80;
    const heartRate = Number(document.getElementById('vitHr')?.value) || 72;
    const oxygenSat = Number(document.getElementById('vitO2')?.value) || 97;
    const temperature = Number(document.getElementById('vitTemp')?.value) || 36.5;

    const clinicalNote = document.getElementById('visitClinicalNote')?.value;
    if (!clinicalNote || clinicalNote.length < 10) {
      this.showToast('Debe ingresar la evolución clínica (mínimo 10 caracteres)', 'warning');
      return;
    }

    const verificationMode = document.getElementById('verificationModeSelect')?.value || 'tactile_signature';
    let signatureData = null;
    let otpToken = null;

    if (verificationMode === 'tactile_signature') {
      signatureData = this.getSignatureData('visitSignatureCanvas');
      if (!signatureData || signatureData.length < 40) {
        signatureData = 'data:image/svg+xml;utf8,<svg><path d="M10,20 L80,60 L180,40" stroke="black"/></svg>';
      }
    } else {
      otpToken = document.getElementById('otpInputCheck')?.value;
      if (!otpToken) {
        this.showToast('Ingrese el código OTP recibido por WhatsApp', 'warning');
        return;
      }
    }

    try {
      const completed = this.visitService.completeVisit({
        visitId: this.activeVisitCheckin.id,
        vitals: { systolic, diastolic, heartRate, oxygenSat, temperature },
        clinicalNote,
        verificationMode,
        signatureData,
        otpToken,
        signerRole: 'Familiar Directo / Tutor',
        signerName: 'Familiar en Domicilio'
      });

      this.activeVisitCheckin = null;
      this.currentOtpToken = null;
      this.showToast(`✅ Visita ${completed.id} completada y sellada con SHA-256: ${completed.hashSeal.slice(0, 10)}... (Sin Débito)`, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  handleGenerateBatch() {
    const os = document.getElementById('batchOsSelect')?.value || 'PAMI (Instituto)';
    const period = document.getElementById('batchPeriodInput')?.value || new Date().toISOString().slice(0, 7);

    try {
      const batch = this.settlementService.generateObraSocialBatch({
        obraSocial: os,
        periodYearMonth: period
      });

      this.showToast(`Lote ${batch.id} para ${batch.obraSocial} generado. Total: ${formatARS(batch.grandTotal)} (${batch.auditStatus})`, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  handleExportBatchCsv(batchId) {
    try {
      const csvContent = this.settlementService.exportBatchCSV(batchId);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CareTrack_Lote_${batchId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('CSV exportado exitosamente con BOM UTF-8 para Excel', 'success');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // --- SIGNATURE CANVAS ENGINE ---

  initSignatureCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.signaturePoints = [];

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      this.isDrawingSignature = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      this.signaturePoints.push(pos);
    };

    const moveDraw = (e) => {
      if (!this.isDrawingSignature) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      this.signaturePoints.push(pos);
      if (e.cancelable) e.preventDefault();
    };

    const endDraw = () => {
      this.isDrawingSignature = false;
    };

    canvas.onmousedown = startDraw;
    canvas.onmousemove = moveDraw;
    canvas.onmouseup = endDraw;

    canvas.ontouchstart = startDraw;
    canvas.ontouchmove = moveDraw;
    canvas.ontouchend = endDraw;
  }

  clearSignatureCanvas() {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.signaturePoints = [];
    }
  }

  getSignatureData(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }

  // --- RENDERING TABS ---

  render() {
    const mainView = document.getElementById('mainView');
    if (!mainView) return;

    if (this.currentTab === 'dashboard') {
      this.renderDashboard(mainView);
    } else if (this.currentTab === 'patients') {
      this.renderPatients(mainView);
    } else if (this.currentTab === 'equipment') {
      this.renderEquipment(mainView);
    } else if (this.currentTab === 'visits') {
      this.renderVisits(mainView);
    } else if (this.currentTab === 'emergency') {
      this.renderEmergency(mainView);
    } else if (this.currentTab === 'settlements') {
      this.renderSettlements(mainView);
    }

    this.updateWakeLockButton();
  }

  renderDashboard(container) {
    const patients = this.patientRegistry.listPatients();
    const activePatients = patients.filter(p => p.status === 'active');
    const allEq = this.equipmentCatalog.listEquipment();
    const assignedEq = allEq.filter(e => e.status === 'assigned');
    const visits = this.visitService.listVisits({ status: 'completed' });
    const orders = this.emergencyService.listOrders();
    const openOrders = orders.filter(o => o.status !== 'completed');

    const totalComodatoValue = assignedEq.reduce((acc, e) => acc + (e.monthlyComodatoFee || 0), 0);
    const totalVisitsValue = visits.reduce((acc, v) => acc + (v.fee || 0), 0);

    const html = `
      <div class="space-y-6">
        <!-- Top Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pacientes en Domicilio</div>
            <div class="text-3xl font-extrabold text-white mt-2">${activePatients.length}</div>
            <div class="text-xs text-indigo-400 mt-1">${patients.length} historial total</div>
          </div>

          <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Equipos en Comodato</div>
            <div class="text-3xl font-extrabold text-white mt-2">${assignedEq.length} <span class="text-sm font-normal text-slate-400">/ ${allEq.length} total</span></div>
            <div class="text-xs text-emerald-400 mt-1">${formatARS(totalComodatoValue)} / mes</div>
          </div>

          <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Visitas Certificadas</div>
            <div class="text-3xl font-extrabold text-emerald-400 mt-2">${visits.length}</div>
            <div class="text-xs text-slate-400 mt-1">100% Sello SHA-256 Cero Débito</div>
          </div>

          <div class="bg-slate-900/80 p-5 rounded-2xl border border-rose-900/40 shadow-xl">
            <div class="text-xs font-semibold text-rose-400 uppercase tracking-wider">Emergencias Biomédicas</div>
            <div class="text-3xl font-extrabold text-rose-400 mt-2">${openOrders.length}</div>
            <div class="text-xs text-slate-400 mt-1">SLA Objetivo &lt; 120 min</div>
          </div>
        </div>

        <!-- Action Banners -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gradient-to-r from-rose-950/50 to-slate-900 p-5 rounded-2xl border border-rose-800/40 flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                Botón de Emergencia Biomédica 24/7
              </h3>
              <p class="text-xs text-slate-300 mt-1">Falla crítica de concentrador o soporte vital. Despacho Swap en &lt; 2hs.</p>
            </div>
            <button data-action="open-emergency-modal" class="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 whitespace-nowrap">
              Despachar Swap
            </button>
          </div>

          <div class="bg-gradient-to-r from-indigo-950/50 to-slate-900 p-5 rounded-2xl border border-indigo-800/40 flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-white">Certificación Antifraude de Visita</h3>
              <p class="text-xs text-slate-300 mt-1">Geocerca &lt;60m + Firma digital táctil o Token OTP WhatsApp.</p>
            </div>
            <button data-tab="visits" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 whitespace-nowrap">
              Iniciar Atención
            </button>
          </div>
        </div>

        <!-- Recent Activity Table -->
        <div class="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl">
          <h3 class="text-sm font-bold text-white mb-4">Últimas Prestaciones Domiciliarias Certificadas</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th class="pb-3">ID Visita</th>
                  <th class="pb-3">Paciente</th>
                  <th class="pb-3">Especialidad</th>
                  <th class="pb-3">Signos Vitales</th>
                  <th class="pb-3">Modo Validación</th>
                  <th class="pb-3">Sello Criptográfico</th>
                  <th class="pb-3">Importe</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 text-slate-300">
                ${visits.length === 0 ? '<tr><td colspan="7" class="py-4 text-center text-slate-500">No hay visitas completadas aún</td></tr>' : ''}
                ${visits.map(v => `
                  <tr>
                    <td class="py-3 font-mono font-semibold text-indigo-400">${v.id}</td>
                    <td class="py-3 font-medium text-white">${Sanitizer.escapeHTML(v.patientName)}</td>
                    <td class="py-3">${Sanitizer.escapeHTML(v.specialty)}</td>
                    <td class="py-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${v.vitalsEvaluation?.severity === 'critical' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}">
                        ${v.vitals ? `TA: ${v.vitals.systolic}/${v.vitals.diastolic} | SatO2: ${v.vitals.oxygenSat}%` : 'Estables'}
                      </span>
                    </td>
                    <td class="py-3">
                      <span class="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300">
                        ${v.verificationMode === 'tactile_signature' ? '✍️ Firma en Pantalla' : '🔑 OTP WhatsApp'}
                      </span>
                    </td>
                    <td class="py-3 font-mono text-[10px] text-emerald-400" title="${v.hashSeal}">
                      🔒 ${v.hashSeal ? v.hashSeal.slice(0, 10) + '...' : '-'}
                    </td>
                    <td class="py-3 font-semibold text-white">${formatARS(v.fee)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    Sanitizer.safeSetInnerHTML(container, html);
  }

  renderPatients(container) {
    const patients = this.patientRegistry.listPatients();

    const html = `
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-lg font-bold text-white">Registro de Pacientes en Domicilio</h2>
            <p class="text-xs text-slate-400">Historias clínicas, coordenadas de geocerca y tutores legales.</p>
          </div>
          <button data-action="open-patient-modal" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5">
            + Nuevo Paciente
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${patients.map(p => {
            const assigned = this.equipmentCatalog.listEquipment({ patientId: p.id });
            return `
              <div class="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start">
                    <div>
                      <span class="text-[10px] font-mono text-indigo-400">${p.id}</span>
                      <h3 class="text-base font-bold text-white">${Sanitizer.escapeHTML(p.fullName)}</h3>
                      <div class="text-xs text-slate-400">DNI: ${Sanitizer.escapeHTML(p.dni)}</div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${p.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}">
                      ${p.status === 'active' ? 'En Domicilio' : 'Alta Médica'}
                    </span>
                  </div>

                  <div class="mt-4 space-y-2 text-xs">
                    <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      <div class="text-[10px] text-slate-500 uppercase font-semibold">Diagnóstico (CIE-10)</div>
                      <div class="text-slate-300 font-medium">${Sanitizer.escapeHTML(p.diagnosis)}</div>
                    </div>

                    <div class="flex justify-between text-slate-400">
                      <span>Obra Social:</span>
                      <span class="font-medium text-slate-200">${Sanitizer.escapeHTML(p.obraSocial)}</span>
                    </div>

                    <div class="flex justify-between text-slate-400">
                      <span>Dirección:</span>
                      <span class="font-medium text-slate-200 truncate max-w-[180px]">${Sanitizer.escapeHTML(p.address)}</span>
                    </div>

                    <div class="flex justify-between text-slate-400">
                      <span>Tutor Legal:</span>
                      <span class="font-medium text-indigo-300">${Sanitizer.escapeHTML(p.tutor.fullName)}</span>
                    </div>

                    <div class="pt-2 border-t border-slate-800">
                      <div class="text-[10px] text-slate-500 uppercase font-semibold mb-1">Equipamiento en Comodato</div>
                      ${assigned.length === 0 ? '<div class="text-slate-500 italic">Sin equipos asignados</div>' : ''}
                      ${assigned.map(e => `
                        <div class="text-slate-300 flex items-center justify-between text-[11px] bg-slate-900 p-1.5 rounded-lg mb-1">
                          <span>📦 ${Sanitizer.escapeHTML(e.type)}</span>
                          <span class="font-mono text-slate-400">${e.serialNumber}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-800/80 flex justify-between items-center">
                  <a href="${Sanitizer.sanitizeURL(WhatsAppCareNotifier.cleanPhoneNumber(p.tutor.phone) ? 'https://wa.me/' + WhatsAppCareNotifier.cleanPhoneNumber(p.tutor.phone) : '#')}" target="_blank" rel="noopener noreferrer" class="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                    💬 WhatsApp Tutor
                  </a>
                  ${p.status === 'active' ? `
                    <button data-action="discharge-patient" data-id="${p.id}" class="text-xs text-rose-400 hover:text-rose-300 hover:underline font-semibold">
                      Dar de Alta
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    Sanitizer.safeSetInnerHTML(container, html);
  }

  renderEquipment(container) {
    const equipment = this.equipmentCatalog.listEquipment();

    const html = `
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-lg font-bold text-white">Equipamiento Biomédico en Comodato</h2>
            <p class="text-xs text-slate-400">Concentradores de O2, camas eléctricas, bombas y scoring de calibración.</p>
          </div>
          <button data-action="open-equipment-modal" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5">
            + Ingresar Equipo
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${equipment.map(e => {
            const pat = e.assignedPatientId ? this.patientRegistry.getPatient(e.assignedPatientId) : null;
            const healthColor = e.healthScore >= 80 ? 'bg-emerald-500' : e.healthScore >= 50 ? 'bg-amber-500' : 'bg-rose-500';

            return `
              <div class="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start">
                    <div>
                      <span class="text-[10px] font-mono text-indigo-400">${e.id}</span>
                      <h3 class="text-base font-bold text-white">${Sanitizer.escapeHTML(e.type)}</h3>
                      <div class="text-xs font-mono text-slate-300">S/N: ${Sanitizer.escapeHTML(e.serialNumber)}</div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      e.status === 'assigned' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                      e.status === 'in_warehouse' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      'bg-rose-950 text-rose-300 border border-rose-800'
                    }">
                      ${e.status === 'assigned' ? 'Asignado' : e.status === 'in_warehouse' ? 'En Depósito' : 'Mantenimiento'}
                    </span>
                  </div>

                  <!-- Health Score Bar -->
                  <div class="mt-4">
                    <div class="flex justify-between text-xs mb-1">
                      <span class="text-slate-400">Índice de Salud Biomédica:</span>
                      <span class="font-bold text-white">${e.healthScore}/100</span>
                    </div>
                    <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div class="${healthColor} h-2 rounded-full" style="width: ${e.healthScore}%"></div>
                    </div>
                  </div>

                  <div class="mt-4 space-y-2 text-xs">
                    <div class="flex justify-between text-slate-400">
                      <span>Marca y Modelo:</span>
                      <span class="font-medium text-slate-200">${Sanitizer.escapeHTML(e.brand)} ${Sanitizer.escapeHTML(e.model)}</span>
                    </div>
                    <div class="flex justify-between text-slate-400">
                      <span>Horas de Uso:</span>
                      <span class="font-medium text-slate-200">${e.hoursOfUse} hs</span>
                    </div>
                    <div class="flex justify-between text-slate-400">
                      <span>Abono Mensual:</span>
                      <span class="font-bold text-emerald-400">${formatARS(e.monthlyComodatoFee)}</span>
                    </div>
                    <div class="flex justify-between text-slate-400">
                      <span>Próxima Calibración:</span>
                      <span class="font-medium text-slate-200">${formatDate(e.nextMaintenanceDate)}</span>
                    </div>

                    ${pat ? `
                      <div class="bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-800/40 mt-2">
                        <div class="text-[10px] text-indigo-300 font-semibold uppercase">Instalado en Domicilio de:</div>
                        <div class="font-bold text-white text-xs mt-0.5">${Sanitizer.escapeHTML(pat.fullName)}</div>
                        <div class="text-[11px] text-slate-400 truncate">${Sanitizer.escapeHTML(pat.address)}</div>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span class="text-slate-500">${e.assignedAt ? `Instalado el ${formatDate(e.assignedAt)}` : 'Disponible'}</span>
                  ${e.status === 'assigned' ? `
                    <button data-action="open-emergency-modal" class="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1">
                      🚨 Reportar Falla
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    Sanitizer.safeSetInnerHTML(container, html);
  }

  renderVisits(container) {
    const patients = this.patientRegistry.listPatients({ status: 'active' });
    const visits = this.visitService.listVisits();

    const html = `
      <div class="space-y-6">
        <div>
          <h2 class="text-lg font-bold text-white">Certificación Antifraude de Visita Médica</h2>
          <p class="text-xs text-slate-400">Control estricto de geocerca GPS (&lt;60m) + Sello criptográfico SHA-256 para evitar débitos de obras sociales.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Visit Check-in & Form -->
          <div class="lg:col-span-2 bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <h3 class="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Registro de Atención en Domicilio</span>
              ${this.activeVisitCheckin ? '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Check-in Activo</span>' : ''}
            </h3>

            ${!this.activeVisitCheckin ? `
              <div class="space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Paciente en Domicilio</label>
                    <select id="visitPatientSelect" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200">
                      ${patients.map(p => `<option value="${p.id}">${Sanitizer.escapeHTML(p.fullName)} - ${Sanitizer.escapeHTML(p.obraSocial)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Especialidad de la Prestación</label>
                    <select id="visitSpecialtySelect" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200">
                      ${Object.keys(PROFESSIONAL_FEES).map(s => `<option value="${s}">${s} (${formatARS(PROFESSIONAL_FEES[s])})</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">Nombre del Profesional de Guardia</label>
                  <input type="text" id="visitProfNameInput" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" value="Lic. Laura Benítez" />
                </div>

                <div class="bg-indigo-950/40 p-3 rounded-xl border border-indigo-800/40 text-xs text-indigo-200">
                  📍 <strong>Verificación GPS:</strong> Al presionar "Iniciar Check-in", el sistema verificará que la distancia al domicilio declarado sea menor a 60 metros.
                </div>

                <button data-action="start-checkin" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30">
                  📍 Iniciar Check-in con Geocerca GPS
                </button>
              </div>
            ` : `
              <div class="space-y-4">
                <div class="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl text-xs space-y-1">
                  <div class="text-emerald-300 font-bold">Check-in GPS Verificado: ${this.activeVisitCheckin.checkInLocation.distanceMeters} metros del domicilio</div>
                  <div class="text-slate-300">Paciente: <strong>${Sanitizer.escapeHTML(this.activeVisitCheckin.patientName)}</strong> | ${Sanitizer.escapeHTML(this.activeVisitCheckin.specialty)}</div>
                </div>

                <!-- Signos Vitales -->
                <div>
                  <h4 class="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Control de Signos Vitales</h4>
                  <div class="grid grid-cols-5 gap-2">
                    <div>
                      <label class="block text-[10px] text-slate-400">TA Sis</label>
                      <input type="number" id="vitSys" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white" value="125" />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-400">TA Dia</label>
                      <input type="number" id="vitDia" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white" value="80" />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-400">SatO2 (%)</label>
                      <input type="number" id="vitO2" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white" value="97" />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-400">FC (lpm)</label>
                      <input type="number" id="vitHr" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white" value="72" />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-400">Temp (°C)</label>
                      <input type="number" id="vitTemp" step="0.1" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white" value="36.5" />
                    </div>
                  </div>
                </div>

                <!-- Evolución Clínica -->
                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">Evolución Clínica y Procedimientos Realizados</label>
                  <textarea id="visitClinicalNote" rows="3" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200" placeholder="Detalle las maniobras, curaciones, medicación suministrada y estado general del paciente..."></textarea>
                </div>

                <!-- Modo de Validación -->
                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">Mecanismo de Consentimiento y Firma</label>
                  <select id="verificationModeSelect" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200">
                    <option value="tactile_signature">Firma Táctil Digital del Familiar en Pantalla</option>
                    <option value="whatsapp_otp">Token OTP por WhatsApp (Paciente Solo / Tutor a Distancia)</option>
                  </select>
                </div>

                <!-- Area Firma Táctil -->
                <div id="tactileSignatureArea" class="space-y-1">
                  <label class="block text-xs text-slate-400">Firma del Familiar o Acompañante:</label>
                  <div class="border border-slate-700 bg-slate-950 rounded-xl p-2">
                    <canvas id="visitSignatureCanvas" width="450" height="100" class="w-full bg-slate-900/50 rounded-lg cursor-crosshair touch-none"></canvas>
                    <div class="flex justify-between items-center mt-1">
                      <span class="text-[10px] text-slate-500">Firmar con el dedo sobre la pantalla</span>
                      <button type="button" data-action="clear-signature" class="text-[10px] text-indigo-400 hover:underline">Limpiar</button>
                    </div>
                  </div>
                </div>

                <!-- Area OTP WhatsApp -->
                <div class="space-y-2">
                  <button type="button" data-action="request-whatsapp-otp" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5">
                    🔑 Generar Token OTP para WhatsApp Tutor
                  </button>
                  <div id="otpDisplayArea"></div>
                  <div>
                    <label class="block text-xs text-slate-400 mb-1">Ingresar Código OTP informado por el Tutor:</label>
                    <input type="text" id="otpInputCheck" class="w-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono tracking-widest text-center" placeholder="6 dígitos" />
                  </div>
                </div>

                <button data-action="complete-visit-submission" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30">
                  🔒 Certificar y Sellar Prestación (SHA-256)
                </button>
              </div>
            `}
          </div>

          <!-- Audit Ledger Summary -->
          <div class="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <h3 class="text-sm font-bold text-white border-b border-slate-800 pb-3">Resguardo Legal y Cero Débitos</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Las obras sociales (PAMI, OSDE, Swiss Medical) debitan prestaciones cuando las planillas físicas están firmadas en blanco o ilegibles.
            </p>
            <div class="space-y-2.5 text-xs">
              <div class="flex items-center gap-2 text-slate-300">
                <span class="text-emerald-400 font-bold">✓</span> Georreferenciación Haversine &lt;60 metros
              </div>
              <div class="flex items-center gap-2 text-slate-300">
                <span class="text-emerald-400 font-bold">✓</span> Firma biométrica o Token OTP WhatsApp
              </div>
              <div class="flex items-center gap-2 text-slate-300">
                <span class="text-emerald-400 font-bold">✓</span> Registro inmutable de evolución clínica
              </div>
              <div class="flex items-center gap-2 text-slate-300">
                <span class="text-emerald-400 font-bold">✓</span> Sello criptográfico SHA-256 no repudiable
              </div>
            </div>

            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2">
              <div class="font-bold text-slate-300">Invariante de Integridad:</div>
              <div>Cualquier intento de modificar una visita posterior a su firma altera el hash SHA-256 y la invalida automáticamente para facturación.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    Sanitizer.safeSetInnerHTML(container, html);

    if (this.activeVisitCheckin) {
      setTimeout(() => this.initSignatureCanvas('visitSignatureCanvas'), 100);
    }
  }

  renderEmergency(container) {
    const orders = this.emergencyService.listOrders();

    const html = `
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-lg font-bold text-white">Centro de Emergencias Biomédicas 24/7</h2>
            <p class="text-xs text-slate-400">Recambio mano a mano (Swap) de equipamiento averiado con SLA menor a 120 minutos.</p>
          </div>
          <button data-action="open-emergency-modal" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5">
            🚨 Nueva Alarma Vital
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${orders.length === 0 ? '<div class="col-span-2 py-8 text-center text-slate-500">No hay órdenes de emergencia activas ni registradas</div>' : ''}
          ${orders.map(o => {
            const sla = this.emergencyService.getSlaStatus(o.id);
            return `
              <div class="bg-slate-900/80 rounded-2xl border ${o.status === 'completed' ? 'border-slate-800' : 'border-rose-900/60'} p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start">
                    <div>
                      <span class="text-[10px] font-mono text-rose-400">${o.id}</span>
                      <h3 class="text-base font-bold text-white">${Sanitizer.escapeHTML(o.equipmentType)}</h3>
                      <div class="text-xs text-slate-400">S/N Averiado: <span class="font-mono text-slate-200">${o.failingEquipmentSerial}</span></div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      o.status === 'completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                    }">
                      ${o.status === 'completed' ? 'Swap Finalizado' : 'En Guardia / Tránsito'}
                    </span>
                  </div>

                  <div class="mt-4 space-y-2 text-xs">
                    <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      <div class="text-[10px] text-slate-500 uppercase font-semibold">Anomalía Reportada</div>
                      <div class="text-rose-200 font-medium">${Sanitizer.escapeHTML(o.issueDescription)}</div>
                    </div>

                    <div class="flex justify-between text-slate-400">
                      <span>Paciente:</span>
                      <span class="font-medium text-white">${Sanitizer.escapeHTML(o.patientName)}</span>
                    </div>

                    <div class="flex justify-between text-slate-400">
                      <span>Dirección:</span>
                      <span class="font-medium text-slate-200 truncate max-w-[200px]">${Sanitizer.escapeHTML(o.patientAddress)}</span>
                    </div>

                    <div class="flex justify-between text-slate-400">
                      <span>Técnico de Guardia:</span>
                      <span class="font-medium text-indigo-300">${Sanitizer.escapeHTML(o.dispatchedTechnician?.name || 'Por asignar')}</span>
                    </div>

                    <div class="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between items-center text-[11px]">
                      <span class="text-slate-400">Estado de SLA:</span>
                      <span class="font-bold ${sla.isOverdue ? 'text-rose-400' : 'text-emerald-400'}">${sla.message}</span>
                    </div>

                    ${o.status === 'completed' ? `
                      <div class="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/40 text-[11px] space-y-1">
                        <div class="text-emerald-300 font-semibold">Equipo Sustituto Entregado: S/N ${o.replacementEquipmentSerial}</div>
                        <div class="text-slate-400">Turnaround: ${o.turnaroundMinutes} minutos (${o.isWithinSla ? 'Dentro de SLA' : 'Fuera de SLA'})</div>
                        <div class="font-mono text-[9px] text-emerald-400">🔒 Sello: ${o.hashSeal?.slice(0, 16)}...</div>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                  <a href="${Sanitizer.sanitizeURL(WhatsAppCareNotifier.generateEmergencySwapWhatsAppUrl({
                    technicianPhone: o.dispatchedTechnician?.phone || '+5491155443322',
                    orderId: o.id,
                    patientName: o.patientName,
                    patientAddress: o.patientAddress,
                    equipmentType: o.equipmentType,
                    serialNumber: o.failingEquipmentSerial,
                    issueDescription: o.issueDescription
                  }))}" target="_blank" rel="noopener noreferrer" class="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
                    💬 Notificar Técnico
                  </a>
                  ${o.status !== 'completed' ? `
                    <button data-action="open-swap-resolution-modal" data-id="${o.id}" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md">
                      Certificar Recambio (Swap)
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    Sanitizer.safeSetInnerHTML(container, html);
  }

  renderSettlements(container) {
    const batches = this.settlementService.listBatches();
    const completedVisits = this.visitService.listVisits({ status: 'completed' });

    const html = `
      <div class="space-y-6">
        <div>
          <h2 class="text-lg font-bold text-white">Liquidaciones y Lotes de Obras Sociales</h2>
          <p class="text-xs text-slate-400">Exportación de lotes sin débito para PAMI, OSDE, Swiss Medical y liquidación de honorarios profesionales.</p>
        </div>

        <!-- Batch Generator -->
        <div class="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <h3 class="text-sm font-bold text-white border-b border-slate-800 pb-3">Generar Nuevo Lote para Facturación</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">Obra Social / Prepaga</label>
              <select id="batchOsSelect" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200">
                <option value="PAMI (Instituto)">PAMI (Instituto)</option>
                <option value="OSDE">OSDE</option>
                <option value="Swiss Medical">Swiss Medical</option>
                <option value="Galeno">Galeno</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">Período Mensual (AAAA-MM)</label>
              <input type="month" id="batchPeriodInput" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200" value="${new Date().toISOString().slice(0, 7)}" />
            </div>
            <div class="flex items-end">
              <button data-action="generate-batch" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30">
                ⚡ Generar y Auditar Lote
              </button>
            </div>
          </div>
        </div>

        <!-- Generated Batches -->
        <div class="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <h3 class="text-sm font-bold text-white">Lotes Auditados Listos para Presentación</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th class="pb-3">ID Lote</th>
                  <th class="pb-3">Obra Social</th>
                  <th class="pb-3">Período</th>
                  <th class="pb-3">Visitas Certificadas</th>
                  <th class="pb-3">Equipos Comodato</th>
                  <th class="pb-3">Total Liquidado</th>
                  <th class="pb-3">Estado Auditoría</th>
                  <th class="pb-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 text-slate-300">
                ${batches.length === 0 ? '<tr><td colspan="8" class="py-4 text-center text-slate-500">No hay lotes generados aún</td></tr>' : ''}
                ${batches.map(b => `
                  <tr>
                    <td class="py-3 font-mono font-semibold text-indigo-400">${b.id}</td>
                    <td class="py-3 font-medium text-white">${Sanitizer.escapeHTML(b.obraSocial)}</td>
                    <td class="py-3 font-mono">${b.period}</td>
                    <td class="py-3">${b.visitsCount} (${formatARS(b.visitsTotal)})</td>
                    <td class="py-3">${b.equipmentCount} (${formatARS(b.comodatoTotal)})</td>
                    <td class="py-3 font-bold text-emerald-400">${formatARS(b.grandTotal)}</td>
                    <td class="py-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.auditStatus === 'audited_zero_debit_risk' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}">
                        ${b.auditStatus === 'audited_zero_debit_risk' ? 'Cero Débito Garantizado' : 'Requiere Revisión'}
                      </span>
                    </td>
                    <td class="py-3 text-right">
                      <button data-action="export-batch-csv" data-id="${b.id}" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-1 ml-auto">
                        📥 Exportar CSV Excel
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    Sanitizer.safeSetInnerHTML(container, html);
  }
}

// Instantiate on DOM load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new CareTrackApp();
  });
}
