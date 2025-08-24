const nodemailer = require('nodemailer');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Error: EMAIL_USER o EMAIL_PASS no están definidos en las variables de entorno');
  throw new Error('Configuración de correo electrónico incompleta');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (to, subject, text, html) => {
  try {
    await transporter.sendMail({
      from: `"LabSync" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
         html,
    });
    console.log('Email sent successfully to:', to);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Error al enviar correo a ${to}: ${error.message}`);
  }
};

module.exports = { sendEmail };
