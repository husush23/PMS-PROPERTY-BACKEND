import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettingsResponseDto } from './dto/company-settings-response.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CompanyContext } from '../../common/decorators/company-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../shared/enums/user-role.enum';
import { LateFeeType } from '../../shared/enums/late-fee-type.enum';
import { CompanySettings } from './entities/company-settings.entity';

@ApiTags('companies')
@Controller({ path: 'companies/settings', version: '1' })
@UseGuards(CompanyAccessGuard)
export class CompanySettingsController {
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
    const normalized = this.normalizeUpdateDto(updateDto);
    const settings = await this.settingsService.update(companyId, normalized);
    return {
      success: true,
      data: this.toResponse(settings),
      message: 'Company settings updated successfully',
    };
  }

  private normalizeUpdateDto(
    updateDto: UpdateCompanySettingsDto,
  ): UpdateCompanySettingsDto {
    const normalized: UpdateCompanySettingsDto = { ...updateDto };

    if (
      updateDto.gracePeriodDays !== undefined &&
      updateDto.defaultGracePeriodDays === undefined
    ) {
      normalized.defaultGracePeriodDays = updateDto.gracePeriodDays;
    }

    if (
      updateDto.lateFeeValue !== undefined &&
      updateDto.defaultLateFeeValue === undefined
    ) {
      normalized.defaultLateFeeValue = updateDto.lateFeeValue;
    }

    if (
      updateDto.lateFeeType !== undefined &&
      updateDto.defaultLateFeeType === undefined
    ) {
      normalized.defaultLateFeeType = this.mapLateFeeType(updateDto.lateFeeType);
    }

    return normalized;
  }

  private mapLateFeeType(value: string): LateFeeType {
    if (value === 'PERCENT') {
      return LateFeeType.PERCENTAGE;
    }
    if (value === 'PERCENTAGE') {
      return LateFeeType.PERCENTAGE;
    }
    if (value === 'FIXED') {
      return LateFeeType.FIXED;
    }
    return LateFeeType.NONE;
  }

  private toResponse(settings: CompanySettings): CompanySettingsResponseDto {
    return {
      ...settings,
      gracePeriodDays: settings.defaultGracePeriodDays,
      lateFeeType: settings.defaultLateFeeType,
      lateFeeValue: settings.defaultLateFeeValue,
    };
  }
}
