import express, { Router } from "express"
import { createCoupon, deleteCoupon, fetchCoupons } from "./coupons.js";


const router: Router = express.Router();

router.get('/availableCoupons', fetchCoupons);
router.delete(`/deleteCoupon/:id`, deleteCoupon);
router.post('/createCoupon', createCoupon)



export default router;