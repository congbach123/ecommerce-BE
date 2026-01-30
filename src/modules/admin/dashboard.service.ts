import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  pendingOrders: number;
  lowStockProducts: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get overview statistics for dashboard
   */
  async getOverviewStats(): Promise<DashboardStats> {
    // Total revenue (only paid orders)
    const revenueResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.total)', 'total')
      .where('order.payment_status = :status', { status: PaymentStatus.PAID })
      .getRawOne();

    const totalRevenue = parseFloat(revenueResult?.total || '0');

    // Total orders
    const totalOrders = await this.orderRepository.count();

    // Total customers
    const totalCustomers = await this.userRepository.count({
      where: { role: 'customer' as any },
    });

    // AOV
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Pending orders
    const pendingOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PENDING },
    });

    // Low stock products (below 10)
    const lowStockProducts = await this.productRepository.count({
      where: { stock_quantity: MoreThan(-1) }, // Will refine with LessThan
    });

    const actualLowStock = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock_quantity < :threshold', { threshold: 10 })
      .getCount();

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue,
      pendingOrders,
      lowStockProducts: actualLowStock,
    };
  }

  /**
   * Get revenue chart data for last N days
   */
  async getRevenueChart(days: number = 7): Promise<RevenueDataPoint[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('DATE(order.created_at)', 'date')
      .addSelect('SUM(order.total)', 'revenue')
      .addSelect('COUNT(order.id)', 'orders')
      .where('order.created_at >= :startDate', { startDate })
      .andWhere('order.payment_status = :status', { status: PaymentStatus.PAID })
      .groupBy('DATE(order.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Fill in missing days with zeros
    const dataMap = new Map(
      result.map((r) => [r.date, { revenue: parseFloat(r.revenue), orders: parseInt(r.orders) }])
    );

    const chartData: RevenueDataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const data = dataMap.get(dateStr) || { revenue: 0, orders: 0 };
      chartData.push({
        date: dateStr,
        revenue: data.revenue,
        orders: data.orders,
      });
    }

    return chartData;
  }

  /**
   * Get recent orders
   */
  async getRecentOrders(limit: number = 10): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['user', 'items'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.stock_quantity < :threshold', { threshold })
      .andWhere('product.is_active = :active', { active: true })
      .orderBy('product.stock_quantity', 'ASC')
      .take(10)
      .getMany();
  }

  /**
   * Get top selling products
   */
  async getTopProducts(limit: number = 5): Promise<any[]> {
    const result = await this.orderItemRepository
      .createQueryBuilder('item')
      .select('item.product_id', 'productId')
      .addSelect('item.product_name', 'productName')
      .addSelect('SUM(item.quantity)', 'totalSold')
      .addSelect('SUM(item.subtotal)', 'totalRevenue')
      .groupBy('item.product_id')
      .addGroupBy('item.product_name')
      .orderBy('totalSold', 'DESC')
      .take(limit)
      .getRawMany();

    return result.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      totalSold: parseInt(r.totalSold),
      totalRevenue: parseFloat(r.totalRevenue),
    }));
  }
}
