import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import { sanitizeInput, validateAllIdParams } from './middleware/sanitize.js';
import { getHealth, getReady } from './controllers/health.controller.js';
import { sendError } from './utils/apiResponse.js';
import logger from './utils/logger.js';

const app = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// Trust proxy configuration for correct client IP detection behind tunnels / reverse proxies
if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy === 'true' ? true : env.trustProxy);
}

// Global Request ID assignment
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Explicit Helmet security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Strict CORS: only CLIENT_URL allowed, credentials enabled for httpOnly refresh cookie
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (origin === env.clientUrl || env.nodeEnv !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Access denied for this origin.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
  })
);

// Structured HTTP request logging with redaction and requestId tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      requestId: req.requestId,
      userId: req.user?._id,
      route: req.originalUrl,
      status: res.statusCode,
      duration,
      query: req.query,
      body: req.body,
      headers: {
        authorization: req.headers.authorization,
        cookie: req.headers.cookie,
        'user-agent': req.headers['user-agent'],
      },
    });
  });
  next();
});

// HTTP Response Compression (> 1kb, skips already compressed files)
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

// Root health & ready probes (for container orchestrators / docker healthcheck)
app.get('/health', getHealth);
app.get('/ready', getReady);

// Raw body parser for Razorpay webhook verification (BEFORE global express.json)
app.use('/api/v1/payments/razorpay/webhook', express.raw({ type: 'application/json' }));

// Content-Type validation: reject unexpected body types on mutating methods with 415
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (contentType) {
      const isJson = contentType.includes('application/json');
      const isMultipart = contentType.includes('multipart/form-data');
      const isUrlEncoded = contentType.includes('application/x-www-form-urlencoded');
      const isRawWebhook = req.originalUrl?.includes('/payments/razorpay/webhook');

      if (!isJson && !isMultipart && !isUrlEncoded && !isRawWebhook) {
        return sendError(
          res,
          415,
          `Unsupported Media Type: "${contentType}". Expected application/json or multipart/form-data.`,
          'UNSUPPORTED_MEDIA_TYPE'
        );
      }
    }
  }
  next();
});

// Body parsers: 100kb JSON body limit globally
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// NoSQL injection prevention & sanitization
app.use(sanitizeInput);

// Global route parameter ObjectId validator
app.use(validateAllIdParams);

// Rate limiting (global per-IP limiter, SOS exempt)
app.use('/api/', globalLimiter);

// Mount main API routes under /api/v1
app.use('/api/v1', apiRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
