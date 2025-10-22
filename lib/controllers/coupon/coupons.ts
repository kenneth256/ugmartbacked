
import prisma from "../../prisma.js";
import type { AuthenticatedRequest } from "../../../middleware/middleware.js";
import type { Response } from "express";


export async function createCoupon(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, percentage, startDate, endDate, usageLimit } = req.body;

    if (!code || !percentage || !startDate || !endDate || !usageLimit) {
      res.status(400).json({ success: false, error: "Missing required fields!" });
      return; 
    }
    const checkexistingCoupon = await prisma.coupon.findUnique({
      where: {code}
    })

    if(checkexistingCoupon) {
      res.status(403).json({success:false, error: "Code already exists!"})
    }
    const coupon = await prisma.coupon.create({
      data: {
        code,
        percentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        usageLimit,
      },
    });

    res.status(201).json({ success: true, coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}


export async function deleteCoupon(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: "Coupon ID is required" });
    }

    const deletedCoupon = await prisma.coupon.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
      data: deletedCoupon,
    });
  } catch (error: any) {
    console.error(error);

    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: "Coupon not found" });
    }

    res.status(500).json({
      success: false,
      error: "Server error while deleting coupon",
    });
  }
}



export async function fetchCoupons(req: AuthenticatedRequest, res: Response) {
  try {
    
    const coupons = await prisma.coupon.findMany();

    res.status(200).json({
      success: true,
      message: "Coupons fetched successfully!",
      data: coupons,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching coupons",
    });
  }
}

