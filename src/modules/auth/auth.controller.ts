import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SelectCompanyDto } from './dto/select-company.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user (creates global account without company)' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Returns token without companyId. User can create company after login.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async register(@Body() registerDto: RegisterDto) {
    const authResponse = await this.authService.register(registerDto);
    return {
      success: true,
      data: authResponse,
      message: 'User registered successfully',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login (handles users with 0, 1, or multiple companies)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully. If companies.length === 0, token has no companyId. If 1 company, auto-selected. If multiple, requires selection.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
  })
  async login(@Body() loginDto: LoginDto) {
    const loginResponse = await this.authService.login(loginDto);
    return {
      success: true,
      data: loginResponse,
      message: loginResponse.requiresCompanySelection
        ? 'Please select a company'
        : 'User logged in successfully',
    };
  }

  @Post('select-company')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Select company after login (if multiple companies)' })
  @ApiBody({ type: SelectCompanyDto })
  @ApiResponse({
    status: 200,
    description: 'Company selected successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found or user does not belong to company',
  })
  async selectCompany(
    @Body() selectCompanyDto: SelectCompanyDto,
    @AuthUser() user: { id: string },
  ) {
    const authResponse = await this.authService.selectCompany(
      user.id,
      selectCompanyDto.companyId,
    );
    return {
      success: true,
      data: authResponse,
      message: 'Company selected successfully',
    };
  }

  @Post('switch-company')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Switch company context' })
  @ApiBody({ type: SelectCompanyDto })
  @ApiResponse({
    status: 200,
    description: 'Company switched successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found or user does not belong to company',
  })
  async switchCompany(
    @Body() selectCompanyDto: SelectCompanyDto,
    @AuthUser() user: { id: string },
  ) {
    // Same as select-company
    const authResponse = await this.authService.selectCompany(
      user.id,
      selectCompanyDto.companyId,
    );
    return {
      success: true,
      data: authResponse,
      message: 'Company switched successfully',
    };
  }

  @Get('companies')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get user's companies" })
  @ApiResponse({
    status: 200,
    description: 'Companies retrieved successfully',
  })
  async getUserCompanies(@AuthUser() user: { id: string }) {
    const companies = await this.authService.getUserCompanies(user.id);
    return {
      success: true,
      data: companies,
    };
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getCurrentUser(@AuthUser() user: { id: string; email: string; companyId?: string; role?: string }) {
    const userData = await this.authService.getCurrentUser(user.id);
    return {
      success: true,
      data: userData,
    };
  }

  @Patch('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update own profile (name, email)' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @AuthUser() user: { id: string },
  ) {
    const updatedUser = await this.authService.updateProfile(user.id, updateProfileDto);
    return {
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
    };
  }

  @Patch('profile/password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change own password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect',
  })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @AuthUser() user: { id: string },
  ) {
    await this.authService.changePassword(
      user.id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}






