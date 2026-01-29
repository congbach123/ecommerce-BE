import { IsOptional, IsIn } from 'class-validator';
import { OrderStatus, PaymentStatus } from '../entities/order.entity';

export class UpdateOrderStatusDto {
  @IsOptional()
  @IsIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
  status?: OrderStatus;

  @IsOptional()
  @IsIn(['pending', 'paid', 'failed', 'refunded'])
  payment_status?: PaymentStatus;
}
