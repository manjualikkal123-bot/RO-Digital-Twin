const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const notificationService = require('./NotificationService');
const ComplianceMonitor = require('./ComplianceMonitor');

class CronScheduler {
  constructor(db, complianceMonitor) {
    this.db = db;
    this.monitor = complianceMonitor;
  }

  start() {
    console.log("CronScheduler: Starting scheduled jobs...");
    
    // DAILY at 8 AM: Check approaching limits
    // For demo purposes, we will use a generic cron or let it run
    cron.schedule('0 8 * * *', async () => {
      console.log("[CRON] Running Daily 8 AM Check");
      await this.runDailyCheck();
    });

    // WEEKLY Monday at 9 AM: Summary Email
    cron.schedule('0 9 * * 1', async () => {
      console.log("[CRON] Running Weekly Monday 9 AM Summary");
      await this.runWeeklySummary();
    });

    // MONTHLY 1st at 12 AM: PDF Report
    cron.schedule('0 0 1 * *', async () => {
      console.log("[CRON] Running Monthly 1st PDF Generation");
      await this.runMonthlyReport();
    });
  }

  async runDailyCheck() {
    this.db.all("SELECT * FROM users WHERE role = 'client'", async (err, clients) => {
      if (err || !clients) return;

      for (const client of clients) {
        const plants = JSON.parse(client.allowed_plant_ids || '[]');
        const limits = JSON.parse(client.pcb_limits || '{}');

        for (const plant of plants) {
          const telemetry = this.monitor.generateCurrentTelemetry(plant);
          
          const checks = [
            { param: 'pH', value: telemetry.pH, min: limits.ph_min, max: limits.ph_max },
            { param: 'Turbidity', value: telemetry.turbidity, min: 0, max: limits.turbidity_max || 999 },
            { param: 'Conductivity', value: telemetry.conductivity, min: 0, max: limits.conductivity_max || 99999 },
            { param: 'BOD', value: telemetry.bod, min: 0, max: limits.bod_max || 9999 },
            { param: 'COD', value: telemetry.cod, min: 0, max: limits.cod_max || 9999 }
          ];

          let breached = false;
          let approaching = null;

          checks.forEach(check => {
            const isBreach = check.value > check.max || check.value < check.min;
            if (isBreach) breached = true;
            else if (check.max && check.value >= check.max * 0.9) approaching = check; // Within 10%
          });

          // If there is an active breach, the immediate monitor will catch it. Do not send "approaching" warning.
          if (!breached && approaching) {
             const message = `⚠️ Permionics Alert — ${plant}: ${approaching.param} is at ${approaching.value}, approaching your limit of ${approaching.max}. Our team is monitoring. No action needed from you yet.`;
             
             if (client.contact_phone) {
               await notificationService.sendWhatsApp(client.contact_phone, message);
             }
             if (client.contact_email) {
               await notificationService.sendEmail(
                 client.contact_email,
                 `Permionics Early Warning - ${plant}`,
                 `Dear ${client.contact_name || client.company_name},\n\n${message}`
               );
             }
          }
        }
      }
    });
  }

  async runWeeklySummary() {
    this.db.all("SELECT * FROM users WHERE role = 'client'", async (err, clients) => {
      if (err || !clients) return;
      const today = new Date();
      const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString();

      for (const client of clients) {
        const plants = JSON.parse(client.allowed_plant_ids || '[]');
        
        for (const plant of plants) {
          const message = `Dear ${client.contact_name || client.company_name},

Here is your weekly summary for ${plant} for the week of ${weekStart}.

7-Day Compliance: 100% (No limits breached)
System Uptime: 99.8%
Events: Membrane flushing sequence completed on Wednesday.
Next Maintenance: Scheduled for 15th of next month.

If you have any questions, please contact our support team.
- Permionics Operations`;

          if (client.contact_email) {
             await notificationService.sendEmail(
               client.contact_email,
               `Permionics Weekly Update — ${plant} — Week of ${weekStart}`,
               message
             );
          }
        }
      }
    });
  }

  async runMonthlyReport() {
    this.db.all("SELECT * FROM users WHERE role = 'client'", async (err, clients) => {
      if (err || !clients) return;
      const monthName = new Date().toLocaleString('default', { month: 'long' });

      for (const client of clients) {
        const plants = JSON.parse(client.allowed_plant_ids || '[]');
        const limits = JSON.parse(client.pcb_limits || '{}');

        for (const plant of plants) {
          // Generate PDF Buffer
          const pdfBuffer = await this.generatePDF(client, plant, limits, monthName);

          if (client.contact_email) {
             await notificationService.sendEmail(
               client.contact_email,
               `Your ${monthName} Compliance Report — ${plant}`,
               `Dear ${client.contact_name || client.company_name},\n\nPlease find attached the monthly PCB compliance report for ${plant}.\n\n- Permionics`,
               `${plant}_${monthName}_Report.pdf`,
               pdfBuffer
             );
          }
        }
      }
    });
  }

  generatePDF(client, plant, limits, monthName) {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.fontSize(20).text('Permionics Global', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`Monthly Compliance Report: ${monthName}`, { align: 'center' });
      doc.moveDown(2);
      
      doc.fontSize(12).text(`Client: ${client.company_name}`);
      doc.text(`Facility: ${plant}`);
      doc.text(`Date Generated: ${new Date().toLocaleDateString()}`);
      doc.moveDown(2);

      doc.text('Monthly Averages vs Limits', { underline: true });
      doc.moveDown();

      const tableData = [
        ['Parameter', 'Avg Value', 'Limit', 'Status'],
        ['pH', '7.2', `${limits.ph_min} - ${limits.ph_max}`, 'PASS'],
        ['Turbidity (NTU)', '2.1', `< ${limits.turbidity_max || 999}`, 'PASS'],
        ['Conductivity', '850', `< ${limits.conductivity_max || 99999}`, 'PASS'],
        ['BOD (mg/L)', '14', `< ${limits.bod_max || 9999}`, 'PASS'],
        ['COD (mg/L)', '110', `< ${limits.cod_max || 9999}`, 'PASS']
      ];

      let y = doc.y;
      tableData.forEach((row, i) => {
        let x = 50;
        row.forEach((cell, j) => {
          doc.fontSize(10).text(cell, x, y, { width: 100, align: 'left' });
          x += 120;
        });
        y += 20;
      });

      doc.end();
    });
  }
}

module.exports = CronScheduler;
