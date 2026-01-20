import type { Response, Express } from "express";
import type { AuthenticatedRequest } from "../../../middleware/middleware.js"; 
import prisma from "../../prisma.js";
import cloudinary from "../../../config/config.js";
import fs from "fs";
import type { Prisma } from "@prisma/client";

// Helper function to convert query params to string
const getStringParam = (param: any): string | undefined => {
  if (!param) return undefined;
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && param.length > 0) {
    return typeof param[0] === 'string' ? param[0] : undefined;
  }
  return undefined;
};

export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, price, category, description, stock, soldCount, sizes, gender, rating, brand, color, isFeatured } = req.body;
    const userId  = req.user?.userId as any;
    
   console.log(userId)
    if (!userId) {
      res.status(404).json({ success: false, error: "Unauthorized access denied" });
      return;  
    }
    
    if (!name || !price || !category || !description || stock === undefined) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: name, price, category, description, and stock are required"
      });
      return;
    }
    
    const files = req.files as any[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: "No images uploaded" });
      return;
    }
    
    const uploadPromises = files.map(file =>
      cloudinary.uploader.upload(file.path, {
        folder: 'ecomerce'
      })
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    const imageURLs = uploadResults.map(result => result.secure_url);
    console.log('Images uploaded:', imageURLs);
    
    const newProduct = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        category: {
          connectOrCreate: {
            where: { name: category },
            create: { name: category }
          }
        },
        description,
        stock: parseInt(stock),
        soldCount: soldCount ? parseInt(soldCount) : 0,
        sizes: sizes ? (typeof sizes === 'string' ? sizes.split(',').map((s: string) => s.trim()) : sizes) : null,
        gender: gender || null,
        rating: rating ? parseFloat(rating) : 0,
        images: imageURLs,
        brand: brand || null,
        color: color ? (typeof color === 'string' && color.startsWith('{') ? JSON.parse(color) : color) : null,
        isFeatured: isFeatured === 'true' || isFeatured === true
      }
    });
    
    console.log('Product created:', newProduct);
    
    // Clean up uploaded files
    files.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        console.error('Error deleting file:', file.path, cleanupError);
      }
    });
    
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: newProduct
    });
    
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Clean up uploaded files on error
    try {
      const files = req.files as any[];
      if (files && files.length > 0) {
        files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
    } catch (cleanupError) {
      console.error('Error cleaning up files:', cleanupError);
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error creating product"
    });
  }
}



export const fetchProducts = async(req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const results = await prisma.product.findMany({
            include: {
                category: true  // Include category relation
            }
        })
        res.status(200).json(results)
    } catch (error) {
        console.log(error)
        res.status(401).json({success:false, error: "Error fetch Products"})
    }
}

export const fetchById = async(req: AuthenticatedRequest, res: Response) => {
    const {id} = req.params
    try {
      if(!id) {
        return;
      }  
      const product = await prisma.product.findUnique({
            where: {id},
            include: {
                category: true  
            }
        })
        if(!product) {
            res.status(404).json({success: false, error: "Product not found"})
            return
        }
        res.status(200).json(product)
    } catch (error) {
        console.log(error)
        res.status(403).json({success:false, error: "Error fetching product"})
    }
}

export const deleteProduct = async(req: AuthenticatedRequest, res: Response) => {
  const {id} = req.params;
  
  try {
    if(!id) {
      return res.status(400).json({success: false, error: "Product ID is required"});
    }

    // Check if product has any pending/active orders
    const activeOrders = await prisma.orderItem.findFirst({
      where: { 
        productId: getStringParam(req.query.productId), // FIX: Line 162
        order: {
          status: {
            in: ['PENDING', 'PROCESSING', 'SHIPPED'] // Not DELIVERED, CANCELLED, or REFUNDED
          }
        }
      },
      include: {
        order: true
      }
    });

    if (activeOrders) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete this product because it has active orders. Wait until all orders are delivered.' 
      });
    }

   
    await prisma.cartItem.deleteMany({
      where: { productID: getStringParam(req.query.productId) } // FIX: Line 183
    });

    
    await prisma.wishlistItem.deleteMany({
      where: { productId: getStringParam(req.query.productId) } // FIX: Line 188
    });

    const deleteProduct = await prisma.product.delete({
      where: {id: getStringParam(req.query.id)} // FIX: Line 192
    });

    res.json({success: true, message: 'Product deleted successfully'});
    
  } catch (error: any) {
    console.error('Error deleting product:', error);
    
  
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }

  
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete this product due to existing references.' 
      });
    }
    
    res.status(500).json({success: false, error: "Error deleting product"});
  }
}


