const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  let transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    // Use real SMTP server configured in .env
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Fallback to Ethereal Email for development/testing if no credentials provided
    console.warn('⚠️ SMTP credentials not found in .env. Using Ethereal Email for testing.');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const message = {
    from: `${process.env.FROM_NAME || 'RoadSaarthi Team'} <${process.env.FROM_EMAIL || 'noreply@roadsaarthi.com'}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html, // Optional HTML template
  };

  const info = await transporter.sendMail(message);

  if (!process.env.SMTP_HOST) {
    // If using Ethereal, log the preview URL to the console so you can click and view it
    console.log('📧 Test email sent! Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } else {
    console.log('📧 Email sent successfully: %s', info.messageId);
  }
};

module.exports = sendEmail;




