import express, { Router } from "express";
import { addToCart, clearCart, getCart, removeFromCart, updateCart } from "./cartController.js";
import { authenticate } from "../../../middleware/middleware.js";

const router: Router = express.Router();

router.get('/cart', authenticate, getCart);
router.put('/updateCart/:id', authenticate, updateCart);
router.post('/addToCart', authenticate, addToCart);
router.post('/clearCart', authenticate, clearCart);
router.delete('/removecartItem/:id', authenticate, removeFromCart);

export default router;