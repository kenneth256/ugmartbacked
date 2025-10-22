import type { Request, Response } from "express";
export declare const generateAccessTokens: (id: string, email: string) => {
    accessToken: string;
    refreshToken: `${string}-${string}-${string}-${string}-${string}`;
};
export declare function register(req: Request, res: Response): Promise<void>;
export declare function login(req: Request, res: Response): Promise<void>;
export declare const refreshAccessToken: (req: Request, res: Response) => Promise<void>;
export declare const logout: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=routes.d.ts.map