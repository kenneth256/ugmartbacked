import type { Response } from "express"
import type { AuthenticatedRequest } from "../../../middleware/middleware.js"
import prisma from "../../prisma.js";




export const createAddress = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, address, district, subcounty, village, phonenumber, isDefault } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: "User unauthorized!" });
    }

    
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        userId,
        name,
        address,
        district,
        subcounty,
        village,
        phonenumber,
        email: req.user?.email || '',
        isDefault: isDefault || false,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Address created successfully!",
      address: newAddress,
    });
  } catch (error) {
    console.error("Create address error:", error);
    return res.status(500).json({ success: false, error: "Internal server error!" });
  }
};



export const updateAddress = async (req: AuthenticatedRequest, res: Response) => {
  console.log('UPDATING ADDRESS'); 
  
  try {
    const userId = req.user?.userId; 
    const { id } = req.params;
    const { name, email, address, district, subcounty, village, phonenumber, isDefault } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User unauthorized!" 
      });
    }

    
    if (!name && !email && !address && !district && !subcounty && !village && !phonenumber && isDefault === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update"
      });
    }

    
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existingAddress) {
      return res.status(404).json({ 
        success: false, 
        message: "Address not found or you don't have permission to update it" 
      });
    }

   
    if (isDefault === true) {
      await prisma.address.updateMany({
        where: { 
          userId,
          id: { not: id } 
        },
        data: { isDefault: false },
      });
    }

    // Update address - only update provided fields
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(address && { address }),
        ...(district && { district }),
        ...(subcounty && { subcounty }),
        ...(village && { village }),
        ...(phonenumber && { phonenumber }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    
    const allAddresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      message: "Address updated successfully!",
      address: updatedAddress,
      addresses: allAddresses, 
    });

  } catch (error) {
    console.error("Update address error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to update address",
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
};


export const deleteAddress = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: "User unauthorized!" });
    }

    if (!id) {
      return res.status(400).json({ success: false, error: "Address ID is required!" });
    }

    const existingAddress = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existingAddress) {
      return res.status(404).json({ success: false, error: "Address not found!" });
    }

    await prisma.address.delete({
      where: { id },
    });

    return res.status(200).json({ success: true, message: "Address deleted successfully!" });
  } catch (error) {
    console.error("Delete address error:", error);
    return res.status(500).json({ success: false, error: "Internal server error!" });
  }
};


export const getAddresses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: "User unauthorized!" });
    }

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully!",
      addresses,
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    return res.status(500).json({ success: false, error: "Internal server error!" });
  }
};
