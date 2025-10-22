import express, { Router } from "express";
import { login, logout, refreshAccessToken, register } from "./routes.js";
const router = express();
router.post('/createAccount', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refreshToken', refreshAccessToken);
export default router;
//# sourceMappingURL=authRoutes.js.map