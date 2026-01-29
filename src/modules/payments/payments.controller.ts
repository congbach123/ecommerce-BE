import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Get Stripe publishable key
   */
  @Get('stripe/config')
  @ApiOperation({ summary: 'Get Stripe publishable key' })
  getStripeConfig() {
    return this.paymentsService.getStripePublishableKey();
  }

  /**
   * Create Stripe PaymentIntent
   */
  @Post('stripe/create-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe PaymentIntent' })
  @ApiResponse({ status: 201, description: 'PaymentIntent created' })
  async createStripeIntent(
    @Req() req: any,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentsService.createStripePaymentIntent(
      dto.order_id,
      req.user.id,
    );
  }

  /**
   * Stripe webhook handler
   */
  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleStripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleStripeWebhook(
      req.rawBody as Buffer,
      signature,
    );
  }

  /**
   * Create VNPay payment URL
   */
  @Post('vnpay/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create VNPay payment URL' })
  async createVNPayUrl(
    @Req() req: any,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    const ipAddr = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    return this.paymentsService.createVNPayPaymentUrl(
      dto.order_id,
      req.user.id,
      ipAddr,
    );
  }

  /**
   * VNPay return URL handler
   */
  @Get('vnpay/return')
  @ApiOperation({ summary: 'VNPay return URL handler' })
  async handleVNPayReturn(@Query() query: any, @Res() res: Response) {
    try {
      const result = await this.paymentsService.handleVNPayReturn(query);
      
      // Redirect to frontend with result
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      const redirectUrl = result.success
        ? `${frontendUrl}/checkout/payment/success?orderId=${result.orderId}`
        : `${frontendUrl}/checkout/payment/failed?orderId=${result.orderId}&message=${encodeURIComponent(result.message)}`;
      
      return res.redirect(redirectUrl);
    } catch (error: any) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      return res.redirect(`${frontendUrl}/checkout/payment/failed?message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * VNPay IPN (Instant Payment Notification) handler
   */
  @Post('vnpay/ipn')
  @ApiOperation({ summary: 'VNPay IPN callback' })
  async handleVNPayIPN(@Query() query: any) {
    const result = await this.paymentsService.handleVNPayReturn(query);
    
    // Return response for VNPay
    return {
      RspCode: result.success ? '00' : '99',
      Message: result.message,
    };
  }

  /**
   * Get payment status
   */
  @Get(':orderId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status' })
  async getPaymentStatus(
    @Req() req: any,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.getPaymentStatus(orderId, req.user.id);
  }

  /**
   * Process refund (Admin)
   */
  @Post(':orderId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process refund (Admin)' })
  async processRefund(
    @Param('orderId') orderId: string,
    @Body('amount') amount?: number,
  ) {
    return this.paymentsService.processRefund(orderId, amount);
  }
}
