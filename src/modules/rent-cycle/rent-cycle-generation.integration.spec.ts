import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RentCycleGenerationService } from './rent-cycle-generation.service';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';

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
        invoiceNumber: 'INV-2024-01-001',
      });
      mockRentCycleRepository.save.mockResolvedValue({
        id: 'cycle-1',
        invoiceNumber: 'INV-2024-01-001',
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
        invoiceNumber: 'INV-2024-01-001',
      });
      mockRentCycleRepository.save.mockResolvedValue({
        id: 'cycle-2',
        invoiceNumber: 'INV-2024-01-001',
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
      expect(rentItem.description).toContain('Prorated');
      expect(rentItem.amount).toBeLessThan(3000); // Should be less than full amount
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
        invoiceNumber: 'INV-2024-12-001',
      });
      mockRentCycleRepository.save.mockResolvedValue({
        id: 'cycle-3',
        invoiceNumber: 'INV-2024-12-001',
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
});
