import express from 'express';
import { createBanner, fetchBanners, fetchFeatured, updateFeaturedBanner } from './control.js';
import { authenticate, isSuperAdmin } from '../../../middleware/middleware.js';
import { upload } from '../../../middleware/uploadMiddleWare.js';

const router = express.Router();

router.post('/createbanner', authenticate, isSuperAdmin, upload.array("images", 5), createBanner);
router.get('/banners', fetchBanners);
router.post('updateFeaturedProducts', authenticate, isSuperAdmin, upload.array("images", 5), updateFeaturedBanner);
router.get('/featuredProducts',  fetchFeatured)


export default router