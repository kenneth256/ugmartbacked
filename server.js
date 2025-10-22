import express from "express";
import cors from "cors";
import authRouter from "./lib/controllers/auth/authRoutes.js";
const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/api/auth', authRouter);

app.listen(4000, () => {
    console.log('Backend server running on port 4000');
});
export default app;
