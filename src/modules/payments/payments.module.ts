import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripeService } from './stripe.service';
import { VNPayService } from './vnpay.service';
import { Order } from '../orders/entities/order.entity';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    MailModule,
    AuthModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, VNPayService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
