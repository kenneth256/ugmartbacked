import express from "express";
import { 
  createAddress, 
  deleteAddress, 
  getAddresses, 
  updateAddress 
} from "./address.js";
import { authenticate } from "../../../middleware/middleware.js";


const router = express.Router();

router.post('/createAddress', authenticate, createAddress);
router.delete('/deleteAddress/:id', authenticate, deleteAddress);
router.get('/fetchAllAddresses', authenticate, getAddresses);
router.put('/updateAddress/:id', authenticate, updateAddress);

export default router;