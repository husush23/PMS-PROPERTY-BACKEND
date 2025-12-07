export default () => ({
  app: {
    name: process.env.APP_NAME || 'PMS Backend',
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api',
  },
});
