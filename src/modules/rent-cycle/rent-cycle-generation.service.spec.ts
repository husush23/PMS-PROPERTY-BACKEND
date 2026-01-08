import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RentCycleGenerationService } from './rent-cycle-generation.service';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';

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
      const billingStart = new Date('2024-01-15');
      const rentDueDay = 5;
      const periodOffset = 1;

      // Access private method via type casting
      const result = (service as any).calculateMonthlyDueDate(
        billingStart,
        rentDueDay,
        periodOffset,
      );

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1); // February (0-indexed)
      expect(result.getDate()).toBe(5);
    });

    it('should calculate weekly due date correctly', () => {
      const billingStart = new Date('2024-01-15'); // Monday
      const rentDueDay = 1; // Monday
      const periodOffset = 1;

      const result = (service as any).calculateWeeklyDueDate(
        billingStart,
        rentDueDay,
        periodOffset,
      );

      // Should be 7 days later
      const expectedDate = new Date(billingStart);
      expectedDate.setDate(expectedDate.getDate() + 7);
      expect(result.getTime()).toBeCloseTo(expectedDate.getTime(), -3); // Within 1 day tolerance
    });

    it('should calculate quarterly due date correctly', () => {
      const billingStart = new Date('2024-01-15');
      const rentDueDay = 5;
      const periodOffset = 1;

      const result = (service as any).calculateQuarterlyDueDate(
        billingStart,
        rentDueDay,
        periodOffset,
      );

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(3); // April (0-indexed, 3 months later)
      expect(result.getDate()).toBe(5);
    });

    it('should calculate yearly due date correctly', () => {
      const billingStart = new Date('2024-01-15');
      const rentDueDay = 15;
      const periodOffset = 1;

      const result = (service as any).calculateYearlyDueDate(
        billingStart,
        rentDueDay,
        periodOffset,
      );

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
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

      // 15 days out of 31 days = 15/31 * 3000
      const expected = (15 / 31) * 3000;
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

      const result = (service as any).getPeriodsSinceStart(
        startDate,
        currentDate,
        PaymentFrequency.MONTHLY,
      );

      expect(result).toBe(2); // 2 months
    });

    it('should calculate periods since start for weekly', () => {
      const startDate = new Date('2024-01-01');
      const currentDate = new Date('2024-01-22'); // 3 weeks later

      const result = (service as any).getPeriodsSinceStart(
        startDate,
        currentDate,
        PaymentFrequency.WEEKLY,
      );

      expect(result).toBe(3); // 3 weeks
    });

    it('should calculate periods since start for quarterly', () => {
      const startDate = new Date('2024-01-01');
      const currentDate = new Date('2024-07-01'); // 2 quarters later

      const result = (service as any).getPeriodsSinceStart(
        startDate,
        currentDate,
        PaymentFrequency.QUARTERLY,
      );

      expect(result).toBe(2); // 2 quarters
    });
  });
});
