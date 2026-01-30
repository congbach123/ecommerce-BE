import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Admin - Dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Returns dashboard stats' })
  async getStats() {
    return this.dashboardService.getOverviewStats();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue chart data' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getRevenue(@Query('days') days?: string) {
    const numDays = days ? parseInt(days) : 7;
    return this.dashboardService.getRevenueChart(numDays);
  }

  @Get('recent-orders')
  @ApiOperation({ summary: 'Get recent orders' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentOrders(@Query('limit') limit?: string) {
    const numLimit = limit ? parseInt(limit) : 10;
    return this.dashboardService.getRecentOrders(numLimit);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock products' })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  async getLowStock(@Query('threshold') threshold?: string) {
    const num = threshold ? parseInt(threshold) : 10;
    return this.dashboardService.getLowStockProducts(num);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top selling products' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopProducts(@Query('limit') limit?: string) {
    const numLimit = limit ? parseInt(limit) : 5;
    return this.dashboardService.getTopProducts(numLimit);
  }
}
