import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IsEnum, IsOptional, IsBoolean } from 'class-validator';

class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

class UpdateStatusDto {
  @IsBoolean()
  is_active: boolean;
}

class QueryUsersDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  search?: string;

  @IsOptional()
  role?: UserRole;
}

@ApiTags('Admin - Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Returns paginated users' })
  async findAll(@Query() query: QueryUsersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (query.search) {
      queryBuilder.where(
        '(user.first_name LIKE :search OR user.last_name LIKE :search OR user.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.role) {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }

    const [users, total] = await queryBuilder
      .select([
        'user.id',
        'user.email',
        'user.first_name',
        'user.last_name',
        'user.role',
        'user.is_active',
        'user.created_at',
        'user.updated_at',
      ])
      .orderBy('user.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user detail' })
  async findOne(@Param('id') id: string) {
    return this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'created_at',
        'updated_at',
      ],
    });
  }

  @Put(':id/role')
  @ApiOperation({ summary: 'Update user role' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    await this.userRepository.update(id, { role: dto.role });
    return { message: 'Role updated successfully' };
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update user status' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    await this.userRepository.update(id, { is_active: dto.is_active });
    return { message: 'Status updated successfully' };
  }
}
