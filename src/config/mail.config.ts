export default () => ({
  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM?.includes('<')
      ? process.env.MAIL_FROM
      : `"Aqal Stream" <${process.env.MAIL_FROM || 'hi@aqalstream.com'}>`,
  },
});
