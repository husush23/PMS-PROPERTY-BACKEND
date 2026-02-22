import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { Plan } from '../plan/entities/plan.entity';
import { Company } from '../company/entities/company.entity';
import { NotFoundException } from '@nestjs/common';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepo: any;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getRepositoryToken(Subscription), useValue: mockRepo },
        { provide: getRepositoryToken(Plan), useValue: {} },
        { provide: getRepositoryToken(Company), useValue: {} },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    subscriptionRepo = module.get(getRepositoryToken(Subscription));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSubscriptionByCompanyId', () => {
    it('should return subscription if found', async () => {
      const companyId = 'comp-1';
      const mockSub = { id: 'sub-1', companyId, plan: { name: 'Pro' } };
      mockRepo.findOne.mockResolvedValue(mockSub);

      const result = await service.getSubscriptionByCompanyId(companyId);
      expect(result).toEqual(mockSub);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { companyId },
        relations: ['plan'],
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getSubscriptionByCompanyId('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
