# 🩺 CareTrack — Internación Domiciliaria & Ortopedia en Comodato

> Plataforma clínica y operativa para internación domiciliaria de media y alta complejidad, comodato de equipamiento biomédico y prevención radical de débitos de obras sociales mediante certificación criptográfica SHA-256 y botón de emergencia 24/7 con swap en menos de 2 horas.

[![Version](https://img.shields.io/badge/version-v1.0.00-indigo.svg)](version.json)
[![Security Rating](https://img.shields.io/badge/AppSec_Guardian-100%2F100-emerald.svg)](firebase.json)
[![Tests Passing](https://img.shields.io/badge/tests-56%2F56_PASS-emerald.svg)](tests/run_tests.js)
[![Zero Débito](https://img.shields.io/badge/Obras_Sociales-Cero_D%C3%A9bito-blue.svg)](src/services/visitService.js)
[![SLA Swap](https://img.shields.io/badge/Emergencia_24%2F7-SLA_%3C120_min-rose.svg)](src/services/emergencySwapService.js)

---

## 🎯 El Problema que Resuelve en el Mercado

Las empresas de Internación Domiciliaria (*Home Care*) y alquiler de ortopedia médica en Argentina (proveedores de PAMI, OSDE, Swiss Medical, Galeno, IOMA) sufren tres problemas críticos que impactan directamente en su rentabilidad y operatividad:

1. **Débitos Masivos de Obras Sociales ($5M a $20M ARS mensuales):**
   Las obras sociales auditan las planillas de evolución en papel y aplican débitos implacables por:
   - Firmas ilegibles o disconformidades de familiares.
   - Sospecha de planillas firmadas en blanco al inicio del mes.
   - Falta de geolocalización o ausencia de prueba de permanencia horaria.
2. **Equipamiento Biomédico Desaparecido o No Rescatado:**
   Concentradores de oxígeno, camas ortopédicas y bombas de infusión que quedan varados en domicilios tras altas médicas o fallecimientos del paciente, sufriendo pérdidas de capital de millones de pesos.
3. **Fallas Vitales Nocturnas de Soporte de Vida (Oxígeno / Respirador):**
   Cuando un concentrador de oxígeno emite alarma de baja pureza un domingo a la madrugada, la familia entra en pánico y no tiene canal directo de contingencia, corriendo riesgo vital el paciente.

---

## 💡 Soluciones Implementadas en CareTrack

### 1. 🛡️ Certificación Antifraude Cero Débito (Engine #245 & #159)
- **Geocerca Haversine Estricta (<60 metros):** El profesional (enfermero, kinesiólogo, médico) solo puede registrar check-in si el GPS de su celular se encuentra en el domicilio real del paciente.
- **Doble Validación de Consentimiento Híbrido:**
  - *Familiar Presente:* Firma táctil digital dibujada sobre la pantalla del smartphone del profesional.
  - *Paciente Solo / Tutor Remoto:* Generación de token OTP criptográfico de 6 dígitos enviado por WhatsApp al tutor legal para ingreso en la app.
- **Sello Inmutable SHA-256:** Cada visita completada genera un hash criptográfico que sella signos vitales, notas clínicas y georreferenciación. Cualquier edición posterior invalida el sello e impide el fraude.

### 2. 🚨 Botón de Emergencia Biomédica 24/7 (SLA < 120 min)
- Despacho inmediato de orden de recambio mano a mano (*Swap*).
- El sistema busca automáticamente una unidad operativa sustituta en depósito con `healthScore >= 70/100`.
- Cuenta regresiva de SLA (<120 minutos) y enlace de WhatsApp directo con el técnico de guardia.
- Acta digital de recambio firmada por el familiar al retirar el averiado y entregar el operativo.

### 3. 📦 Comodato de Equipamiento & Health Scoring (#121)
- Inventario seriado de concentradores de O2, camas eléctricas y aspiradores.
- Control de horas de uso y vencimiento semestral de calibración biomédica.
- Alerta preventiva de retiro dentro de las 48 hs posteriores al alta médica del paciente.

### 4. 💰 Lotes de Facturación para Obras Sociales (#134 & #132)
- Generación y precálculo mensual agrupado por PAMI, OSDE, Swiss Medical, etc.
- Auditoría automatizada que certifica 100% de visitas con sello SHA-256 y geocerca OK antes de enviar la factura.
- Exportación universal de planillas en CSV con codificación UTF-8 BOM (`\uFEFF`) para compatibilidad directa con Excel en Windows.

---

## 🏗️ Arquitectura de Software

```
CareTrack/
├── src/
│   ├── core/
│   │   ├── patientRegistry.js          # Registro CIE-10, geocercas y tutores
│   │   └── biomedicalEquipment.js      # Comodatos, scoring de salud y calibraciones
│   ├── services/
│   │   ├── visitService.js             # Check-in geolocalizado, firma/OTP y sello SHA-256
│   │   ├── emergencySwapService.js     # Botón de alarma 24/7 y SLA Swap < 120 min
│   │   ├── settlementService.js        # Lotes de obras sociales y liquidación de honorarios
│   │   ├── whatsAppCareNotifier.service.js # Enlaces wa.me E.164 para OTP y guardia
│   │   └── careTrackCache.service.js   # Offline-first con cola outbox FIFO y anti-phantom seed
│   ├── utils/
│   │   ├── cryptoSeal.js               # Motor SHA-256 puro (0 dependencias)
│   │   ├── formatters.js               # Formato ARS y evaluador clínico de signos vitales
│   │   └── sanitizer.js                # Sanitizador Zero-Sink DOM con DOMParser
│   └── main.js                         # Controlador SPA reactivo y Screen Wake Lock API
├── tests/
│   └── run_tests.js                    # Batería de 56 pruebas en 5 capas
├── index.html                          # Interfaz moderna para smartphones y tablets
├── firebase.json                       # Cabeceras de seguridad CSP, XFO, HSTS
├── firestore.rules                     # Reglas RBAC de base de datos
├── version.json                        # Versión semántica v1.0.00
└── package.json
```

---

## 🧪 Arnés de Pruebas Multi-Capa (56 Tests PASS)

```bash
node tests/run_tests.js
```
- **Capa 1 (Unitarias & Fuzzing):** Haversine GPS, avalancha SHA-256, Unicode/Emojis, formateadores ARS, evaluador de signos vitales y normalizador telefónico E.164.
- **Capa 2 (Integración & Memoria):** Registro de pacientes, descarte de DNI duplicados, asignación de comodatos, scoring de salud y prueba de estrés de memoria (1.000 ciclos).
- **Capa 3 (Servicios & Componentes):** Check-in GPS, firma digital táctil, token OTP WhatsApp de un solo uso, detección de manipulación de notas y despacho de swap.
- **Capa 4 (Seguridad & CSP):** Sanitizer XSS, bloqueo de `javascript:` y `data:`, auditoría de cabeceras en `firebase.json` y `firestore.rules`.
- **Capa 5 (E2E):** Flujo completo de paciente -> comodato -> visita -> sello SHA-256 -> lote obra social -> exportación CSV BOM -> alta y retiro.

---

## 🛡️ Auditoría de Seguridad (AppSec Guardian)

```bash
node ../AiAppFactory/tools/security-guardian/index.mjs .
```
- **Puntaje:** `100/100`
- **Vulnerabilidades:** 0 Críticas | 0 Altas | 0 Medias | 0 Bajas.
- **Zero-Sink DOM:** Cumplimiento estricto mediante `replaceChildren()` y `DOMParser`.

---

## 🚀 Despliegue y Ejecución Local

```bash
# Iniciar servidor estático en puerto libre
python -m http.server 5205
# Abrir en navegador
http://localhost:5205
```

---

*Desarrollado con el estándar de excelencia de AiAppFactory · Zero Fake Features · Testing-First.*
