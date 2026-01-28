import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettingsResponseDto } from './dto/company-settings-response.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CompanyContext } from '../../common/decorators/company-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../shared/enums/user-role.enum';
import { CompanySettings } from './entities/company-settings.entity';

@ApiTags('settings')
@Controller({ path: 'settings/company', version: '1' })
@UseGuards(CompanyAccessGuard)
export class CompanySettingsAliasController {
  constructor(private readonly settingsService: CompanySettingsService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current company settings' })
  @ApiResponse({
    status: 200,
    description: 'Company settings retrieved successfully',
    type: CompanySettingsResponseDto,
  })
  async getSettings(@CompanyContext() companyId: string) {
    const settings = await this.settingsService.getOrCreate(companyId);
    return {
      success: true,
      data: this.toResponse(settings),
    };
  }

  @Patch()
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.COMPANY_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update company settings (COMPANY_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Company settings updated successfully',
    type: CompanySettingsResponseDto,
  })
  async updateSettings(
    @CompanyContext() companyId: string,
    @Body() updateDto: UpdateCompanySettingsDto,
  ) {
    const settings = await this.settingsService.update(companyId, updateDto);
    return {
      success: true,
      data: this.toResponse(settings),
      message: 'Company settings updated successfully',
    };
  }

  private toResponse(settings: CompanySettings): CompanySettingsResponseDto {
    return {
      ...settings,
    };
  }
}
