import express, { Router } from "express";
import { 
  capturePaypalOrder, 
  createOrder, 
  createPaypalOrder, 
  getOrderByUser, 
  getOrders, 
  updateOrder, 
  getOrderById 
} from "./orderController.js";
import { isSuperAdmin, authenticate } from "../../../middleware/middleware.js";

const router: Router = express.Router();

// ✅ Add authenticate middleware to ALL protected routes
router.post('/createPaypalOrder', authenticate, createPaypalOrder);
router.post('/capturePaypalOrder', authenticate, capturePaypalOrder);
router.get('/getorder/:id', authenticate, getOrderById);
router.post('/create-order', authenticate, createOrder);
router.get('/getorderByUser', authenticate, getOrderByUser);

// Admin-only routes (authenticate first, then check admin)
router.get('/getOrderAdmin', authenticate, isSuperAdmin, getOrders);
router.put('/updateorderStatus/:id', authenticate, isSuperAdmin, updateOrder);

export default router;