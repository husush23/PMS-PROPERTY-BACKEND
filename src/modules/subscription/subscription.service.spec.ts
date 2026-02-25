import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Subscription, SubscriptionStatus, PlanType } from './entities/subscription.entity';
import { Plan } from '../plan/entities/plan.entity';
import { Company } from '../company/entities/company.entity';
import { SubscriptionPayment } from '../subscription-payment/entities/subscription-payment.entity';
import { addMonths } from 'date-fns';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepo: any;
  let planRepo: any;
  let paymentRepo: any;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn().mockImplementation(dto => dto),
    save: jest.fn().mockImplementation(dto => ({ id: 'sub-123', ...dto })),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getRepositoryToken(Subscription), useValue: mockRepo },
        { provide: getRepositoryToken(Plan), useValue: { findOne: jest.fn().mockResolvedValue({ id: 'plan-1', isActive: true }) } },
        { provide: getRepositoryToken(Company), useValue: {} },
        { provide: getRepositoryToken(SubscriptionPayment), useValue: { create: jest.fn().mockImplementation(dto => dto), save: jest.fn() } },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    subscriptionRepo = module.get(getRepositoryToken(Subscription));
    planRepo = module.get(getRepositoryToken(Plan));
    paymentRepo = module.get(getRepositoryToken(SubscriptionPayment));
  });

  describe('recordSubscriptionPayment', () => {
    it('should create a NEW subscription if none exists', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.recordSubscriptionPayment({
        companyId: 'comp-1',
        planType: PlanType.MONTHLY,
        amount: 50,
        recordedBy: 'admin-1'
      });

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscriptionRepo.create).toHaveBeenCalled();
      expect(paymentRepo.save).toHaveBeenCalled();
    });

    it('should EXTEND an active subscription from its endDate', async () => {
      const existingEndDate = new Date();
      existingEndDate.setDate(existingEndDate.getDate() + 10);

      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        endDate: existingEndDate,
        companyId: 'comp-1'
      });

      const result = await service.recordSubscriptionPayment({
        companyId: 'comp-1',
        planType: PlanType.MONTHLY,
        amount: 50,
        recordedBy: 'admin-1'
      });

      const expectedNewEndDate = addMonths(existingEndDate, 1);
      expect(result.endDate.getTime()).toBe(expectedNewEndDate.getTime());
    });
  });
});
