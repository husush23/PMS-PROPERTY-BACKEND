import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { RentCycleService } from '../rent-cycle/rent-cycle.service';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentType } from '../../shared/enums/payment-type.enum';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { RentCycleStatus } from '../../shared/enums/rent-cycle-status.enum';
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';
import { PaymentMethodEntity } from '../payment-method/entities/payment-method.entity';
import { DataSource } from 'typeorm';

describe('PaymentService (Credit Balance Refactor)', () => {
  let service: PaymentService;
  let paymentRepository: Repository<Payment>;
  let leaseRepository: Repository<Lease>;
  let userRepository: Repository<User>;
  let rentCycleRepository: Repository<RentCycle>;
  let rentCycleService: RentCycleService;

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  const mockLeaseRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockUserCompanyRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockRentCycleRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockPaymentMethodRepository = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn(() => ({
      create: jest.fn((data) => data),
      save: jest.fn(),
    })),
  };

  const mockRentCycleService = {
    calculateStatus: jest.fn(),
    calculateAmounts: jest.fn(),
  };
  const mockCompanySettingsResolver = {
    getSettings: jest.fn().mockResolvedValue({
      requirePaymentApproval: false,
      allowPartialPayments: true,
      allowAdvancePayments: true,
      requirePaymentReference: false,
      allowedPaymentMethods: [PaymentMethod.CASH, PaymentMethod.OTHER],
      defaultCurrency: 'KES',
    }),
    assertPaymentMethodAllowed: jest.fn(),
    assertPaymentReference: jest.fn(),
    assertPartialPaymentsAllowed: jest.fn(),
    assertAdvancePaymentsAllowed: jest.fn(),
    resolveCurrency: jest.fn().mockReturnValue('KES'),
  };

  beforeEach(async () => {
    mockPaymentMethodRepository.findOne.mockResolvedValue({
      id: 'pm-1',
      code: PaymentMethod.CASH,
      isGlobal: true,
      requiresReference: false,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        { provide: getRepositoryToken(Lease), useValue: mockLeaseRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(UserCompany),
          useValue: mockUserCompanyRepository,
        },
        {
          provide: getRepositoryToken(RentCycle),
          useValue: mockRentCycleRepository,
        },
        {
          provide: getRepositoryToken(PaymentMethodEntity),
          useValue: mockPaymentMethodRepository,
        },
        { provide: RentCycleService, useValue: mockRentCycleService },
        { provide: CompanySettingsResolver, useValue: mockCompanySettingsResolver },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get<Repository<Payment>>(
      getRepositoryToken(Payment),
    );
    leaseRepository = module.get<Repository<Lease>>(getRepositoryToken(Lease));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    rentCycleRepository = module.get<Repository<RentCycle>>(
      getRepositoryToken(RentCycle),
    );
    rentCycleService = module.get<RentCycleService>(RentCycleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('stores advance payment as credit balance when no invoice exists', async () => {
    const requesterUserId = 'requester-1';
    const lease = {
      id: 'lease-1',
      companyId: 'company-1',
      tenantId: 'tenant-1',
      status: LeaseStatus.ACTIVE,
      isActive: true,
      creditBalance: 0,
      currency: 'KES',
    } as Lease;

    mockUserRepository.findOne.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === requesterUserId
          ? ({ id: requesterUserId, isSuperAdmin: true } as User)
          : ({ id: lease.tenantId, isActive: true } as User),
    );
    mockLeaseRepository.findOne.mockResolvedValue(lease);
    mockRentCycleRepository.findOne.mockResolvedValue(null);

    mockPaymentRepository.create.mockImplementation((data) => data);
    mockPaymentRepository.save.mockImplementation(async (data) => ({
      id: 'payment-1',
      ...data,
      lease,
      tenant: { id: lease.tenantId },
      company: { id: lease.companyId },
      recordedByUser: { id: requesterUserId },
    }));
    mockPaymentRepository.find.mockResolvedValue([]);
    mockPaymentRepository.findOne.mockResolvedValue(null);
    mockRentCycleRepository.find.mockResolvedValue([]);

    const result = await service.create(
      {
        leaseId: lease.id,
        amount: 500,
        amountDue: 500,
        paymentDate: new Date().toISOString(),
        paymentMethod: PaymentMethod.CASH,
        paymentType: PaymentType.RENT,
        period: '2024-01',
      },
      requesterUserId,
    );

    expect(leaseRepository.update).toHaveBeenCalledWith(lease.id, {
      creditBalance: 500,
    });
    expect(paymentRepository.save).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.rentCycleId).toBeUndefined();
  });

  it('rejects payment on void invoice', async () => {
    const requesterUserId = 'requester-1';
    const lease = {
      id: 'lease-1',
      companyId: 'company-1',
      tenantId: 'tenant-1',
      status: LeaseStatus.ACTIVE,
      isActive: true,
      currency: 'KES',
    } as Lease;
    const rentCycle = {
      id: 'cycle-1',
      leaseId: lease.id,
      isVoid: true,
      isDeposit: false,
      totalAmountDue: 1000,
    } as RentCycle;

    mockUserRepository.findOne.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === requesterUserId
          ? ({ id: requesterUserId, isSuperAdmin: true } as User)
          : ({ id: lease.tenantId, isActive: true } as User),
    );
    mockLeaseRepository.findOne.mockResolvedValue(lease);
    mockRentCycleRepository.findOne.mockResolvedValue(rentCycle);

    await expect(
      service.create(
        {
          leaseId: lease.id,
          rentCycleId: rentCycle.id,
          amount: 500,
          amountDue: 1000,
          paymentDate: new Date().toISOString(),
          paymentMethod: PaymentMethod.CASH,
          paymentType: PaymentType.RENT,
        },
        requesterUserId,
      ),
    ).rejects.toThrow('Cannot make payment on voided invoice');
  });

  it('uses company default currency when missing', async () => {
    const requesterUserId = 'requester-1';
    const lease = {
      id: 'lease-1',
      companyId: 'company-1',
      tenantId: 'tenant-1',
      status: LeaseStatus.ACTIVE,
      isActive: true,
      currency: null,
    } as Lease;
    const rentCycle = {
      id: 'cycle-1',
      leaseId: lease.id,
      isVoid: false,
      isDeposit: false,
      totalAmountDue: 1000,
      dueDate: new Date(),
    } as RentCycle;

    mockCompanySettingsResolver.resolveCurrency.mockReturnValueOnce('USD');
    mockUserRepository.findOne.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === requesterUserId
          ? ({ id: requesterUserId, isSuperAdmin: true } as User)
          : ({ id: lease.tenantId, isActive: true } as User),
    );
    mockLeaseRepository.findOne.mockResolvedValue(lease);
    mockRentCycleRepository.findOne.mockResolvedValue(rentCycle);
    mockPaymentMethodRepository.findOne.mockResolvedValue({
      id: 'pm-1',
      code: PaymentMethod.CASH,
      isGlobal: true,
      requiresReference: false,
    });

    mockPaymentRepository.create.mockImplementation((data) => data);
    mockPaymentRepository.save.mockImplementation(async (data) => ({
      id: 'payment-1',
      ...data,
      lease,
      tenant: { id: lease.tenantId },
      company: { id: lease.companyId },
      recordedByUser: { id: requesterUserId },
    }));
    mockPaymentRepository.find.mockResolvedValue([]);
    mockPaymentRepository.findOne.mockResolvedValue(null);
    mockRentCycleRepository.find.mockResolvedValue([]);

    const result = await service.create(
      {
        leaseId: lease.id,
        rentCycleId: rentCycle.id,
        amount: 1000,
        amountDue: 1000,
        paymentDate: new Date().toISOString(),
        paymentMethod: PaymentMethod.CASH,
        paymentType: PaymentType.RENT,
      },
      requesterUserId,
    );

    expect(mockCompanySettingsResolver.resolveCurrency).toHaveBeenCalled();
    expect(paymentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
    expect(result.currency).toBe('USD');
  });

  it('excludes pending and void invoices from outstanding balance', async () => {
    const cycleDue = { id: 'cycle-due', isVoid: false } as RentCycle;
    const cyclePartial = { id: 'cycle-partial', isVoid: false } as RentCycle;
    const cyclePending = { id: 'cycle-pending', isVoid: false } as RentCycle;
    const cycleVoid = { id: 'cycle-void', isVoid: true } as RentCycle;

    mockRentCycleRepository.find.mockResolvedValue([
      cycleDue,
      cyclePartial,
      cyclePending,
      cycleVoid,
    ]);

    mockPaymentRepository.find.mockResolvedValue([]);

    (rentCycleService.calculateStatus as jest.Mock).mockImplementation(
      (cycle: RentCycle) => {
        switch (cycle.id) {
          case 'cycle-due':
            return RentCycleStatus.DUE;
          case 'cycle-partial':
            return RentCycleStatus.PARTIAL;
          case 'cycle-pending':
            return RentCycleStatus.PENDING;
          default:
            return RentCycleStatus.DUE;
        }
      },
    );

    (rentCycleService.calculateAmounts as jest.Mock).mockImplementation(
      (cycle: RentCycle) => {
        switch (cycle.id) {
          case 'cycle-due':
            return { totalAmountDue: 200, amountPaid: 100, balance: 100 };
          case 'cycle-partial':
            return { totalAmountDue: 300, amountPaid: 250, balance: 50 };
          case 'cycle-pending':
            return { totalAmountDue: 400, amountPaid: 0, balance: 400 };
          case 'cycle-void':
            return { totalAmountDue: 500, amountPaid: 0, balance: 500 };
          default:
            return { totalAmountDue: 0, amountPaid: 0, balance: 0 };
        }
      },
    );

    const totalOutstanding = await (service as any).calculateLeaseBalance(
      'lease-1',
    );

    expect(totalOutstanding).toBe(150);
  });
});
