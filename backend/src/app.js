import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import rateLimiter from './middleware/rateLimiter.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// Raw body parser for Razorpay webhook verification (BEFORE global express.json)
app.use('/api/v1/payments/razorpay/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
app.use('/api/', rateLimiter);

// Mount main API routes under /api/v1
app.use('/api/v1', apiRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
