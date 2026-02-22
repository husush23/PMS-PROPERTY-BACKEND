import { Test, TestingModule } from '@nestjs/testing';
import { CompanySubscriptionController } from './company-subscription.controller';
import { SubscriptionService } from './subscription.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../shared/enums/user-role.enum';

describe('CompanySubscriptionController', () => {
    let controller: CompanySubscriptionController;
    let service: SubscriptionService;

    const mockSubscriptionService = {
        getSubscriptionByCompanyId: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CompanySubscriptionController],
            providers: [
                {
                    provide: SubscriptionService,
                    useValue: mockSubscriptionService,
                },
            ],
        }).compile();

        controller = module.get<CompanySubscriptionController>(CompanySubscriptionController);
        service = module.get<SubscriptionService>(SubscriptionService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getCompanySubscription', () => {
        const companyId = 'test-company-id';
        const mockSubscription = { id: 'sub-id', companyId, plan: { name: 'Pro' } };

        it('should allow Super Admin to view any company subscription', async () => {
            mockSubscriptionService.getSubscriptionByCompanyId.mockResolvedValue(mockSubscription);

            const user = { id: 'admin-id', isSuperAdmin: true };
            const result = await controller.getCompanySubscription(companyId, user);

            expect(result).toEqual({ success: true, data: mockSubscription });
            expect(service.getSubscriptionByCompanyId).toHaveBeenCalledWith(companyId);
        });

        it('should allow Company Admin to view their own company subscription', async () => {
            mockSubscriptionService.getSubscriptionByCompanyId.mockResolvedValue(mockSubscription);

            const user = { id: 'user-id', companyId: companyId, role: UserRole.COMPANY_ADMIN };
            const result = await controller.getCompanySubscription(companyId, user);

            expect(result).toEqual({ success: true, data: mockSubscription });
        });

        it('should throw ForbiddenException if user is not Super Admin or Company Admin of the specific company', async () => {
            const user = { id: 'user-id', companyId: 'other-company', role: UserRole.COMPANY_ADMIN };

            await expect(controller.getCompanySubscription(companyId, user))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException if user is Manager (even if in same company)', async () => {
            const user = { id: 'user-id', companyId: companyId, role: UserRole.MANAGER };

            await expect(controller.getCompanySubscription(companyId, user))
                .rejects.toThrow(ForbiddenException);
        });

        it('should forward NotFoundException if subscription does not exist', async () => {
            mockSubscriptionService.getSubscriptionByCompanyId.mockRejectedValue(new NotFoundException());

            const user = { id: 'admin-id', isSuperAdmin: true };
            await expect(controller.getCompanySubscription(companyId, user))
                .rejects.toThrow(NotFoundException);
        });
    });
});
