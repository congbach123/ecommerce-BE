import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  order_id: string;
}

export class ProcessPaymentDto {
  @IsString()
  @IsNotEmpty()
  order_id: string;

  @IsString()
  @IsIn(['stripe', 'vnpay'])
  payment_method: 'stripe' | 'vnpay';
}
