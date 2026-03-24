import { IsUUID } from 'class-validator';

export class AttachUtilityToRentCycleDto {
  @IsUUID()
  rentCycleId: string;
}
