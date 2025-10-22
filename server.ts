import express from "express";
import type { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser"; 
import authRouter from "./lib/controllers/auth/authRoutes.js";
import productRouter from "./lib/controllers/productsController/productAuth.js";
import couponRoutes from "./lib/controllers/coupon/routes.js";
import featuredBannerRoutes from "./lib/controllers/banner/routes.js";
import cartRouter from "./lib/controllers/cart/routes.js";
import addressRouter from "./lib/controllers/address/route.js";
import orderRouter from "./lib/controllers/order/routes.js";

const app: Express = express();

// CORS Configuration - Allow both local and production frontends
const allowedOrigins: string[] = [
  'http://localhost:3000',
  process.env.FRONTEND_URL || ''
].filter(origin => origin !== ''); // Remove empty strings

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(cookieParser()); 
app.use(express.json());

// Health check endpoint (important for Render)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// API Routes
app.use('/api/coupons', couponRoutes);
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/settings', featuredBannerRoutes);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/orders', orderRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error' 
  });
});

// Use PORT from environment (Render assigns this dynamically)
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;