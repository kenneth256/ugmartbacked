import axios from 'axios'
import type { AuthenticatedRequest } from '../../../middleware/middleware.js';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from "../../prisma.js";
import { PaymentStatus } from '@prisma/client';

const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;


let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getPaypalAccessToken(): Promise<string> {
  
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log('Using cached PayPal token');
    return cachedToken;
  }

  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error('PayPal credentials are not configured');
    }

    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    console.log('Requesting new PayPal token...');

    const response = await axios.post(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
      }
    );

    // Cache the token for 8 hours (PayPal tokens last ~9 hours)
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (8 * 60 * 60 * 1000);

    return cachedToken as string;

  } catch (error) {
    console.error("PayPal access token error:", error);
    
    if (axios.isAxiosError(error)) {
      console.error("Status:", error.response?.status);
      console.error("Response data:", error.response?.data);
    }
    
    throw new Error("Failed to get PayPal access token");
  }
}


// This function:
// 1. Makes a POST request to PayPal's OAuth2 token endpoint
// 2. Sends credentials as Basic Auth (Base64 encoded Client ID and Secret)
// 3. Returns the access token needed for PayPal API calls

// **Note:** For production, change the URL to:
// https://api-m.paypal.com/v1/oauth2/token


export const createPaypalOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { items, total } = req.body;
   const userId = req.user?.userId;
     if(!userId) {
      res.status(404).json("Unauthorized access denied1")
     }
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Items array is required and cannot be empty',
      });
      return;
    }

    if (!total || typeof total !== 'number' || total <= 0) {
      res.status(400).json({
        success: false,
        error: 'Valid total amount is required',
      });
      return;
    }

    console.log('Creating PayPal order:', { itemCount: items.length, total });

    const access_token = await getPaypalAccessToken();

    // ✅ Convert items from UGX → USD and validate
    const paypalItems = items.map((item: any) => {
      if (!item.name || !item.price || !item.quantity || !item.id) {
        throw new Error('Invalid item data');
      }

      const usdPrice = Number(item.price) / 3600; 

      return {
        name: item.name,
        description: item.description || 'Product',
        sku: item.id,
        unit_amount: {
          currency_code: 'USD',
          value: usdPrice.toFixed(2), 
        },
        quantity: String(item.quantity), 
        category: 'PHYSICAL_GOODS' as const,
      };
    });

  
    const itemTotal = paypalItems.reduce(
      (sum, item) => sum + parseFloat(item.unit_amount.value) * Number(item.quantity),
      0
    );

  
   
    // console.log(total, itemTotal)
    // if (Math.abs(itemTotal - total) > 0.01) {
    //   res.status(400).json({
    //     success: false,
    //     error: 'Total amount does not match sum of items in USD',
    //   });
    //   return;
    // }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const response = await axios.post(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: itemTotal.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: itemTotal.toFixed(2),
                },
              },
            },
            items: paypalItems,
          },
        ],
        application_context: {
          brand_name: 'UGMART',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${frontendUrl}/payment/success`,
          cancel_url: `${frontendUrl}/payment/cancel`,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
          'PayPal-Request-Id': uuidv4(),
        },
      }
    );

    res.status(200).json({
      success: true,
      data: response.data.id,
    });
  } catch (error) {
    console.error('Create PayPal order error:', error);

    if (axios.isAxiosError(error)) {
      console.error('PayPal API Error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      res.status(error.response?.status || 500).json({
        success: false,
        error: 'Failed to create PayPal order',
        details: error.response?.data,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error occurred',
      });
    }
  }
};


export const capturePaypalOrder = async(req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {orderId} = req.body;
     const userId = req.user?.userId;
     if(!userId) {
      res.status(404).json("Unauthorized access denied1")
     }
    // ✅ validate orderId
    if (!orderId || typeof orderId !== 'string') {
      res.status(400).json({ 
        success: false, 
        error: 'Valid Order ID is required' 
      });
      return;
    }

    // ✅ Validate orderId format
    if (!/^[A-Z0-9]+$/.test(orderId)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid Order ID format' 
      });
      return;
    }
    
    console.log('Capturing PayPal order:', orderId);
    
    const access_token = await getPaypalAccessToken();
    
    const response = await axios.post(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    
   
    const captureData = response.data;
    const transactionId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const status = captureData.status;
    
    console.log('PayPal order captured:', {
      orderId,
      transactionId,
      status
    });
    
  
    res.status(200).json({
      success: true,
      data: {
        orderId: captureData.id,
        status: captureData.status,
        transactionId: transactionId,
        payerEmail: captureData.payer?.email_address,
        amount: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount,
        captureDetails: captureData 
      }
    });
    
  } catch (error) {
    console.error('Capture PayPal order error:', error);
    
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      
      console.error('PayPal Capture Error:', {
        status: errorStatus,
        data: errorData
      });

    
      let errorMessage = 'Failed to capture PayPal order';
      
      if (errorData?.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED') {
        errorMessage = 'This order has already been captured';
      } else if (errorData?.details?.[0]?.issue === 'ORDER_NOT_APPROVED') {
        errorMessage = 'Order has not been approved by the payer yet';
      } else if (errorData?.details?.[0]?.issue === 'ORDER_EXPIRED') {
        errorMessage = 'This order has expired';
      }
      
      res.status(errorStatus || 500).json({
        success: false,
        error: errorMessage,
        details: errorData
      });
      return; 
      
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error occurred'
      });
      return; 
    }
  }
};


export const createOrder = async(req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {items, addressId, couponId, totalAmount, paymentMethod, transactionId} = req.body;
    
    // ✅ Comprehensive validation
    if(!userId) {
      res.status(401).json({success: false, message: 'User not authenticated'});
      return;
    }

    if(!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({success: false, message: 'Order must have at least one item'});
      return;
    }

    if(!addressId || typeof addressId !== 'string') {
      res.status(400).json({success: false, message: 'Valid address ID is required'});
      return;
    }

    if(!totalAmount || typeof totalAmount !== 'number' || totalAmount <= 0) {
      res.status(400).json({success: false, message: 'Valid total amount is required'});
      return;
    }

    if(!paymentMethod || typeof paymentMethod !== 'string') {
      res.status(400).json({success: false, message: 'Payment method is required'});
      return;
    }


    for(const item of items) {
      if(!item.productId || !item.name || !item.quantity || !item.price) {
        res.status(400).json({
          success: false, 
          message: 'Invalid item data - productId, name, quantity, and price are required'
        });
        return;
      }

      if(item.quantity <= 0) {
        res.status(400).json({
          success: false, 
          message: `Invalid quantity for ${item.name}`
        });
        return;
      }
    }

    // ✅ Verify address exists and belongs to user
    const address = await prisma.address.findFirst({
      where: { 
        id: addressId, 
        userId: userId 
      }
    });

    if (!address) {
      res.status(404).json({
        success: false, 
        message: 'Address not found or does not belong to you'
      });
      return;
    }

    // ✅ Verify and validate coupon if provided
    if (couponId) {
      const coupon = await prisma.coupon.findUnique({
        where: { id: couponId }
      });

      if (!coupon) {
        res.status(404).json({success: false, message: 'Coupon not found'});
        return;
      }

      // Check if expired
      if (coupon.endDate && coupon.endDate < new Date()) {
        res.status(400).json({success: false, message: 'Coupon has expired'});
        return;
      }

      

      // Check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        res.status(400).json({success: false, message: 'Coupon usage limit reached'});
        return;
      }
    }

    const order = await prisma.$transaction(async(prisma) => {
      // ✅ Verify all products exist and have sufficient stock
      for(const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product not found: ${item.name}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }
      }

      
      const newOrder = await prisma.order.create({
        data: {
          userId,
          addressId,
          couponId,
          totalAmount,
          paymentStatus: PaymentStatus.PAID,
          ...(paymentMethod && {
            payment: {
              create: {
                amount: totalAmount,
                paymentMethod: paymentMethod,
                transactionId: transactionId || null,
                status: PaymentStatus.PAID,
              }
            }
          }), 
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              productName: item.name,
              quantity: item.quantity,
              category: item.category,
              price: item.price,
              size: item.size || null,
              color: item.color || null,
            }))
          },
        },
        include: {
          items: {
            include: {
              product: true 
            }
          },
          payment: true,
          address: true,
        },
      });

      // ✅ Updating product stock (atomic operation)
      for(const item of items) {
        await prisma.product.update({
          where: {id: item.productId},
          data: {
            stock: {decrement: item.quantity},
            soldCount: {increment: item.quantity}
          }
        });
      }

      // ✅ Clearing the cart
      await prisma.cartItem.deleteMany({
        where: {
          cart: {
            userId: userId
          }
        }
      });

      // ✅ Updating coupon usage
      if(couponId) {
        await prisma.coupon.update({
          where: {id: couponId},
          data: {
            usageCount: {increment: 1}
          }
        });
      }

      return newOrder;
    }, {
    //   transaction options
      maxWait: 5000, 
      timeout: 10000, 
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });

  } catch (error) {
    console.error('Create order error:', error);
    
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Checking for specific errors
    if (errorMessage.includes('Insufficient stock')) {
      res.status(400).json({
        success: false,
        message: errorMessage
      });
    } else if (errorMessage.includes('Product not found')) {
      res.status(404).json({
        success: false,
        message: errorMessage
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create order',
        error: errorMessage
      });
    }
  }
};


export const getOrder = async(req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {orderId} = req.params;
    
    
    if(!userId) {
      res.status(401).json({success: false, error: 'User not authenticated'});
      return;
    }
    
    // ✅ Validating orderId
    if(!orderId || typeof orderId !== 'string') {
      res.status(400).json({success: false, error: 'Valid order ID is required'});
      return;
    }
    
    // ✅ getting the order
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: userId // this is  Ensuring that a user can only see their own orders
      },
      include: {
        items: {
          include: {
            product: true 
          }
        },
        address: true,
        coupon: true,
        payment: true, 
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // ✅ Checking if order exists
    if (!order) {
      res.status(404).json({
        success: false, 
        error: 'Order not found'
      });
      return;
    }
    
    res.status(200).json({
      success: true, 
      data: order
    });
    
  } catch (error) {
    console.error('Get order error:', error); 
    res.status(500).json({
      success: false, 
      error: 'Internal error occurred' 
    });
  }
};


export const updateOrder = async(req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const orderId = req.params.id;
    const status = req.body?.status;
    
    if(!userId) {
      res.status(401).json({success: false, error: 'Unauthorized access denied!'});
      return;
    }
    
    if(!orderId || !status) {
      res.status(400).json({success: false, error: 'Missing data!'})
      return
    }
    
    const order = await prisma.order.update({
      where: {id: orderId},
      data: { status }
    })
    
    res.status(200).json({success: true, message: 'Order status updated successfully!'})
  } catch (error) {
    res.status(500).json({success: false, error: 'Internal error occurred!'});
    return;
  }
}

export const getOrders = async(req: AuthenticatedRequest, res: Response) => {
    console.log('📦 getOrders called');
    console.log('User:', req.user);
    
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;
        if(!userId) {
            console.log('❌ No userId found');
            res.status(401).json({success: false, error: 'Unauthorized access denied!'});
            return;
        }
        
        if(userRole !== 'SUPER_ADMIN') {
            console.log('❌ Not admin role:', userRole);
            res.status(403).json({success: false, error: 'Admin access required!'});
            return;
        }
        
        
        
        const orders = await prisma.order.findMany({
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                address: true,
                user: {
                   select: {
                       id: true,
                       name: true,
                       email: true,
                   }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        console.log('✅ Orders fetched:', orders.length);
        
        res.status(200).json({success: true, data: orders});
        console.log('✅ Response sent');
        
    } catch (error) {
        console.error('❌ Error fetching admin orders:', error);
        res.status(500).json({success: false, error: 'Internal error occurred!'}); 
        return;           
    }  
}

export const getOrderByUser = async(req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if(!userId) {
            res.status(404).json({success: false, error: 'Unauthorized access denied!'});
            return;
        }
      
        const orders = await prisma.order.findMany({
            where: {userId: userId},
            include: {
                items: true,
                address: true,
            }
        })
        res.status(200).json({success: true, data: orders})
    } catch (error) {
        res.status(500).json({success: false, err: 'Internal error poccured!'}) ;
        return       
    }

}
export const getOrderById = async(req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {id} = req.params;
    
    if(!userId || !id) {
      res.status(401).json({success: false, error: 'Unauthorized access denied!'});
      return;
    }
    
    const order = await prisma.order.findFirst({
  where: {userId: userId, id},
  include: {
    items: true,
    address: true,
  }
})
    
    if(!order) {
      res.status(404).json({success: false, error: 'Order not found'});
      return;
    }
    
    res.status(200).json({success: true, data: order})
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({success: false, error: 'Internal error occurred!'});
  }
}