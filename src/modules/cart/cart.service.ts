import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Get or create a cart for user or session
   */
  async getOrCreateCart(userId?: string, sessionId?: string): Promise<Cart> {
    let cart: Cart | null = null;

    if (userId) {
      cart = await this.cartRepository.findOne({
        where: { user_id: userId },
        relations: ['items', 'items.product', 'items.product.images'],
      });
    } else if (sessionId) {
      cart = await this.cartRepository.findOne({
        where: { session_id: sessionId },
        relations: ['items', 'items.product', 'items.product.images'],
      });
    }

    if (!cart) {
      const newCart = new Cart();
      newCart.user_id = userId ?? null;
      newCart.session_id = userId ? null : (sessionId ?? null);
      cart = await this.cartRepository.save(newCart);
      cart.items = [];
    }

    return cart;
  }

  /**
   * Get cart with items and product details
   */
  async getCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    return this.formatCartResponse(cart);
  }

  /**
   * Add item to cart
   */
  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: AddToCartDto,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const quantity = dto.quantity || 1;

    // Validate product exists and is active
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, is_active: true },
      relations: ['images'],
    });

    if (!product) {
      throw new NotFoundException('Product not found or is not available');
    }

    // Check stock
    if (product.stock_quantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${product.stock_quantity} available.`,
      );
    }

    // Check if product already in cart
    let cartItem = await this.cartItemRepository.findOne({
      where: {
        cart_id: cart.id,
        product_id: dto.product_id,
      },
    });

    if (cartItem) {
      // Update quantity
      const newQuantity = cartItem.quantity + quantity;
      if (newQuantity > product.stock_quantity) {
        throw new BadRequestException(
          `Cannot add more. Only ${product.stock_quantity} available, you already have ${cartItem.quantity} in cart.`,
        );
      }
      cartItem.quantity = newQuantity;
      cartItem.price = product.price;
      await this.cartItemRepository.save(cartItem);
    } else {
      // Create new cart item
      cartItem = this.cartItemRepository.create({
        cart_id: cart.id,
        product_id: dto.product_id,
        quantity,
        price: product.price,
      });
      await this.cartItemRepository.save(cartItem);
    }

    // Return updated cart
    return this.getCart(userId, sessionId);
  }

  /**
   * Update cart item quantity
   */
  async updateItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
    dto: UpdateCartItemDto,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const cartItem = await this.cartItemRepository.findOne({
      where: {
        id: itemId,
        cart_id: cart.id,
      },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Check stock
    if (dto.quantity > cartItem.product.stock_quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${cartItem.product.stock_quantity} available.`,
      );
    }

    cartItem.quantity = dto.quantity;
    await this.cartItemRepository.save(cartItem);

    return this.getCart(userId, sessionId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const cartItem = await this.cartItemRepository.findOne({
      where: {
        id: itemId,
        cart_id: cart.id,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(cartItem);

    return this.getCart(userId, sessionId);
  }

  /**
   * Clear all items from cart
   */
  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    await this.cartItemRepository.delete({ cart_id: cart.id });

    return this.getCart(userId, sessionId);
  }

  /**
   * Merge guest cart into user cart on login
   */
  async mergeCart(userId: string, sessionId: string) {
    if (!sessionId) {
      return this.getCart(userId, undefined);
    }

    // Get guest cart
    const guestCart = await this.cartRepository.findOne({
      where: { session_id: sessionId },
      relations: ['items', 'items.product'],
    });

    if (!guestCart || !guestCart.items?.length) {
      // No guest cart or empty, just return user cart
      return this.getCart(userId, undefined);
    }

    // Get or create user cart
    const userCart = await this.getOrCreateCart(userId, undefined);

    // Merge items
    for (const guestItem of guestCart.items) {
      const existingItem = await this.cartItemRepository.findOne({
        where: {
          cart_id: userCart.id,
          product_id: guestItem.product_id,
        },
      });

      if (existingItem) {
        // Add quantities (cap at stock)
        const product = await this.productRepository.findOne({
          where: { id: guestItem.product_id },
        });
        const maxQty = product?.stock_quantity || 0;
        existingItem.quantity = Math.min(
          existingItem.quantity + guestItem.quantity,
          maxQty,
        );
        existingItem.price = guestItem.price;
        await this.cartItemRepository.save(existingItem);
      } else {
        // Move item to user cart
        const newItem = this.cartItemRepository.create({
          cart_id: userCart.id,
          product_id: guestItem.product_id,
          quantity: guestItem.quantity,
          price: guestItem.price,
        });
        await this.cartItemRepository.save(newItem);
      }
    }

    // Delete guest cart
    await this.cartItemRepository.delete({ cart_id: guestCart.id });
    await this.cartRepository.remove(guestCart);

    return this.getCart(userId, undefined);
  }

  /**
   * Format cart response with calculated totals
   */
  private formatCartResponse(cart: Cart) {
    const items = cart.items || [];

    const formattedItems = items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product: {
        id: item.product?.id,
        name: item.product?.name,
        slug: item.product?.slug,
        price: Number(item.product?.price || 0),
        compare_price: item.product?.compare_price
          ? Number(item.product.compare_price)
          : null,
        stock_quantity: item.product?.stock_quantity || 0,
        image:
          item.product?.images?.find((img) => img.is_primary)?.image_url ||
          item.product?.images?.[0]?.image_url ||
          null,
      },
      quantity: item.quantity,
      price: Number(item.price),
      line_total: Number(item.price) * item.quantity,
    }));

    const subtotal = formattedItems.reduce(
      (sum, item) => sum + item.line_total,
      0,
    );
    const itemCount = formattedItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    return {
      id: cart.id,
      items: formattedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      itemCount,
    };
  }
}
