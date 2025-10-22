import cloudinary from "../../../config/config.js";
import type { AuthenticatedRequest } from "../../../middleware/middleware.js";
import type { Response } from 'express';
import prisma from "../../prisma.js";
import fs from 'fs'

export const createBanner = async(req: AuthenticatedRequest, res: Response): Promise<void> => {
  console.log('sending banners');
  try {
    const files = req.files as Express.Multer.File[];
    
    if(!files || files.length === 0) {
      res.status(400).json({success: false, error: 'No files provided!'});
      return;
    }
    
    console.log('Files received:', files.length);
    
  
    const uploadPromises = files.map(file => cloudinary.uploader.upload(file.path, {
      folder: 'ecomerce-banners'
    }));
    
    const result = await Promise.all(uploadPromises);
    console.log('Cloudinary upload successful'); 
    
    const banners = await Promise.all(result.map(res => prisma.featuredBanner.create({
      data: {
        imageUrl: res.secure_url
      }
    })));
    
    console.log('Database save successful'); 
    
   
    files.forEach(file => {
      fs.unlinkSync(file.path);
    });
    
    res.status(201).json({
      success: true, 
      banners
    });
    
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create banner'
    });
  }
}

export const fetchBanners = async(req: AuthenticatedRequest, res: Response) => {
  console.log('fetched banners')
    try {
       const banners = await prisma.featuredBanner.findMany()
        
       if(!banners) {
        res.status(400).json({
            success: false,
            error: 'Failing fetching banners'
        });
        return;
       }
       console.log(banners)
       res.status(201).json({
        success:true,
        banners
       })
       
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Failing fetching banners'
        });
    }
}

export const fetchFeatured = async(req: AuthenticatedRequest, res: Response) => {
  console.log('fetching featured products')
    try {
        const featuredProducts = await prisma.product.findMany({
            where: {isFeatured: true}
        })
        res.status(200).json({success: true, featuredProducts})
    } catch (error) {
        res.status(404).json({success: false, error: "Error getting featured products"})
    }
}


export const updateFeaturedBanner = async(
  req: AuthenticatedRequest, 
  res: Response
): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Valid banner IDs array is required'
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        data: { isFeatured: false }
      });


      const updatedBanners = await tx.product.updateMany({
        where: { 
          id: { in: ids } 
        },
        data: {
          isFeatured: true
        }
      });

      return updatedBanners;
    });

    res.status(200).json({
      success: true,
      message: `${result.count} featured banner(s) updated successfully`,
      count: result.count
    });

  } catch (error) {
    console.error('Error updating featured banner:', error);
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update featured banner',
     
    });
  }
};