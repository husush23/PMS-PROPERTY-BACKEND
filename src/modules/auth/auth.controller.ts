import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
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
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} from '../../common/utils/cookie.util';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user (creates global account without company)',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description:
      'User registered successfully. Tokens are set as HTTP-only cookies.',
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
  async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
    const authResponse = await this.authService.register(registerDto);

    // Set cookies
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    setAccessTokenCookie(
      res,
      authResponse.access_token!,
      expiresIn,
      this.configService,
    );
    setRefreshTokenCookie(
      res,
      authResponse.refresh_token,
      refreshExpiresIn,
      this.configService,
    );

    // Return response without tokens

    const {
      access_token: _access_token,
      refresh_token: _refresh_token,
      ...responseData
    } = authResponse;
    void _access_token;
    void _refresh_token;

    return res.json({
      success: true,
      data: responseData,
      message: 'User registered successfully',
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'User login (handles users with 0, 1, or multiple companies). Add ?return_token=true to get token in response for API clients.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description:
      'User logged in successfully. Tokens are set as HTTP-only cookies. Add ?return_token=true to get tokens in response body for API clients. If companies.length === 0, token has no companyId. If 1 company, auto-selected. If multiple, requires selection.',
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
  async login(
    @Body() loginDto: LoginDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const loginResponse = await this.authService.login(loginDto);

    // Set cookies (for browsers)
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    setAccessTokenCookie(
      res,
      loginResponse.access_token!,
      expiresIn,
      this.configService,
    );
    setRefreshTokenCookie(
      res,
      loginResponse.refresh_token,
      refreshExpiresIn,
      this.configService,
    );

    // Check if client wants token in response (for API clients like Thunder Client, Postman, etc.)
    // Check query parameter or header
    const wantsTokenInResponse =
      req.query['return_token'] === 'true' ||
      req.headers['x-return-token'] === 'true';

    if (wantsTokenInResponse) {
      // Return token in response body for API clients
      return res.json({
        success: true,
        data: loginResponse, // Include access_token and refresh_token
        message: loginResponse.requiresCompanySelection
          ? 'Please select a company'
          : 'User logged in successfully',
      });
    }

    // Default: Return response without tokens (for browsers with cookies)

    const {
      access_token: _access_token,
      refresh_token: _refresh_token,
      ...responseData
    } = loginResponse;
    void _access_token;
    void _refresh_token;

    return res.json({
      success: true,
      data: responseData,
      message: loginResponse.requiresCompanySelection
        ? 'Please select a company'
        : 'User logged in successfully',
    });
  }

  @Post('select-company')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Select company after login (if multiple companies)',
  })
  @ApiBody({ type: SelectCompanyDto })
  @ApiResponse({
    status: 200,
    description:
      'Company selected successfully. New tokens are set as HTTP-only cookies.',
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
    @Res() res: Response,
  ) {
    const authResponse = await this.authService.selectCompany(
      user.id,
      selectCompanyDto.companyId,
    );

    // Set cookies
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    setAccessTokenCookie(
      res,
      authResponse.access_token!,
      expiresIn,
      this.configService,
    );
    setRefreshTokenCookie(
      res,
      authResponse.refresh_token,
      refreshExpiresIn,
      this.configService,
    );

    // Return response without tokens

    const {
      access_token: _access_token,
      refresh_token: _refresh_token,
      ...responseData
    } = authResponse;
    void _access_token;
    void _refresh_token;

    return res.json({
      success: true,
      data: responseData,
      message: 'Company selected successfully',
    });
  }

  @Post('switch-company')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Switch company context' })
  @ApiBody({ type: SelectCompanyDto })
  @ApiResponse({
    status: 200,
    description:
      'Company switched successfully. New tokens are set as HTTP-only cookies.',
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
    @Res() res: Response,
  ) {
    // Same as select-company
    const authResponse = await this.authService.selectCompany(
      user.id,
      selectCompanyDto.companyId,
    );

    // Set cookies
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    setAccessTokenCookie(
      res,
      authResponse.access_token!,
      expiresIn,
      this.configService,
    );
    setRefreshTokenCookie(
      res,
      authResponse.refresh_token,
      refreshExpiresIn,
      this.configService,
    );

    // Return response without tokens

    const {
      access_token: _access_token,
      refresh_token: _refresh_token,
      ...responseData
    } = authResponse;
    void _access_token;
    void _refresh_token;

    return res.json({
      success: true,
      data: responseData,
      message: 'Company switched successfully',
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({
    status: 200,
    description:
      'Access token refreshed successfully. New tokens are set as HTTP-only cookies.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshCookieName =
      this.configService.get<string>('jwt.refreshCookieName') ??
      'refresh_token';
    const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;

    if (!refreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Refresh token not found',
      });
    }

    const tokens = await this.authService.refreshToken(refreshToken as string);

    // Set new cookies
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    setAccessTokenCookie(
      res,
      tokens.access_token,
      expiresIn,
      this.configService,
    );
    setRefreshTokenCookie(
      res,
      tokens.refresh_token,
      refreshExpiresIn,
      this.configService,
    );

    return res.json({
      success: true,
      message: 'Token refreshed successfully',
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and clear authentication cookies' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  logout(@Res() res: Response): void {
    clearAuthCookies(res, this.configService);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  @Get('companies')
  @ApiCookieAuth('access_token')
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
  @ApiOperation({
    summary: 'Get current authenticated user with role and company context',
  })
  @ApiResponse({
    status: 200,
    description:
      'Current user retrieved successfully with role and company context',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            isSuperAdmin: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            companyId: {
              type: 'string',
              nullable: true,
              description: 'Current company context (if selected)',
            },
            role: {
              type: 'string',
              nullable: true,
              description: 'User role in the current company context',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getCurrentUser(
    @AuthUser()
    user: {
      id: string;
      email: string;
      companyId?: string;
      role?: string;
      isSuperAdmin?: boolean;
    },
  ) {
    const userData = await this.authService.getCurrentUser(user.id);
    return {
      success: true,
      data: {
        ...userData,
        companyId: user.companyId || null,
        role: user.role || null,
      },
    };
  }

  @Patch('profile')
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
    const updatedUser = await this.authService.updateProfile(
      user.id,
      updateProfileDto,
    );
    return {
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
    };
  }

  @Patch('profile/password')
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
