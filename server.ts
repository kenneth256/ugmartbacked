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

// ----- CORS Setup -----
const allowedOrigins = [
  'http://localhost:3000', // local frontend
  'http://localhost:5173', // optional if you use Vite
  process.env.FRONTEND_URL  // future deployed frontend
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests like Postman
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Cookie']
}));

// Handle preflight requests
app.options('*', cors());

// ----- Middleware -----
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----- Root Endpoint -----
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

// ----- Health Check -----
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected'
  });
});

// ----- API Routes -----
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/settings', featuredBannerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/orders', orderRouter);

// ----- 404 Handler -----
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// ----- Error Handler -----
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
