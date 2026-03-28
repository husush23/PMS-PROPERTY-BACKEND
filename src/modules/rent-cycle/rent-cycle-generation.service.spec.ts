import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RentCycleGenerationService } from './rent-cycle-generation.service';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';
import { UtilityService } from '../utility/utility.service';
import {
  calculateNextDueDate,
  getPeriodsSinceStart,
} from '../../common/utils/rent-due-date.util';

describe('RentCycleGenerationService', () => {
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
    createQueryBuilder: jest.fn(),
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
    create: jest.fn((data) => data),
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
      defaultCurrency: 'USD',
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
        {
          provide: CompanySettingsResolver,
          useValue: mockCompanySettingsResolver,
        },
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

  describe('Frequency Calculations', () => {
    it('should calculate monthly due date correctly', () => {
      const billingStartDate = new Date('2024-01-15');
      const result = calculateNextDueDate({
        billingStartDate,
        billingAnchorDay: 5,
        paymentFrequency: PaymentFrequency.MONTHLY,
        cyclesAhead: 1,
      });

      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(result.getUTCDate()).toBe(5);
    });

    it('should calculate weekly due date correctly', () => {
      const billingStartDate = new Date('2024-01-15'); // Monday
      const result = calculateNextDueDate({
        billingStartDate,
        billingAnchorDay: 15,
        paymentFrequency: PaymentFrequency.WEEKLY,
        cyclesAhead: 1,
      });

      const expectedDate = new Date(Date.UTC(2024, 0, 22));
      expect(result.getTime()).toBe(expectedDate.getTime());
    });

    it('should calculate quarterly due date correctly', () => {
      const billingStartDate = new Date('2024-01-15');
      const result = calculateNextDueDate({
        billingStartDate,
        billingAnchorDay: 5,
        paymentFrequency: PaymentFrequency.QUARTERLY,
        cyclesAhead: 1,
      });

      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(3); // April (0-indexed)
      expect(result.getUTCDate()).toBe(5);
    });

    it('should calculate yearly due date correctly', () => {
      const billingStartDate = new Date('2024-01-15');
      const result = calculateNextDueDate({
        billingStartDate,
        billingAnchorDay: 15,
        paymentFrequency: PaymentFrequency.YEARLY,
        cyclesAhead: 1,
      });

      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCDate()).toBe(15);
    });

    it('clamps to last day of month when needed', () => {
      const billingStartDate = new Date('2024-01-31');
      const result = calculateNextDueDate({
        billingStartDate,
        billingAnchorDay: 31,
        paymentFrequency: PaymentFrequency.MONTHLY,
        cyclesAhead: 1,
      });

      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(1); // February
      expect(result.getUTCDate()).toBe(29); // Leap year
    });
  });

  describe('Period Format Generation', () => {
    it('should generate monthly period format (YYYY-MM)', () => {
      const date = new Date('2024-03-15');
      const result = (service as any).getPeriodForDate(
        date,
        PaymentFrequency.MONTHLY,
      );

      expect(result).toBe('2024-03');
    });

    it('should generate weekly period format (YYYY-WW)', () => {
      const date = new Date('2024-01-15');
      const result = (service as any).getPeriodForDate(
        date,
        PaymentFrequency.WEEKLY,
      );

      expect(result).toMatch(/^2024-W\d{2}$/);
    });

    it('should generate quarterly period format (YYYY-QX)', () => {
      const date = new Date('2024-03-15'); // Q1
      const result = (service as any).getPeriodForDate(
        date,
        PaymentFrequency.QUARTERLY,
      );

      expect(result).toBe('2024-Q1');
    });

    it('should generate yearly period format (YYYY)', () => {
      const date = new Date('2024-06-15');
      const result = (service as any).getPeriodForDate(
        date,
        PaymentFrequency.YEARLY,
      );

      expect(result).toBe('2024');
    });
  });

  describe('Proration Calculation', () => {
    it('should calculate prorated amount correctly for partial month', () => {
      const lease = {
        startDate: new Date('2024-01-15'),
        billingStartDate: new Date('2024-01-15'),
        monthlyRent: 3000,
      } as Lease;

      const result = (service as any).calculateProratedAmount(lease);

      // January has 31 days, so 17 days (15-31) = 17/31 * 3000
      const expected = (17 / 31) * 3000;
      expect(result).toBeCloseTo(expected, 2);
    });

    it('should return full amount if proration not needed', () => {
      const lease = {
        startDate: new Date('2024-01-01'),
        billingStartDate: new Date('2024-01-01'),
        monthlyRent: 3000,
      } as Lease;

      const result = (service as any).calculateProratedAmount(lease);

      // Starting on 1st should charge full month
      expect(result).toBeCloseTo(3000, 2);
    });
  });

  describe('Partial Period Calculation', () => {
    it('should calculate partial period amount correctly', () => {
      const fullAmount = 3000;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const actualEnd = new Date('2024-01-15');

      const result = (service as any).calculatePartialPeriodAmount(
        fullAmount,
        periodStart,
        periodEnd,
        actualEnd,
      );

      // Matches implementation: 14 days out of 30 days
      const expected = (14 / 30) * 3000;
      expect(result).toBeCloseTo(expected, 2);
    });

    it('should return full amount if period is complete', () => {
      const fullAmount = 3000;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const actualEnd = new Date('2024-01-31');

      const result = (service as any).calculatePartialPeriodAmount(
        fullAmount,
        periodStart,
        periodEnd,
        actualEnd,
      );

      expect(result).toBeCloseTo(3000, 2);
    });
  });

  describe('Period Calculations', () => {
    it('should calculate periods since start for monthly', () => {
      const startDate = new Date('2024-01-01');
      const currentDate = new Date('2024-03-01');

      const result = getPeriodsSinceStart(
        startDate,
        currentDate,
        PaymentFrequency.MONTHLY,
      );

      expect(result).toBe(2); // 2 months
    });

    it('should calculate periods since start for weekly', () => {
      const startDate = new Date('2024-01-01');
      const currentDate = new Date('2024-01-22'); // 3 weeks later

      const result = getPeriodsSinceStart(
        startDate,
        currentDate,
        PaymentFrequency.WEEKLY,
      );

      expect(result).toBe(3); // 3 weeks
    });

    it('should calculate periods since start for quarterly', () => {
      const startDate = new Date('2024-01-01');
      const currentDate = new Date('2024-07-01'); // 2 quarters later

      const result = getPeriodsSinceStart(
        startDate,
        currentDate,
        PaymentFrequency.QUARTERLY,
      );

      expect(result).toBe(2); // 2 quarters
    });
  });

  describe('Credit auto-application', () => {
    it('applies credit to due invoice and reduces lease credit balance', async () => {
      const today = new Date('2024-02-15T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(today);

      const lease = {
        id: 'lease-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        creditBalance: 500,
        currency: 'USD',
        createdBy: 'user-1',
      } as Lease;

      const rentCycle = {
        id: 'cycle-1',
        period: '2024-02',
        dueDate: new Date('2024-02-10'),
        periodStartDate: new Date('2024-02-01'),
        totalAmountDue: 300,
        isVoid: false,
        isDeposit: false,
      } as any;
      const companySettings = { autoApplyCredit: true } as any;

      mockPaymentRepository.find.mockResolvedValue([]);
      mockPaymentRepository.save.mockImplementation(async (payment) => payment);
      mockLeaseRepository.update.mockResolvedValue(undefined);

      await (service as any).applyCreditToInvoice(
        rentCycle,
        lease,
        companySettings,
      );

      expect(mockPaymentRepository.save).toHaveBeenCalled();
      const savedPayment = mockPaymentRepository.save.mock.calls[0][0];
      expect(savedPayment.paymentMethod).toBe('CREDIT');
      expect(savedPayment.amount).toBe(300);
      expect(mockLeaseRepository.update).toHaveBeenCalledWith(
        lease.id,
        expect.objectContaining({ creditBalance: 200 }),
      );

      jest.useRealTimers();
    });

    it('does not apply credit to future periods', async () => {
      const today = new Date('2024-02-01T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(today);

      const lease = {
        id: 'lease-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        creditBalance: 500,
        currency: 'USD',
      } as Lease;

      const rentCycle = {
        id: 'cycle-1',
        period: '2024-03',
        dueDate: new Date('2024-03-05'),
        periodStartDate: new Date('2024-03-01'),
        totalAmountDue: 300,
        isVoid: false,
        isDeposit: false,
      } as any;
      const companySettings = { autoApplyCredit: true } as any;

      mockPaymentRepository.find.mockResolvedValue([]);

      await (service as any).applyCreditToInvoice(
        rentCycle,
        lease,
        companySettings,
      );

      expect(mockPaymentRepository.save).not.toHaveBeenCalled();
      expect(mockLeaseRepository.update).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