export async function updateProduct(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    if(!id) {
      return
    }
    const {
      name: productName,  // ✅ Rename to avoid conflict
      price,
      category,
      description,
      stock,
      soldCount,
      sizes,
      gender,
      rating,
      brand,
      color,
      isFeatured,
      existingImages
    } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id: getStringParam(req.query.id) } // FIX: Line 247
    });

    if (!existingProduct) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

   
    const files = (req.files as any[]) || [];
    let newImageURLs: string[] = [];

    if (files.length > 0) {
      const uploadPromises = files.map(file =>
        cloudinary.uploader.upload(file.path, {
          folder: 'ecomerce'
        })
      );
      const uploadResults = await Promise.all(uploadPromises);
      newImageURLs = uploadResults.map(result => result.secure_url);
    }

    // Combine existing images with new ones
    const parsedExistingImages = existingImages 
      ? (typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages)
      : existingProduct.images;
    
    const allImages = [...parsedExistingImages, ...newImageURLs];

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: getStringParam(req.query.id) }, // FIX: Line 278
      data: {
        ...(productName && { name: productName }),  // ✅ Use renamed variable
        ...(price && { price: parseFloat(price) }),
        ...(category && { 
          category: {
            connectOrCreate: {
              where: { name: category },
              create: { name: category }
            }
          }
        }),
        ...(description && { description }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(soldCount !== undefined && { soldCount: parseInt(soldCount) }),
        ...(sizes && { sizes: sizes.split(',') }),
        ...(gender && { gender }),
        ...(rating !== undefined && { rating: parseFloat(rating) }),
        ...(brand && { brand }),
        ...(color && { color }),
        ...(isFeatured !== undefined && { 
          isFeatured: isFeatured === 'true' || isFeatured === true 
        }),
        images: allImages
      },
      include: {
        category: true  // ✅ Include category in response
      }
    });

    // Clean up uploaded files
    if (files.length > 0) {
      files.forEach(file => fs.unlinkSync(file.path));
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ 
      success: false, 
      error: "Error updating product" 
    });
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const { name } = req.body;
    
    
    if (!name) {
      return res.status(400).json({ success: false, error: "Category name is required" });
    }
    
    const response = await prisma.category.create({
      data: { name }
    });
    

    return res.status(201).json({ 
      success: true, 
      message: "Category created successfully",
      category: response 
    });
    
  } catch (error) {
    console.error("Create category error:", error);

    return res.status(500).json({ 
      success: false, 
      error: "Failed to create category" 
    });
  }
}

export const fetchCategories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany()
    res.status(200).json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ success: false, error: "Error fetching categories" })
  }
}

export const fetchProductsClient = async(req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(getStringParam(req.query.page) || '1')
    const limit = parseInt(getStringParam(req.query.limit) || '20')
    const category = ((getStringParam(req.query.category)) || '').split(',').filter(Boolean)
    const brands = ((getStringParam(req.query.brands)) || '').split(',').filter(Boolean)
    const sizes = ((getStringParam(req.query.sizes)) || '').split(',').filter(Boolean)
    const minPrice = parseFloat(getStringParam(req.query.minPrice) || '0')
    const maxPrice = parseFloat(getStringParam(req.query.maxPrice) || String(Number.MAX_SAFE_INTEGER))
    const sortBy = (getStringParam(req.query.sortBy) || 'createdAt') as string
    const sortOrder = ((getStringParam(req.query.sortOrder)) === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    const skip = (page - 1) * limit

    const andConditions: Prisma.ProductWhereInput[] = []

  if (category.length > 0) {
  andConditions.push({
    category: {
      name: {
        in: category  
      }
    }
  })
}

  
    if (brands.length > 0) {
      andConditions.push({
        brand: {
          in: brands
        }
      })
    }

    
    if (sizes.length > 0) {
      andConditions.push({
        OR: sizes.map(size => ({
          sizes: {
            path: ['$'],
            string_contains: size.toLowerCase()
          }
        }))
      })
    }

  
    andConditions.push({
      price: {
        gte: minPrice,
        lte: maxPrice
      }
    })

  
    const where: Prisma.ProductWhereInput = andConditions.length > 0 
      ? { AND: andConditions }
      : {}

   
    const totalProducts = await prisma.product.count({ where })

  
    const products = await prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder
      }
    })

  
    const totalPages = Math.ceil(totalProducts / limit)

  
    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })
    
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({
      success: false, 
      error: "Failed to fetch products on the client"
    })
  }
}