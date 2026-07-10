const notificationService = require('./NotificationService');
const plantConfig = require('../frontend/src/config/plant_config.json');

class ComplianceMonitor {
  constructor(db) {
    this.db = db;
    // Debounce state to avoid spamming immediate alerts. Map of userId_plantId_param -> timestamp
    this.alertDebounce = {}; 
  }

  // Helper to get dummy telemetry for a plant
  generateCurrentTelemetry(plantName) {
    const config = plantConfig[plantName];
    if (!config) return {};
    const base = config.sensor_baseline;
    
    // Occasionally simulate a spike (5% chance)
    const isSpike = Math.random() > 0.95;

    return {
      pH: parseFloat((base.ph + (Math.random() - 0.5) * (isSpike ? 3.0 : 1.0)).toFixed(2)),
      conductivity: parseFloat((base.conductivity + (Math.random() - 0.5) * (isSpike ? 800 : 200)).toFixed(2)),
      turbidity: parseFloat((base.turbidity + Math.random() * (isSpike ? 15.0 : 2.0)).toFixed(2)),
      bod: parseFloat((base.bod + Math.random() * (isSpike ? 40 : 10)).toFixed(2)),
      cod: parseFloat((base.cod + Math.random() * (isSpike ? 200 : 50)).toFixed(2))
    };
  }

  // Simulate incoming data stream
  startMonitoring() {
    console.log("ComplianceMonitor: Started active background monitoring.");
    
    // Check every 5 minutes (300000 ms), but we use 10 seconds (10000 ms) for demo purposes
    setInterval(() => {
      this.evaluateAllClients();
    }, 10000); 
  }

  evaluateAllClients() {
    this.db.all("SELECT * FROM users WHERE role = 'client'", (err, clients) => {
      if (err || !clients) return;

      clients.forEach(client => {
        const plants = JSON.parse(client.allowed_plant_ids || '[]');
        const limits = JSON.parse(client.pcb_limits || '{}');

        plants.forEach(plant => {
          const telemetry = this.generateCurrentTelemetry(plant);
          this.checkTelemetryAgainstLimits(client, plant, telemetry, limits);
        });
      });
    });
  }

  checkTelemetryAgainstLimits(client, plant, telemetry, limits) {
    const checks = [
      { param: 'pH', value: telemetry.pH, min: limits.ph_min, max: limits.ph_max },
      { param: 'Turbidity', value: telemetry.turbidity, min: 0, max: limits.turbidity_max || 999 },
      { param: 'Conductivity', value: telemetry.conductivity, min: 0, max: limits.conductivity_max || 99999 },
      { param: 'BOD', value: telemetry.bod, min: 0, max: limits.bod_max || 9999 },
      { param: 'COD', value: telemetry.cod, min: 0, max: limits.cod_max || 9999 }
    ];

    checks.forEach(check => {
      const isBreach = check.value > check.max || check.value < check.min;
      if (isBreach) {
        this.triggerImmediateAlert(client, plant, check);
      }
    });
  }

  async triggerImmediateAlert(client, plant, check) {
    const debounceKey = `${client.user_id}_${plant}_${check.param}`;
    const now = Date.now();
    const lastAlert = this.alertDebounce[debounceKey] || 0;

    // Only send 1 alert per parameter per plant every 2 hours (7200000 ms)
    if (now - lastAlert < 7200000) {
      return; 
    }

    this.alertDebounce[debounceKey] = now;

    const limitStr = check.value > check.max ? check.max : check.min;
    
    const plantDisplayName = plantConfig[plant] ? plantConfig[plant].display_name : plant;
    
    const message = `🔴 Permionics Alert — ${plantDisplayName}: ${check.param} breached discharge limit (${check.value} vs limit ${limitStr}) at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}. 
Our operations team has been notified and is responding. We will update you within 2 hours.`;

    // 1. Notify Client via WhatsApp
    if (client.contact_phone) {
      await notificationService.sendWhatsApp(client.contact_phone, message);
    }
    
    // 2. Notify Client via Email
    if (client.contact_email) {
      await notificationService.sendEmail(
        client.contact_email, 
        `URGENT: PCB Compliance Alert - ${plant}`, 
        `Dear ${client.contact_name || client.company_name},\n\n${message}`
      );
    }

    // 3. Notify Internal Ops
    await notificationService.notifyInternalOps(`Limit Breach at ${client.company_name} (${plant})! ${check.param} is ${check.value}.`);
  }
}

module.exports = ComplianceMonitor;
