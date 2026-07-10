require('dotenv').config();
const twilio = require('twilio');
const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    this.isMockMode = !process.env.TWILIO_ACCOUNT_SID || !process.env.SENDGRID_API_KEY;
    
    if (!this.isMockMode) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    }
  }

  async sendWhatsApp(to, message) {
    if (this.isMockMode) {
      console.log(`\n=============================================================`);
      console.log(`[MOCK WHATSAPP] To: ${to}`);
      console.log(`Message: \n${message}`);
      console.log(`=============================================================\n`);
      return;
    }

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: 'whatsapp:+14155238886', // Twilio sandbox number
        to: `whatsapp:${to}`
      });
    } catch (e) {
      console.error(`Failed to send WhatsApp to ${to}:`, e.message);
    }
  }

  async sendEmail(to, subject, body, attachmentName = null, attachmentBuffer = null) {
    if (this.isMockMode) {
      console.log(`\n=============================================================`);
      console.log(`[MOCK EMAIL] To: ${to}`);
      console.log(`[MOCK EMAIL] Subject: ${subject}`);
      if (attachmentName) console.log(`[MOCK EMAIL] Attachment: ${attachmentName}`);
      console.log(`[MOCK EMAIL] Body: \n${body}`);
      console.log(`=============================================================\n`);
      return;
    }

    const mailOptions = {
      from: 'alerts@permionics.com',
      to,
      subject,
      text: body,
      attachments: attachmentBuffer ? [{
        filename: attachmentName,
        content: attachmentBuffer
      }] : []
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (e) {
      console.error(`Failed to send Email to ${to}:`, e.message);
    }
  }

  async notifyInternalOps(message) {
    const opsWhatsApp = process.env.OPS_WHATSAPP || '+910000000000'; // Permionics Ops Group
    await this.sendWhatsApp(opsWhatsApp, `[INTERNAL OPS ALERT] ${message}`);
  }
}

module.exports = new NotificationService();
