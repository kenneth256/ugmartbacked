import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/middleware.js";
import prisma from "../../prisma.js";

export const addToCart = async(req: AuthenticatedRequest, res: Response) => {
  
    console.log('User ID:', req.user?.userId); 
    try {
        const userId = req.user?.userId;
        const {quantity, color, size, productID} = req.body;
        if(!userId) {
            res.status(403).json({success:false, message: "Invalid user!"})
            return;
        }

        const cart = await prisma?.cart.upsert({
            where: {userId},
            create: {userId},
            update: {}
        })
        const cartItem  = await prisma.cartItem.upsert({
            where: {
                cartId_productID_color_size: {
                    cartId: cart.id,
                    size: size ?? null,
                    productID,
                    color: color ?? null
                }
            },
            update: {
                quantity: {increment: quantity}
            },
            create: {
                cartId: cart?.id,
                size,
                color,
                quantity,
                productID

            },
            
        })
        const product = await prisma.product.findUnique({
            where: {
                id: productID
            },
            select: {
                name: true,
                price: true,
                images: true
            }
        })
        const responseItem = {
            id: cartItem.id,
            productId: cartItem.productID,
             name: product?.name,
             price: product?.price,
            image: (product?.images as string[])?.[0] || null,
            color: cartItem.color,
            size: cartItem.size,
            quantity: cartItem.quantity

        }
     
res.status(201).json({
  success: true, 
  message: 'Item added to cart!',
  data: responseItem 
})
    } catch (error) {
        console.log(error);
        res.status(501).json({success: false, error: 'Internal error occured'})
    }
}

export const getCart = async(req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if(!userId) {
      res.status(403).json({success: false, message: "Invalid user!"})
      return;
    }
    
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        cartItems: true
      }
    });
    
    if (!cart || cart.cartItems.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }
    
    const cartWithProducts = await Promise.all(
      cart.cartItems.map(async(item) => {
        const product = await prisma.product.findUnique({
          where: {
            id: item.productID,
          },
          select: {
            images: true,
            price: true,
            name: true
          }
        });
        
        if (!product) {
          return null;
        }
        
        return {
          id: item.id,                    // ✅ Cart item ID
          productId: item.productID,      // ✅ FIXED: Actual product ID
          name: product.name,
          image: Array.isArray(product.images) ? product.images[0] : null, // ✅ Better handling
          color: item.color,
          size: item.size,
          price: product.price,
          quantity: item.quantity,
        }
      })
    );
    
    
    const validCartItems = cartWithProducts.filter(item => item !== null);
    
    res.json({ success: true, data: validCartItems });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: 'Internal error occurred' });
  }
}

export const removeFromCart = async(req: AuthenticatedRequest, res: Response) => {
  console.log('=== REMOVE FROM CART DEBUG ===');
  console.log('User ID:', req.user?.userId);
  console.log('Cart Item ID:', req.params.id);
  
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Invalid user!" 
      });
    }
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Cart item ID is required" 
      });
    }
    
    // First, get the user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { id: true }
    });
    
    console.log('User Cart:', cart);
    
    if (!cart) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart not found" 
      });
    }
    
    // Find the cart item by ID and verify it belongs to this cart
    const cartItem = await prisma.cartItem.findUnique({
      where: { id }
    });
    
    console.log('Cart Item Found:', cartItem);
    
    if (!cartItem) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart item not found" 
      });
    }
    
    // Verify the cart item belongs to this user's cart
    if (cartItem.cartId !== cart.id) {
      return res.status(403).json({ 
        success: false, 
        message: "Unauthorized access to cart item" 
      });
    }
    
    console.log('Current Quantity:', cartItem.quantity);
    
    // If quantity > 1, decrement quantity
    if (cartItem.quantity > 1) {
      const updatedItem = await prisma.cartItem.update({
        where: { id: cartItem.id },
        data: { 
          quantity: cartItem.quantity - 1 
        }
      });
      
      console.log('Quantity decremented to:', updatedItem.quantity);
      
      // Get product details for response
      const product = await prisma.product.findUnique({
        where: { id: updatedItem.productID },
        select: {
          name: true,
          price: true,
          images: true
        }
      });
      
      const responseItem = {
        id: updatedItem.id,
        productId: updatedItem.productID,
        name: product?.name,
        price: product?.price,
        image: Array.isArray(product?.images) ? product.images[0] : null,
        color: updatedItem.color,
        size: updatedItem.size,
        quantity: updatedItem.quantity
      };
      
      return res.status(200).json({ 
        success: true, 
        message: "Quantity decreased",
        data: responseItem
      });
    } else {
      // If quantity = 1, remove the item completely
      await prisma.cartItem.delete({
        where: { id: cartItem.id }
      });
      
      console.log('Item removed completely');
      
      return res.status(200).json({ 
        success: true, 
        message: "Item removed from cart"
      });
    }
    
  } catch (error) {
    console.error("Remove from cart error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to remove item",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
export const clearCart = async(req: AuthenticatedRequest, res: Response) => {
    try {
         const userId = req.user?.userId;
    const { id, quantity } = req.body;
    
    if (!userId) {
      return res.status(403).json({ success: false, message: "Invalid user!" });
    }

const response = await prisma.cartItem.deleteMany({
    where: {
        cart: {userId}
    }
})

res.status(200).json({success: true, message: 'Cart Cleared successfully!'})        
    } catch (error) {
        console.error("Remove from cart error:", error);
    res.status(500).json({ success: false, message: "Internal error occured!" });
    }
}
export const updateCart = async(req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, quantity } = req.body;
    
    if (!userId) {
      return res.status(403).json({ success: false, message: "Invalid user!" });
    }
    
    
    const updateResult = await prisma.cartItem.updateMany({
      where: {
        id,
        cart: { userId }
      },
      data: { quantity }
    });
    
    if (updateResult.count === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart item not found" 
      });
    }
    
    
    const updateItem = await prisma.cartItem.findUnique({
      where: { id }
    });
    
    if (!updateItem) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart item not found" 
      });
    }
    
    const product = await prisma.product.findUnique({
      where: { id: updateItem.productID },
      select: {
        name: true,
        price: true,
        images: true
      }
    });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }
    
    const images = product.images as string[] | null;
    
    const responseItem = {
      id: updateItem.id,
      name: product.name,
      color: updateItem.color,
      size: updateItem.size,
      price: product.price,
      quantity: updateItem.quantity,
      productId: updateItem.productID,
      image: images?.[0] || null,
    };
    
    res.status(200).json({
      success: true,
      data: responseItem
    });
    
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update cart item" 
    });
  }
};