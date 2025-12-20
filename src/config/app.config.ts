export default () => ({
  app: {
    name: process.env.APP_NAME || 'PM rental',
    port: parseInt(process.env.PORT || '8000', 10),
    env: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api',
  },
});





