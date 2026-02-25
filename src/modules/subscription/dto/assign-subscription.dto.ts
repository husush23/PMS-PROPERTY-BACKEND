import { IsString, IsEnum, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { PlanType, SubscriptionStatus } from '../entities/subscription.entity';

export class AssignSubscriptionDto {
    @IsString()
    @IsNotEmpty()
    companyId: string;

    @IsString()
    @IsNotEmpty()
    planId: string;

    @IsEnum(PlanType)
    @IsNotEmpty()
    planType: PlanType;

    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsEnum(SubscriptionStatus)
    status?: SubscriptionStatus;
}
