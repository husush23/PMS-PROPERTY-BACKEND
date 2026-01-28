import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { CompanySettings } from './entities/company-settings.entity';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { COMPANY_SETTINGS_MVP_DEFAULTS } from './company-settings.defaults';

@Injectable()
export class CompanySettingsService {
  constructor(
    @InjectRepository(CompanySettings)
    private settingsRepository: Repository<CompanySettings>,
  ) {}

  /**
   * Creates company_settings with MVP defaults. Used only by POST /companies (create-company flow).
   * If manager is provided, saves within that transaction; otherwise saves with default repository.
   */
  async createWithDefaults(
    companyId: string,
    allowedPaymentMethods: PaymentMethod[],
    manager?: EntityManager,
  ): Promise<CompanySettings> {
    const settings = this.settingsRepository.create({
      companyId,
      ...COMPANY_SETTINGS_MVP_DEFAULTS,
      allowedPaymentMethods,
    });
    if (manager) {
      return manager.getRepository(CompanySettings).save(settings);
    }
    return this.settingsRepository.save(settings);
  }

  async getOrCreate(companyId: string): Promise<CompanySettings> {
    const existing = await this.settingsRepository.findOne({
      where: { companyId },
    });
    if (existing) {
      return existing;
    }

    const created = this.settingsRepository.create({ companyId });
    return this.settingsRepository.save(created);
  }

  async update(
    companyId: string,
    updateDto: UpdateCompanySettingsDto,
  ): Promise<CompanySettings> {
    const settings = await this.getOrCreate(companyId);
    const updated = this.settingsRepository.merge(settings, updateDto);
    return this.settingsRepository.save(updated);
  }
}
