const compression = require('compression');
const express = require('express');
const path = require('path');

const { createAccessAuth } = require('./auth/accessAuth');
const { authErrorHandler, requireAuth, requireRole } = require('./auth/authorize');
const { securityHeaders } = require('./middleware/securityHeaders');
const { createAnimalRoutes } = require('./routes/family/animalRoutes');
const { createFamilyMiscRoutes } = require('./routes/family/miscRoutes');
const { createFamilyPageRoutes } = require('./routes/family/pageRoutes');
const { createPetRoutes } = require('./routes/family/petRoutes');
const { createPigeonRoutes } = require('./routes/family/pigeonRoutes');
const { createPinboardRoutes } = require('./routes/family/pinboardRoutes');
const { createTaxRoutes } = require('./routes/family/taxRoutes');
const { createTodoRoutes } = require('./routes/family/todoRoutes');
const defaultDataLoader = require('./dataLoader');
const { getPortfolioPositionCount, renderHomePage } = require('./homePage');
const { createPortfolioRoutes } = require('./routes/portfolioRoutes');
const { createRequestRoutes } = require('./routes/requestRoutes');
const { createStaticPageRoutes } = require('./routes/staticPageRoutes');
const { createWritingRoutes } = require('./routes/writingRoutes');

function createApp(options = {}) {
  const app = express();
  const deps = options.dependencies || {};
  const dataLoader = deps.dataLoader || defaultDataLoader;
  const accessAuth = options.accessAuth || createAccessAuth(options.accessAuthOptions);
  const authErrorMiddleware = options.authErrorHandler || authErrorHandler;
  const requireAuthMiddleware = options.requireAuth || requireAuth;
  const requireFamily = options.requireFamily || requireRole('family');

  app.disable('x-powered-by');

  app.use(compression());
  app.use(express.json());
  app.use(options.securityHeaders || securityHeaders);

  app.use(accessAuth);
  app.use(authErrorMiddleware);
  app.use(requireAuthMiddleware);

  app.get('/', (req, res) => {
    res.type('html').send(renderHomePage(req.user, {
      dashboardCompanyCount: getPortfolioPositionCount(dataLoader),
    }));
  });

  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: 0,
      etag: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
        }
      },
    })
  );

  app.get('/api/me', (req, res) => {
    res.json({
      authenticated: true,
      email: req.user.email,
      role: req.user.role,
    });
  });

  app.use(createPortfolioRoutes({ ...deps, requireFamily }));
  app.use(createRequestRoutes(deps));

  app.use('/api/family', requireFamily);
  app.use('/api/family', createAnimalRoutes(deps));
  app.use('/api/family', createPetRoutes(deps));
  app.use('/api/family', createTaxRoutes(deps));
  app.use('/api/family', createPigeonRoutes(deps));
  app.use('/api/family', createFamilyMiscRoutes(deps));
  app.use('/api/family', createTodoRoutes(deps));
  app.use('/api/family', createPinboardRoutes(deps));

  app.use(createWritingRoutes(deps));
  app.use('/family', requireFamily, createFamilyPageRoutes(deps));
  app.use(createStaticPageRoutes(deps));

  return app;
}

module.exports = {
  createApp,
};
