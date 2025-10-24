import express, { Router }  from "express";
import { createCategory, createProduct, deleteProduct, fetchById, fetchCategories, fetchProducts, fetchProductsClient, updateProduct } from "./route.js";
import { authenticate, isSuperAdmin } from "../../../middleware/middleware.js";
import { upload } from "../../../middleware/uploadMiddleWare.js";


const router: Router = express.Router();

router.post('/products', upload.array("images", 5), createProduct);
router.delete('/products/:id', authenticate, isSuperAdmin,deleteProduct)
router.put('/products/:id', authenticate, isSuperAdmin, upload.array("images", 5), updateProduct)


router.get('/products/filtered', fetchProductsClient)  

router.get('/products', fetchProducts)  
router.get('/products/:id', fetchById) 

router.post('/categories', authenticate, isSuperAdmin,createCategory)
router.get('/categories', authenticate, isSuperAdmin, fetchCategories)

export default  router