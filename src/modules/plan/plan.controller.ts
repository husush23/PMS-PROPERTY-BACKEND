import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('plans')
export class PlanController {
    constructor(private readonly planService: PlanService) { }

    @Post()
    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    async create(@Body() createPlanDto: CreatePlanDto) {
        const result = await this.planService.create(createPlanDto);
        return {
            success: true,
            data: result
        };
    }

    @Public()
    @Get()
    async findAll() {
        const result = await this.planService.findAll();
        return {
            success: true,
            data: result
        };
    }

    @Public()
    @Get(':id')
    async findOne(@Param('id') id: string) {
        const result = await this.planService.findOne(id);
        return {
            success: true,
            data: result
        };
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    async update(@Param('id') id: string, @Body() updatePlanDto: UpdatePlanDto) {
        const result = await this.planService.update(id, updatePlanDto);
        return {
            success: true,
            data: result
        };
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    async remove(@Param('id') id: string) {
        const result = await this.planService.remove(id);
        return {
            success: true,
            data: result
        };
    }
}
