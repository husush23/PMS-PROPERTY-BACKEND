import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanySettings } from './entities/company-settings.entity';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(
    @InjectRepository(CompanySettings)
    private settingsRepository: Repository<CompanySettings>,
  ) {}

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
