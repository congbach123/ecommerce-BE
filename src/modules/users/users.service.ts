import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UpdateUserDto, AdminUpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find();
    // Remove password from response
    return users.map((user) => this.excludePassword(user));
  }

  async findOne(id: string, currentUser?: User): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check authorization: users can view their own profile or admins can view anyone
    if (currentUser) {
      this.checkOwnershipOrAdmin(currentUser, id);
    }

    return this.excludePassword(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async update(
    id: string,
    updateData: UpdateUserDto | AdminUpdateUserDto,
    currentUser: User,
  ): Promise<User> {
    // Check authorization
    this.checkOwnershipOrAdmin(currentUser, id);

    // Find user to update
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // If updating role or isActive, only admins can do this
    if ('role' in updateData || 'isActive' in updateData) {
      if (currentUser.role !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Only administrators can change user role or active status',
        );
      }
    }

    // Map DTO fields to entity fields (camelCase to snake_case)
    const updateFields: Partial<User> = {};
    if (updateData.firstName !== undefined)
      updateFields.first_name = updateData.firstName;
    if (updateData.lastName !== undefined)
      updateFields.last_name = updateData.lastName;
    if (updateData.phone !== undefined) updateFields.phone = updateData.phone;

    // Admin-only fields
    if ('role' in updateData && updateData.role !== undefined)
      updateFields.role = updateData.role;
    if ('isActive' in updateData && updateData.isActive !== undefined)
      updateFields.is_active = updateData.isActive;

    // Apply updates
    Object.assign(user, updateFields);
    const updatedUser = await this.userRepository.save(user);

    return this.excludePassword(updatedUser);
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    const result = await this.userRepository.update(userId, { password: hashedPassword });
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }

  async remove(id: string, currentUser: User): Promise<void> {
    // Only admins can delete users (already enforced in controller, but double-check)
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can delete users');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.remove(user);
  }

  // Helper methods
  private checkOwnershipOrAdmin(currentUser: User, targetUserId: string): void {
    if (currentUser.id !== targetUserId && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }

  private excludePassword(user: User): User {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}
