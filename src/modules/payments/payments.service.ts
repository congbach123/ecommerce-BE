import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatus } from '../orders/entities/order.entity';
import { StripeService } from './stripe.service';
import { VNPayService } from './vnpay.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private stripeService: StripeService,
    private vnpayService: VNPayService,
    private mailService: MailService,
  ) {}

  /**
   * Create Stripe PaymentIntent for order
   */
  async createStripePaymentIntent(orderId: string, userId: string) {
    const order = await this.findOrderForPayment(orderId, userId);

    const paymentIntent = await this.stripeService.createPaymentIntent(order);

    // Store payment intent ID
    await this.orderRepository.update(order.id, {
      payment_method: 'stripe',
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: order.total,
      currency: order.currency,
    };
  }

  /**
   * Create VNPay payment URL
   */
  async createVNPayPaymentUrl(orderId: string, userId: string, ipAddr: string) {
    const order = await this.findOrderForPayment(orderId, userId);

    const paymentUrl = this.vnpayService.createPaymentUrl(order, ipAddr);

    // Update payment method
    await this.orderRepository.update(order.id, {
      payment_method: 'vnpay',
    });

    return {
      paymentUrl,
      orderNumber: order.order_number,
    };
  }

  /**
   * Handle Stripe webhook event
   */
  async handleStripeWebhook(payload: Buffer, signature: string) {
    const event = this.stripeService.constructWebhookEvent(payload, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as any, 'stripe');
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as any, 'stripe');
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle VNPay return
   */
  async handleVNPayReturn(params: any) {
    const result = this.vnpayService.validateReturn(params);

    if (!result.isValid) {
      throw new BadRequestException('Invalid VNPay signature');
    }

    const order = await this.orderRepository.findOne({
      where: { order_number: result.orderId },
      relations: ['items', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (this.vnpayService.isPaymentSuccessful(result.responseCode)) {
      await this.markOrderPaid(order, result.transactionNo);
    } else {
      await this.markOrderPaymentFailed(order);
    }

    return {
      success: this.vnpayService.isPaymentSuccessful(result.responseCode),
      message: this.vnpayService.getResponseMessage(result.responseCode),
      orderId: order.id,
      orderNumber: order.order_number,
    };
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, user_id: userId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      total: order.total,
    };
  }

  /**
   * Process refund (Admin)
   */
  async processRefund(orderId: string, amount?: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment_status !== PaymentStatus.PAID) {
      throw new BadRequestException('Order has not been paid');
    }

    if (order.payment_method === 'stripe') {
      // For Stripe, we'd need to store the paymentIntentId
      // This is a simplified version
      throw new BadRequestException('Stripe refund requires payment intent ID');
    }

    // Update order status
    await this.orderRepository.update(order.id, {
      payment_status: PaymentStatus.REFUNDED,
    });

    return {
      success: true,
      orderId: order.id,
      refundedAmount: amount || order.total,
    };
  }

  /**
   * Get Stripe publishable key
   */
  getStripePublishableKey() {
    return {
      publishableKey: this.stripeService.getPublishableKey(),
    };
  }

  /**
   * Find order for payment with validation
   */
  private async findOrderForPayment(orderId: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, user_id: userId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment_status === PaymentStatus.PAID) {
      throw new BadRequestException('Order already paid');
    }

    if (order.payment_status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Order has been refunded');
    }

    return order;
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentData: any, method: string) {
    const orderId = paymentData.metadata?.order_id;
    
    if (!orderId) {
      console.error('No order ID in payment metadata');
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'user', 'shipping_address'],
    });

    if (!order) {
      console.error('Order not found:', orderId);
      return;
    }

    await this.markOrderPaid(order, paymentData.id);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentData: any, method: string) {
    const orderId = paymentData.metadata?.order_id;
    
    if (!orderId) return;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) return;

    await this.markOrderPaymentFailed(order);
  }

  /**
   * Mark order as paid
   */
  private async markOrderPaid(order: Order, transactionId: string) {
    await this.orderRepository.update(order.id, {
      payment_status: PaymentStatus.PAID,
      status: 'processing' as any,
    });

    // Send confirmation email
    if (order.user?.email) {
      try {
        await this.mailService.sendOrderConfirmationEmail(
          order.user.email,
          order.user.first_name,
          order,
          order.items,
        );
      } catch (error) {
        console.error('Failed to send payment confirmation email:', error);
      }
    }

    console.log(`✅ Order ${order.order_number} marked as paid (Transaction: ${transactionId})`);
  }

  /**
   * Mark order payment as failed
   */
  private async markOrderPaymentFailed(order: Order) {
    await this.orderRepository.update(order.id, {
      payment_status: PaymentStatus.FAILED,
    });

    console.log(`❌ Order ${order.order_number} payment failed`);
  }
}
