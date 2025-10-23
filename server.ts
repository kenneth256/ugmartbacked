import express from "express";
import type { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRouter from "./lib/controllers/auth/authRoutes.js";
import productRouter from "./lib/controllers/productsController/productAuth.js";
import couponRoutes from "./lib/controllers/coupon/routes.js";
import featuredBannerRoutes from "./lib/controllers/banner/routes.js";
import cartRouter from "./lib/controllers/cart/routes.js";
import addressRouter from "./lib/controllers/address/route.js";
import orderRouter from "./lib/controllers/order/routes.js";

// Load environment variables
dotenv.config();

const app: Express = express();

// CRITICAL: CORS must be BEFORE other middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours - cache preflight requests
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Other middleware AFTER CORS
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'UGMart Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      products: '/api/products',
      settings: '/api/settings',
      cart: '/api/cart',
      address: '/api/address',
      orders: '/api/orders',
      coupons: '/api/coupons'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected',
    cors: {
      allowedOrigins: allowedOrigins
    }
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/settings', featuredBannerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/orders', orderRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for:`, allowedOrigins);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;