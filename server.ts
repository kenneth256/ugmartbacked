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

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(cookieParser()); 
app.use(express.json());
app.use('/api/coupons', couponRoutes)
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/settings', featuredBannerRoutes)
app.use('/api/cart', cartRouter)
app.use('/api/address', addressRouter)
app.use('/api/orders', orderRouter)

app.listen(4000, () => {
  console.log('Backend server running on port 4000');
});

export default app;