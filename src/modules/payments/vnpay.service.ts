import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Order } from '../orders/entities/order.entity';

interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  url: string;
  returnUrl: string;
}

interface VNPayReturnParams {
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_OrderInfo: string;
  vnp_PayDate: string;
  vnp_ResponseCode: string;
  vnp_TmnCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  [key: string]: string | undefined;
}

@Injectable()
export class VNPayService {
  private config: VNPayConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      tmnCode: this.configService.get<string>('VNPAY_TMN_CODE') || '',
      hashSecret: this.configService.get<string>('VNPAY_HASH_SECRET') || '',
      url: this.configService.get<string>('VNPAY_URL') || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: this.configService.get<string>('VNPAY_RETURN_URL') || 'http://localhost:3002/checkout/payment/vnpay-return',
    };

    if (!this.config.tmnCode || !this.config.hashSecret) {
      console.warn('⚠️ VNPay credentials not configured. VNPay payments will fail.');
    }
  }

  /**
   * Create VNPay payment URL
   */
  createPaymentUrl(order: Order, ipAddr: string = '127.0.0.1'): string {
    const date = new Date();
    const createDate = this.formatDate(date);
    const expireDate = this.formatDate(new Date(date.getTime() + 15 * 60 * 1000)); // 15 min expire

    // Amount in VND (no decimal, multiply by 100 for VNPay format)
    const amount = Math.round(Number(order.total) * 100);

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: order.order_number,
      vnp_OrderInfo: `Payment for order ${order.order_number}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount.toString(),
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    // Sort params and create query string
    const sortedParams = this.sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();
    
    // Create HMAC SHA512 signature
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Add signature to params
    sortedParams['vnp_SecureHash'] = signed;

    const queryString = new URLSearchParams(sortedParams).toString();
    return `${this.config.url}?${queryString}`;
  }

  /**
   * Validate return URL signature
   */
  validateReturn(params: VNPayReturnParams): {
    isValid: boolean;
    responseCode: string;
    orderId: string;
    transactionNo: string;
  } {
    const secureHash = params.vnp_SecureHash;
    
    // Remove hash fields from params
    const paramsToSign: Record<string, string | undefined> = { ...params };
    paramsToSign.vnp_SecureHash = undefined;
    paramsToSign.vnp_SecureHashType = undefined;

    // Filter out undefined values and sort
    const filteredParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(paramsToSign)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
    }
    const sortedParams = this.sortObject(filteredParams);
    const signData = new URLSearchParams(sortedParams).toString();
    
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const checkSum = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = secureHash === checkSum;

    return {
      isValid,
      responseCode: params.vnp_ResponseCode,
      orderId: params.vnp_TxnRef,
      transactionNo: params.vnp_TransactionNo,
    };
  }

  /**
   * Check if payment was successful
   */
  isPaymentSuccessful(responseCode: string): boolean {
    return responseCode === '00';
  }

  /**
   * Get response message for code
   */
  getResponseMessage(code: string): string {
    const messages: Record<string, string> = {
      '00': 'Transaction successful',
      '07': 'Deducted money successfully. Transaction is suspected of fraud',
      '09': 'Transaction failed: Card/Account not registered for InternetBanking',
      '10': 'Transaction failed: Incorrect card/account information more than 3 times',
      '11': 'Transaction failed: Payment timeout',
      '12': 'Transaction failed: Card/Account is locked',
      '13': 'Transaction failed: Incorrect OTP',
      '24': 'Transaction cancelled by customer',
      '51': 'Transaction failed: Insufficient balance',
      '65': 'Transaction failed: Exceeded daily transaction limit',
      '75': 'Bank is under maintenance',
      '79': 'Transaction failed: Incorrect payment password',
      '99': 'Other errors',
    };

    return messages[code] || 'Unknown error';
  }

  /**
   * Format date for VNPay
   */
  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  /**
   * Sort object keys alphabetically
   */
  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== '') {
        sorted[key] = obj[key];
      }
    }
    
    return sorted;
  }
}
