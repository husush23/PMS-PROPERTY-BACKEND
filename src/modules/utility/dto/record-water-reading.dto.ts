import { IsNumber, IsUUID, Min } from 'class-validator';

export class RecordWaterReadingDto {
  @IsUUID()
  unitId: string;

  @IsNumber()
  @Min(0)
  currentReading: number;
}
