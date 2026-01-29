import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      console.warn('⚠️ STRIPE_SECRET_KEY not found. Stripe payments will fail.');
    }
    this.stripe = new Stripe(secretKey || '');
  }

  /**
   * Create a PaymentIntent for an order
   */
  async createPaymentIntent(order: Order): Promise<Stripe.PaymentIntent> {
    try {
      // Amount in cents
      const amount = Math.round(Number(order.total) * 100);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: order.currency.toLowerCase(),
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error: any) {
      console.error('Stripe PaymentIntent creation failed:', error);
      throw new BadRequestException(`Payment setup failed: ${error.message}`);
    }
  }

  /**
   * Retrieve a PaymentIntent by ID
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Construct and verify webhook event
   */
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundParams.amount = Math.round(amount * 100); // Convert to cents
      }

      return await this.stripe.refunds.create(refundParams);
    } catch (error: any) {
      console.error('Stripe refund failed:', error);
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey(): string {
    return this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') || '';
  }
}
