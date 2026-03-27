import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UtilityService } from './utility.service';
import { RecordWaterReadingDto } from './dto/record-water-reading.dto';
import { AttachUtilityToRentCycleDto } from './dto/attach-utility-to-rent-cycle.dto';
import { UnitWaterHistoryQueryDto } from './dto/unit-water-history-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthUser } from '../../common/decorators/auth-user.decorator';

@ApiTags('utilities')
@Controller({ path: 'utilities', version: '1' })
export class UtilityController {
  constructor(private readonly utilityService: UtilityService) {}

  @Post('water-reading')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  async recordWaterReading(
    @Body() dto: RecordWaterReadingDto,
    @AuthUser() user: { id: string },
  ) {
    return this.utilityService.recordWaterReading(
      dto.unitId,
      dto.currentReading,
      user.id,
    );
  }

  @Post('attach-to-rent-cycle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  async attachUtilityToRentCycle(
    @Body() dto: AttachUtilityToRentCycleDto,
    @AuthUser() user: { id: string },
  ) {
    return this.utilityService.attachUtilityToRentCycle(
      dto.rentCycleId,
      user.id,
    );
  }

  @Get('unit/:unitId/history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getUnitWaterHistory(
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query() query: UnitWaterHistoryQueryDto,
    @AuthUser() user: { id: string },
  ) {
    return this.utilityService.getUnitWaterHistory(
      unitId,
      query.page,
      query.limit,
      user.id,
    );
  }
}
