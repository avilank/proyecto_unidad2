require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const to = process.env.MAIL_TEST_TO || user;

  if (!host || !user || !pass) {
    console.error('Faltan MAIL_HOST, MAIL_USER o MAIL_PASS en .env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.MAIL_PORT || 587),
    secure: false,
    auth: { user, pass },
  });

  await transporter.verify();
  console.log('SMTP OK');

  const info = await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'PredictMaint'}" <${process.env.MAIL_FROM_ADDRESS || user}>`,
    to,
    subject: '[PredictMaint] Prueba SMTP',
    text: 'Si lees esto, el correo de asignación debería funcionar.',
    html: '<p>Si lees esto, el correo de asignación debería funcionar.</p>',
  });

  console.log('Enviado:', info.messageId, '→', to);
}

main().catch((err) => {
  console.error('Error SMTP:', err.message);
  process.exit(1);
});
