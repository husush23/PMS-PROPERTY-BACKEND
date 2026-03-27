export class WaterReadingResponseDto {
  id: string;
  meterId: string;
  readingDate: string;
  previousReading: number;
  currentReading: number;
  usage: number;
  rateUsed: number;
  totalAmount: number;
  isBilled: boolean;
  rentCycleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UnitWaterHistoryTotalsDto {
  totalUsage: number;
  totalBilledAmount: number;
  totalUnpaidAmount: number;
}

export class UnitWaterHistoryResponseDto {
  data: WaterReadingResponseDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  totals: UnitWaterHistoryTotalsDto;
}
