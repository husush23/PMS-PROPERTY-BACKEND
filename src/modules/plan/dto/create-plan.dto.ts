import { IsString, IsDecimal, IsBoolean, IsOptional, IsObject, IsNumber } from 'class-validator';

export class CreatePlanDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    monthlyPrice: number;

    @IsNumber()
    yearlyPrice: number;

    @IsObject()
    @IsOptional()
    features?: Record<string, any>;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
