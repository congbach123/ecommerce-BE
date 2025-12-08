import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: Partial<User>; access_token: string }> {
    const { email, password, first_name, last_name, phone } = registerDto;

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password before storing
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      first_name,
      last_name,
      phone,
    });

    // Generate JWT token
    const access_token = this.generateToken(user);

    // Remove password from response for security
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, access_token };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: Partial<User>; access_token: string }> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.validatePassword(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Generate JWT token
    const access_token = this.generateToken(user);

    // Don't send password to client
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, access_token };
  }

  async validateUser(userId: string): Promise<Partial<User>> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Never expose password to the application
    const { password: _, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists for security reasons
      // But return success message anyway
      return {
        message:
          'If an account with that email exists, a password reset link has been sent',
      };
    }

    // Generate password reset token (valid for 1 hour)
    const reset_token = this.generatePasswordResetToken(user);

    // Send password reset email
    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.first_name,
        reset_token,
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't throw error - return success message for security
      // This prevents attackers from knowing if email exists
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent',
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, new_password } = resetPasswordDto;

    try {
      // Verify reset token
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid reset token');
      }

      // Find user
      const user = await this.usersService.findOne(payload.sub);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(new_password);

      // Update password
      await this.usersService.updatePassword(user.id, hashedPassword);

      return { message: 'Password reset successful' };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException('Reset token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Invalid reset token');
      }
      throw error;
    }
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  private generatePasswordResetToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'password_reset',
    };

    // Password reset tokens expire in 1 hour
    return this.jwtService.sign(payload, { expiresIn: '1h' });
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  private async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
