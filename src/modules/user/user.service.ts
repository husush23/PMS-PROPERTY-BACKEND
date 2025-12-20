import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PasswordUtil } from '../../common/utils/password.util';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(paginationQuery?: PaginationQueryDto): Promise<{
    data: UserResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = paginationQuery?.page || 1;
    const limit = paginationQuery?.limit || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepository.findAndCount({
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map(this.toResponseDto),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.toResponseDto(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check for duplicate email
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException(`User with email ${createUserDto.email} already exists`);
    }

    // Hash password
    const hashedPassword = await PasswordUtil.hash(createUserDto.password);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);
    return this.toResponseDto(savedUser);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    // Check if user exists
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check for duplicate email if email is being updated
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.findByEmail(updateUserDto.email);
      if (emailExists) {
        throw new ConflictException(`User with email ${updateUserDto.email} already exists`);
      }
    }

    // Hash password if it's being updated
    const updateData: Partial<User> = { ...updateUserDto };
    if (updateUserDto.password) {
      updateData.password = await PasswordUtil.hash(updateUserDto.password);
    }

    await this.userRepository.update(id, updateData);
    const updatedUser = await this.userRepository.findOne({ where: { id } });
    return this.toResponseDto(updatedUser!);
  }

  async delete(id: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const result = await this.userRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  private toResponseDto(user: User): UserResponseDto {
    const { password, ...userResponse } = user;
    return userResponse as UserResponseDto;
  }
}






