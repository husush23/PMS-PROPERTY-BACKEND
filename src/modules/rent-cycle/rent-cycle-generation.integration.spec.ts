import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository, DataSource } from 'typeorm';
import { RentCycleGenerationService } from './rent-cycle-generation.service';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';
import { UtilityService } from '../utility/utility.service';

describe('RentCycleGenerationService Integration', () => {
  let service: RentCycleGenerationService;
  let rentCycleRepository: Repository<RentCycle>;
  let lineItemRepository: Repository<RentCycleLineItem>;
  let leaseRepository: Repository<Lease>;

  const mockRentCycleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getRawMany: jest.fn(),
    })),
  };

  const mockLineItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockLeaseRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockPaymentRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn(() => ({
      create: jest.fn((data) => data),
      save: jest.fn(),
    })),
  };

  const mockCompanySettingsResolver = {
    getSettings: jest.fn().mockResolvedValue({
      autoGenerateRentCycles: true,
      autoApplyCredit: true,
      autoApplyLateFees: true,
      lateFeeEnabled: true,
    }),
    shouldAutoGenerateRentCycles: jest.fn().mockReturnValue(true),
    shouldAutoApplyCredit: jest.fn().mockReturnValue(true),
  };

  const mockUtilityService = {
    attachUtilityToRentCycle: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentCycleGenerationService,
        {
          provide: getRepositoryToken(RentCycle),
          useValue: mockRentCycleRepository,
        },
        {
          provide: getRepositoryToken(RentCycleLineItem),
          useValue: mockLineItemRepository,
        },
        {
          provide: getRepositoryToken(Lease),
          useValue: mockLeaseRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: CompanySettingsResolver, useValue: mockCompanySettingsResolver },
        { provide: UtilityService, useValue: mockUtilityService },
      ],
    }).compile();

    service = module.get<RentCycleGenerationService>(RentCycleGenerationService);
    rentCycleRepository = module.get<Repository<RentCycle>>(
      getRepositoryToken(RentCycle),
    );
    lineItemRepository = module.get<Repository<RentCycleLineItem>>(
      getRepositoryToken(RentCycleLineItem),
    );
    leaseRepository = module.get<Repository<Lease>>(getRepositoryToken(Lease));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Invoice Generation with Different Frequencies', () => {
    it('should generate monthly invoice correctly', async () => {
      const lease = {
        id: 'lease-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        monthlyRent: 3000,
        startDate: new Date('2024-01-01'),
        billingStartDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        rentDueDay: 5,
        billingAnchorDay: 5,
        paymentFrequency: PaymentFrequency.MONTHLY,
        status: LeaseStatus.ACTIVE,
        isActive: true,
        proratedFirstMonth: false,
        utilitiesIncluded: false,
      } as Lease;

      mockLeaseRepository.findOne.mockResolvedValue(lease);
      mockRentCycleRepository.findOne.mockResolvedValue(null);
      mockRentCycleRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRentCycleRepository.create.mockReturnValue({
        id: 'cycle-1',
        invoiceNumber: 'INV-2024-01-RENT-001',
      });
      mockRentCycleRepository.save.mockResolvedValue({
        id: 'cycle-1',
        invoiceNumber: 'INV-2024-01-RENT-001',
      });
      mockLineItemRepository.create.mockReturnValue({ id: 'item-1' });
      mockLineItemRepository.save.mockResolvedValue([{ id: 'item-1' }]);
      mockLeaseRepository.update.mockResolvedValue(undefined);

      const result = await service.generateFirstCycle('lease-1');

      expect(result).toBeDefined();
      expect(mockRentCycleRepository.save).toHaveBeenCalled();
      expect(mockLineItemRepository.save).toHaveBeenCalled();
    });

    it('should generate prorated first month invoice when flag is set', async () => {
      const lease = {
        id: 'lease-2',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        monthlyRent: 3000,
        startDate: new Date('2024-01-15'),
        billingStartDate: new Date('2024-01-15'),
        endDate: new Date('2024-12-31'),
        rentDueDay: 5,
        billingAnchorDay: 5,
        paymentFrequency: PaymentFrequency.MONTHLY,
        status: LeaseStatus.ACTIVE,
        isActive: true,
        proratedFirstMonth: true,
        utilitiesIncluded: false,
      } as Lease;

      mockLeaseRepository.findOne.mockResolvedValue(lease);
      mockRentCycleRepository.findOne.mockResolvedValue(null);
      mockRentCycleRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRentCycleRepository.create.mockReturnValue({
        id: 'cycle-2',
        invoiceNumber: 'INV-2024-01-RENT-001',
      });
      mockRentCycleRepository.save.mockResolvedValue({
        id: 'cycle-2',
        invoiceNumber: 'INV-2024-01-RENT-001',
      });
      mockLineItemRepository.create.mockImplementation((item) => item);
      mockLineItemRepository.save.mockResolvedValue([{ id: 'item-1' }]);
      mockLeaseRepository.update.mockResolvedValue(undefined);

      const result = await service.generateFirstCycle('lease-2');

      expect(result).toBeDefined();
      // Verify prorated amount is used
      const savedLineItems = mockLineItemRepository.save.mock.calls[0][0];
      const rentItem = savedLineItems.find(
        (item: any) => item.type === 'RENT',
      );
      expect(rentItem).toBeDefined();
      expect(rentItem.description).toBe('Prorated rent for 17 days');
      expect(rentItem.amount).toBeLessThan(3000); // Should be less than full amount

      const createPayload = mockRentCycleRepository.create.mock.calls[0][0];
      expect(createPayload.period).toBe('2024-01');
      expect(
        new Date(createPayload.dueDate).toISOString().slice(0, 10),
      ).toBe('2024-01-15');
    });

    it('should use billing-start due and YYYY-MM period for mid-month move-in with anchor day 1', async () => {
      const lease = {
        id: 'lease-eom',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        monthlyRent: 3100,
        startDate: new Date(Date.UTC(2025, 2, 15)),
        billingStartDate: new Date(Date.UTC(2025, 2, 15)),
        endDate: new Date(Date.UTC(2026, 11, 31)),
        billingAnchorDay: 1,
        paymentFrequency: PaymentFrequency.MONTHLY,
        status: LeaseStatus.ACTIVE,
        isActive: true,
        proratedFirstMonth: true,
        utilitiesIncluded: true,
      } as Lease;

      mockLeaseRepository.findOne.mockResolvedValue(lease);
      mockRentCycleRepository.findOne.mockResolvedValue(null);
      mockRentCycleRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRentCycleRepository.create.mockReturnValue({
        id: 'cycle-eom',
        invoiceNumber: 'INV-2025-03-RENT-001',
      });
      mockRentCycleRepository.save.mockResolvedValue({
        id: 'cycle-eom',
        invoiceNumber: 'INV-2025-03-RENT-001',
      });
      mockLineItemRepository.create.mockImplementation((item) => item);
      mockLineItemRepository.save.mockResolvedValue([{ id: 'item-1' }]);

      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.UTC(2025, 2, 20)));

      await service.generateFirstCycle('lease-eom');

      jest.useRealTimers();

      const createPayload = mockRentCycleRepository.create.mock.calls[0][0];
      expect(createPayload.period).toBe('2025-03');
      expect(
        new Date(createPayload.dueDate).toISOString().slice(0, 10),
      ).toBe('2025-03-15');
    });

    it('should generate partial final period invoice when lease ends mid-period', async () => {
      const today = new Date('2024-12-20');
      jest.useFakeTimers();
      jest.setSystemTime(today);

      const lease = {
        id: 'lease-3',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        monthlyRent: 3000,
        startDate: new Date('2024-01-01'),
        billingStartDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-15'), // Ends mid-month
        rentDueDay: 5,
        billingAnchorDay: 5,
        nextRentDueDate: new Date('2024-12-05'),
        paymentFrequency: PaymentFrequency.MONTHLY,
        status: LeaseStatus.ACTIVE,
        isActive: true,
        proratedFirstMonth: false,
        utilitiesIncluded: false,
      } as Lease;

      mockLeaseRepository.find.mockResolvedValue([lease]);
      mockRentCycleRepository.findOne.mockResolvedValue(null);
      mockRentCycleRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRentCycleRepository.create.mockReturnValue({
        id: 'cycle-3',
        invoiceNumber: 'INV-2024-12-RENT-001',
      });
      mockRentCycleRepository.save.mockResolvedValue({
        id: 'cycle-3',
        invoiceNumber: 'INV-2024-12-RENT-001',
      });
      mockLineItemRepository.create.mockImplementation((item) => item);
      mockLineItemRepository.save.mockResolvedValue([{ id: 'item-1' }]);

      await service.generateRentCycles();

      expect(mockRentCycleRepository.save).toHaveBeenCalled();
      const savedLineItems = mockLineItemRepository.save.mock.calls[0][0];
      const rentItem = savedLineItems.find(
        (item: any) => item.type === 'RENT',
      );
      expect(rentItem.description).toContain('Partial');
      expect(rentItem.amount).toBeLessThan(3000); // Should be less than full amount

      jest.useRealTimers();
    });
  });

  describe('Concurrent rent cycle generation', () => {
    it('should retry and create unique invoice numbers under concurrency', async () => {
      const leaseBase = {
        companyId: 'company-1',
        tenantId: 'tenant-1',
        monthlyRent: 3000,
        startDate: new Date('2024-01-01'),
        billingStartDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        rentDueDay: 5,
        billingAnchorDay: 5,
        paymentFrequency: PaymentFrequency.MONTHLY,
        status: LeaseStatus.ACTIVE,
        isActive: true,
        proratedFirstMonth: false,
        utilitiesIncluded: false,
      } as Lease;

      const lease1 = { ...leaseBase, id: 'lease-1' } as Lease;
      const lease2 = { ...leaseBase, id: 'lease-2' } as Lease;

      mockLeaseRepository.findOne.mockImplementation(
        async ({ where }: { where: { id: string } }) =>
          where.id === 'lease-1' ? lease1 : lease2,
      );

      mockRentCycleRepository.findOne.mockResolvedValue(null);

      let lastInvoiceNumber: string | null = null;
      mockRentCycleRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockImplementation(async () =>
          lastInvoiceNumber ? { invoiceNumber: lastInvoiceNumber } : null,
        ),
      });

      let saveAttempts = 0;
      mockRentCycleRepository.create.mockImplementation((data) => ({
        id: `cycle-${saveAttempts + 1}`,
        ...data,
      }));
      mockRentCycleRepository.save.mockImplementation(async (cycle) => {
        saveAttempts += 1;
        if (
          cycle.invoiceNumber === 'INV-2024-01-RENT-001' &&
          lastInvoiceNumber === 'INV-2024-01-RENT-001'
        ) {
          throw new QueryFailedError('', [], {
            code: '23505',
            constraint: 'UQ_rent_cycles_company_invoice_number',
          });
        }
        lastInvoiceNumber = cycle.invoiceNumber;
        return cycle;
      });

      mockLineItemRepository.create.mockImplementation((item) => item);
      mockLineItemRepository.save.mockResolvedValue([{ id: 'item-1' }]);
      mockLeaseRepository.update.mockResolvedValue(undefined);

      const [cycle1, cycle2] = await Promise.all([
        service.generateFirstCycle('lease-1'),
        service.generateFirstCycle('lease-2'),
      ]);

      expect(cycle1.invoiceNumber).toBeDefined();
      expect(cycle2.invoiceNumber).toBeDefined();
      expect(cycle1.invoiceNumber).not.toEqual(cycle2.invoiceNumber);
      expect(cycle1.invoiceNumber).toBe('INV-2024-01-RENT-001');
      expect(cycle2.invoiceNumber).toBe('INV-2024-01-RENT-002');
      expect(mockLineItemRepository.save).toHaveBeenCalledTimes(2);
    });
  });
});
