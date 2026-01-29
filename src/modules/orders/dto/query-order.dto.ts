import { IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsIn(['pending', 'paid', 'failed', 'refunded'])
  payment_status?: string;

  @IsOptional()
  @IsIn(['created_at', 'total'])
  sort?: string = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';
}
