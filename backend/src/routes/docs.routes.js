const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('../docs/openapi');

const router = express.Router();

router.get('/api/openapi.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300').json(openapi);
});
router.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'Loja Online API',
  swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
}));

module.exports = router;
