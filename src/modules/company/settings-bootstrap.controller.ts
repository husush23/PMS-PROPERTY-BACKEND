import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CompanyContext } from '../../common/decorators/company-context.decorator';
import { CompanySettingsService } from './company-settings.service';
import { PaymentMethodsService } from '../payment-method/payment-methods.service';
import { CompanySettingsResponseDto } from './dto/company-settings-response.dto';
import { PaymentMethodResponseDto } from '../payment-method/dto/payment-method-response.dto';
import { CompanySettings } from './entities/company-settings.entity';
import { LateFeeType } from '../../shared/enums/late-fee-type.enum';

@ApiTags('settings')
@Controller({ path: 'settings/bootstrap', version: '1' })
@UseGuards(CompanyAccessGuard)
export class SettingsBootstrapController {
  constructor(
    private readonly settingsService: CompanySettingsService,
    private readonly paymentMethodsService: PaymentMethodsService,
  ) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Bootstrap settings data (settings + payment methods)' })
  @ApiResponse({
    status: 200,
    description: 'Settings bootstrap data retrieved successfully',
    type: Object,
  })
  async bootstrap(@CompanyContext() companyId: string) {
    const settings = await this.settingsService.getOrCreate(companyId);
    const paymentMethods = await this.paymentMethodsService.list(companyId);
    return {
      success: true,
      data: {
        settings: this.toResponse(settings),
        paymentMethods: paymentMethods as PaymentMethodResponseDto[],
      },
    };
  }

  private toResponse(settings: CompanySettings): CompanySettingsResponseDto {
    return {
      ...settings,
      gracePeriodDays: settings.defaultGracePeriodDays,
      lateFeeType: settings.defaultLateFeeType as LateFeeType,
      lateFeeValue: settings.defaultLateFeeValue,
    };
  }
}
