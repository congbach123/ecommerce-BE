import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ShippingAddress } from './entities/shipping-address.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto } from './dto/query-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(ShippingAddress)
    private shippingAddressRepository: Repository<ShippingAddress>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private cartService: CartService,
    private mailService: MailService,
    private dataSource: DataSource,
  ) {}

  /**
   * Generate unique order number: ORD-YYYYMMDD-XXXX
   */
  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Count orders from today
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const count = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.created_at >= :todayStart', { todayStart })
      .getCount();
    
    const sequence = String(count + 1).padStart(4, '0');
    return `ORD-${dateStr}-${sequence}`;
  }

  /**
   * Create order from user's cart (with transaction)
   */
  async createOrder(userId: string, dto: CreateOrderDto, userEmail: string, userName: string) {
    // Get user's cart
    const cart = await this.cartService.getCart(userId, undefined);
    
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty. Add items before checking out.');
    }

    // Use transaction for order creation
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate stock for all items
      for (const item of cart.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.product_id },
        });
        
        if (!product) {
          throw new BadRequestException(`Product not found: ${item.product.name}`);
        }
        
        if (product.stock_quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`,
          );
        }
      }

      // 2. Generate order number
      const orderNumber = await this.generateOrderNumber();

      // 3. Calculate totals
      const subtotal = cart.subtotal;
      const shippingFee = 0; // Free shipping for now
      const tax = 0; // No tax calculation yet
      const discount = 0;
      const total = subtotal + shippingFee + tax - discount;

      // 4. Create order
      const order = new Order();
      order.user_id = userId;
      order.order_number = orderNumber;
      order.status = OrderStatus.PENDING;
      order.payment_status = dto.payment_method === 'cod' ? PaymentStatus.PENDING : PaymentStatus.PENDING;
      order.payment_method = dto.payment_method || 'cod';
      order.subtotal = subtotal;
      order.shipping_fee = shippingFee;
      order.tax = tax;
      order.discount = discount;
      order.total = total;
      order.notes = dto.notes || null;
      
      const savedOrder = await queryRunner.manager.save(order);

      // 5. Create order items
      const orderItems: OrderItem[] = [];
      for (const cartItem of cart.items) {
        const orderItem = new OrderItem();
        orderItem.order_id = savedOrder.id;
        orderItem.product_id = cartItem.product_id;
        orderItem.product_name = cartItem.product.name;
        orderItem.product_sku = null; // We don't have SKU in cart response
        orderItem.quantity = cartItem.quantity;
        orderItem.price = cartItem.price;
        orderItem.subtotal = cartItem.line_total;
        
        const savedItem = await queryRunner.manager.save(orderItem);
        orderItems.push(savedItem);
      }

      // 6. Create shipping address
      const shippingAddress = new ShippingAddress();
      shippingAddress.order_id = savedOrder.id;
      shippingAddress.first_name = dto.shipping_address.first_name;
      shippingAddress.last_name = dto.shipping_address.last_name;
      shippingAddress.email = dto.shipping_address.email || userEmail;
      shippingAddress.phone = dto.shipping_address.phone || null;
      shippingAddress.address_line1 = dto.shipping_address.address_line1;
      shippingAddress.address_line2 = dto.shipping_address.address_line2 || null;
      shippingAddress.city = dto.shipping_address.city;
      shippingAddress.state = dto.shipping_address.state || null;
      shippingAddress.postal_code = dto.shipping_address.postal_code || null;
      shippingAddress.country = dto.shipping_address.country;
      
      await queryRunner.manager.save(shippingAddress);

      // 7. Reduce product stock
      for (const cartItem of cart.items) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock_quantity: () => `stock_quantity - ${cartItem.quantity}` })
          .where('id = :id', { id: cartItem.product_id })
          .execute();
      }

      // 8. Clear cart
      await this.cartService.clearCart(userId, undefined);

      // 9. Commit transaction
      await queryRunner.commitTransaction();

      // 10. Send confirmation email (async, don't block)
      this.sendOrderConfirmation(
        shippingAddress.email || userEmail,
        dto.shipping_address.first_name,
        savedOrder,
        orderItems,
      ).catch((err) => console.error('Failed to send order email:', err));

      // 11. Return order details
      return this.findOne(savedOrder.id, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Send order confirmation email
   */
  private async sendOrderConfirmation(
    email: string,
    name: string,
    order: Order,
    items: OrderItem[],
  ) {
    try {
      await this.mailService.sendOrderConfirmationEmail(email, name, order, items);
    } catch (error) {
      console.error('Failed to send order confirmation email:', error);
    }
  }

  /**
   * Find all orders for a user
   */
  async findAllByUser(userId: string, query: QueryOrderDto) {
    const { page = 1, limit = 10, status, payment_status, sort, order } = query;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.user_id = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (payment_status) {
      queryBuilder.andWhere('order.payment_status = :payment_status', { payment_status });
    }

    const sortField = sort === 'total' ? 'order.total' : 'order.created_at';
    queryBuilder.orderBy(sortField, order || 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find all orders (admin)
   */
  async findAllAdmin(query: QueryOrderDto) {
    const { page = 1, limit = 10, status, payment_status, sort, order } = query;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'items');

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (payment_status) {
      queryBuilder.andWhere('order.payment_status = :payment_status', { payment_status });
    }

    const sortField = sort === 'total' ? 'order.total' : 'order.created_at';
    queryBuilder.orderBy(sortField, order || 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single order by ID
   */
  async findOne(id: string, userId?: string) {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.shipping_address', 'shipping_address')
      .leftJoinAndSelect('order.user', 'user')
      .where('order.id = :id', { id });

    if (userId) {
      queryBuilder.andWhere('order.user_id = :userId', { userId });
    }

    const order = await queryBuilder.getOne();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Cancel pending order
   */
  async cancelOrder(id: string, userId: string) {
    const order = await this.findOne(id, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    // Restore stock
    for (const item of order.items) {
      await this.productRepository
        .createQueryBuilder()
        .update(Product)
        .set({ stock_quantity: () => `stock_quantity + ${item.quantity}` })
        .where('id = :id', { id: item.product_id })
        .execute();
    }

    order.status = OrderStatus.CANCELLED;
    return this.orderRepository.save(order);
  }

  /**
   * Update order status (admin)
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

    if (dto.status) {
      order.status = dto.status;
    }

    if (dto.payment_status) {
      order.payment_status = dto.payment_status;
    }

    return this.orderRepository.save(order);
  }

  /**
   * Get order statistics (admin)
   */
  async getOrderStats() {
    const totalOrders = await this.orderRepository.count();
    
    const pendingOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PENDING },
    });

    const processingOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PROCESSING },
    });

    const deliveredOrders = await this.orderRepository.count({
      where: { status: OrderStatus.DELIVERED },
    });

    const cancelledOrders = await this.orderRepository.count({
      where: { status: OrderStatus.CANCELLED },
    });

    const totalRevenue = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.total)', 'total')
      .where('order.payment_status = :status', { status: PaymentStatus.PAID })
      .getRawOne();

    return {
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: Number(totalRevenue?.total || 0),
    };
  }
}
