import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaseService } from './lease.service';
import { Lease } from './entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { TenantProfile } from '../tenant/entities/tenant-profile.entity';
import { Payment } from '../payment/entities/payment.entity';
import { TenantService } from '../tenant/tenant.service';
import { RentGenerationService } from '../payment/rent-generation.service';
import { RentCycleGenerationService } from '../rent-cycle/rent-cycle-generation.service';
import { RentCycleService } from '../rent-cycle/rent-cycle.service';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { UnitStatus } from '../../shared/enums/unit-status.enum';
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';

describe('LeaseService (Credit Balance Refactor)', () => {
  let service: LeaseService;
  let leaseRepository: Repository<Lease>;
  let unitRepository: Repository<Unit>;
  let userRepository: Repository<User>;
  let userCompanyRepository: Repository<UserCompany>;
  let paymentRepository: Repository<Payment>;
  let tenantService: TenantService;

  const mockLeaseRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  const mockUnitRepository = {
    update: jest.fn(),
  };
  const mockPropertyRepository = {};
  const mockCompanyRepository = {};
  const mockUserRepository = {
    findOne: jest.fn(),
  };
  const mockUserCompanyRepository = {
    findOne: jest.fn(),
  };
  const mockTenantProfileRepository = {};
  const mockPaymentRepository = {
    find: jest.fn(),
  };
  const mockTenantService = {
    updateTenantStatusBasedOnActiveLeaseCount: jest.fn(),
  };
  const mockRentGenerationService = {};
  const mockRentCycleGenerationService = {};
  const mockRentCycleService = {};
  const mockCompanySettingsResolver = {
    getSettings: jest.fn().mockResolvedValue({
      defaultGracePeriodDays: 0,
      defaultLateFeeType: 'FIXED',
      defaultLateFeeValue: 0,
      defaultCurrency: 'USD',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaseService,
        { provide: getRepositoryToken(Lease), useValue: mockLeaseRepository },
        { provide: getRepositoryToken(Unit), useValue: mockUnitRepository },
        { provide: getRepositoryToken(Property), useValue: mockPropertyRepository },
        { provide: getRepositoryToken(Company), useValue: mockCompanyRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(UserCompany),
          useValue: mockUserCompanyRepository,
        },
        {
          provide: getRepositoryToken(TenantProfile),
          useValue: mockTenantProfileRepository,
        },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        { provide: TenantService, useValue: mockTenantService },
        { provide: RentGenerationService, useValue: mockRentGenerationService },
        {
          provide: RentCycleGenerationService,
          useValue: mockRentCycleGenerationService,
        },
        { provide: RentCycleService, useValue: mockRentCycleService },
        {
          provide: CompanySettingsResolver,
          useValue: mockCompanySettingsResolver,
        },
      ],
    }).compile();

    service = module.get<LeaseService>(LeaseService);
    leaseRepository = module.get<Repository<Lease>>(getRepositoryToken(Lease));
    unitRepository = module.get<Repository<Unit>>(getRepositoryToken(Unit));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userCompanyRepository = module.get<Repository<UserCompany>>(
      getRepositoryToken(UserCompany),
    );
    paymentRepository = module.get<Repository<Payment>>(
      getRepositoryToken(Payment),
    );
    tenantService = module.get<TenantService>(TenantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes credit balance in termination notes', async () => {
    const requesterUserId = 'user-1';
    const lease = {
      id: 'lease-1',
      companyId: 'company-1',
      tenantId: 'tenant-1',
      unitId: 'unit-1',
      currency: 'USD',
      creditBalance: 250,
      status: LeaseStatus.ACTIVE,
      isActive: true,
    } as Lease;

    mockUserRepository.findOne.mockResolvedValue({
      id: requesterUserId,
      isSuperAdmin: true,
    });
    mockLeaseRepository.findOne.mockResolvedValue(lease);
    mockPaymentRepository.find.mockResolvedValue([
      { balance: 100, isActive: true } as Payment,
    ]);
    mockLeaseRepository.count.mockResolvedValue(0);
    mockUnitRepository.update.mockResolvedValue(undefined);
    mockTenantService.updateTenantStatusBasedOnActiveLeaseCount.mockResolvedValue(
      undefined,
    );
    mockLeaseRepository.update.mockResolvedValue(undefined);
    mockUserCompanyRepository.findOne.mockResolvedValue({
      role: 'COMPANY_ADMIN',
    });

    await service.terminate(
      lease.id,
      { terminationReason: 'Test', terminationNotes: 'Base note' },
      requesterUserId,
    );

    expect(leaseRepository.update).toHaveBeenCalled();
    const updateArgs = mockLeaseRepository.update.mock.calls[0][1];
    expect(updateArgs.status).toBe(LeaseStatus.TERMINATED);
    expect(updateArgs.terminationNotes).toContain('Credit balance: KES 250.00');
    expect(updateArgs.terminationNotes).toContain('Outstanding balance');
    expect(unitRepository.update).toHaveBeenCalledWith(lease.unitId, {
      status: UnitStatus.AVAILABLE,
    });
    expect(tenantService.updateTenantStatusBasedOnActiveLeaseCount).toHaveBeenCalled();
  });
});
