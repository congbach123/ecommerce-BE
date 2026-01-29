import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Optional JWT Guard - extracts user if token is present, but doesn't require it
 */
class OptionalJwtAuthGuard extends JwtAuthGuard {
  handleRequest(err: any, user: any) {
    // Don't throw error if no user, just return null
    return user || null;
  }
}

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get current cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest cart' })
  @ApiResponse({ status: 200, description: 'Returns the cart with items' })
  async getCart(
    @Request() req: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const userId = req.user?.id;
    return this.cartService.getCart(userId, sessionId);
  }

  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  async addItem(
    @Request() req: any,
    @Headers('x-session-id') sessionId: string,
    @Body() dto: AddToCartDto,
  ) {
    const userId = req.user?.id;
    return this.cartService.addItem(userId, sessionId, dto);
  }

  @Put('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest cart' })
  @ApiResponse({ status: 200, description: 'Cart item updated' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  async updateItem(
    @Request() req: any,
    @Headers('x-session-id') sessionId: string,
    @Param('id') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const userId = req.user?.id;
    return this.cartService.updateItem(userId, sessionId, itemId, dto);
  }

  @Delete('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest cart' })
  @ApiResponse({ status: 200, description: 'Item removed from cart' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async removeItem(
    @Request() req: any,
    @Headers('x-session-id') sessionId: string,
    @Param('id') itemId: string,
  ) {
    const userId = req.user?.id;
    return this.cartService.removeItem(userId, sessionId, itemId);
  }

  @Delete()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Clear cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared' })
  async clearCart(
    @Request() req: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const userId = req.user?.id;
    return this.cartService.clearCart(userId, sessionId);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Merge guest cart with user cart' })
  @ApiHeader({ name: 'x-session-id', required: true, description: 'Session ID of guest cart to merge' })
  @ApiResponse({ status: 200, description: 'Carts merged successfully' })
  async mergeCart(
    @Request() req: any,
    @Headers('x-session-id') sessionId: string,
  ) {
    return this.cartService.mergeCart(req.user.id, sessionId);
  }
}
