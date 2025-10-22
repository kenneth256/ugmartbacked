import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import prisma from "../../prisma.js";
export const generateAccessTokens = (id, email) => {
    const accessToken = jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = randomUUID();
    return { accessToken, refreshToken };
};
const setToken = async (res, accessToken, refreshToken) => {
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 15 // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    });
};
export async function register(req, res) {
    try {
        const { name, email, password } = req.body;
        // Check if user exists
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            res.status(400).json({
                success: false,
                error: `User with email ${email} already exists`
            });
            return; // stop execution
        }
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create new user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });
        res.status(201).json({ user });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong" });
    }
}
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            res.status(404).json({
                success: false,
                error: `User does not exist`
            });
            return;
        }
        const isMatch = bcrypt.compareSync(password, user?.password);
        if (!isMatch) {
            res.status(400).json({ success: false, error: "Invalid email or password" });
            return;
        }
        const { accessToken, refreshToken } = generateAccessTokens(user.id, user.email);
        await setToken(res, accessToken, refreshToken);
        res.status(200).json({
            success: true,
            messaage: "Logged in successfull!",
            user: {
                name: user.name,
                email: user.email,
                id: user.id,
            }
        });
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong" });
    }
}
export const refreshAccessToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        res.status(404).json({
            success: false,
            error: "Invalid refresh Token"
        });
    }
    try {
        const user = await prisma.user.findFirst({
            where: { refreshToken }
        });
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        const { accessToken, refreshToken: newRefreshToken } = generateAccessTokens(user?.id, user?.email);
        await setToken(res, accessToken, newRefreshToken);
        res.status(200).json({
            success: true,
            message: "Refreshed TOken successfully!"
        });
    }
    catch (error) {
        console.error(error);
    }
};
export const logout = async (req, res) => {
    try {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.send("User Logged out successfully!");
    }
    catch (error) {
        console.log(error);
    }
};
//# sourceMappingURL=routes.js.map