const express = require('express');
const userRoutes = require('./user.routes');
const productRoutes = require('./product.routes');
const categoryRoutes = require('./category.routes');
const cartRoutes = require('./cart.routes');
const wishlistRoutes = require('./wishlist.routes');
const reviewRoutes = require('./review.routes');
const adminRoutes = require('./admin.routes');
const sprint6Routes = require('./sprint6.routes');
const { createBrandingRouter } = require('./branding.routes');
const { createMarketingRouter } = require('./marketing.routes');
const { createStoreRouter } = require('./store.routes');
const { createWebhookRouter } = require('./webhook.routes');
const { createIntegrationRouter } = require('./integration.routes');
const { createInventoryRouter } = require('./inventory.routes');
const { createLabelRouter } = require('./label.routes');
const { authenticateToken } = require('./user.routes');

const router = express.Router();

function rejectTenantOverride(req, res, next) {
  if (Object.prototype.hasOwnProperty.call(req.query || {}, 'tenant_id') || Object.prototype.hasOwnProperty.call(req.body || {}, 'tenant_id')) {
    return res.status(400).json({ error: 'tenant_id não pode ser informado na requisicao.' });
  }
  next();
}

router.get('/', (req, res) => {
  res.json({ message: 'API da loja online está ativa' });
});

router.use('/admin', authenticateToken, rejectTenantOverride);

router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/reviews', reviewRoutes);
router.use('/admin', createLabelRouter());
router.use('/admin', adminRoutes);
router.use('/', sprint6Routes);
router.use('/', createBrandingRouter());
router.use('/', createMarketingRouter());
router.use('/', createStoreRouter());
router.use('/', createWebhookRouter());
router.use('/', createIntegrationRouter());
router.use('/', createInventoryRouter());
router.use('/', userRoutes);

module.exports = router;
