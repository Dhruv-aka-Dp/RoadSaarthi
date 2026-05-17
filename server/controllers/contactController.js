const sendEmail = require('../utils/sendEmail');

exports.sendContactEmail = async (req, res, next) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Please provide all fields' });
  }

  try {
    await sendEmail({
      to: process.env.CONTACT_EMAIL || 'admin@roadsaarthi.com',
      subject: `New Contact Form Submission from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    });

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (err) {
    next(err);
  }
};
