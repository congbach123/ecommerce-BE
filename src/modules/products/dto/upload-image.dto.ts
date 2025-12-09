import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadImageDto {
  @IsString()
  @IsOptional()
  alt_text?: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  is_primary?: boolean;
}
