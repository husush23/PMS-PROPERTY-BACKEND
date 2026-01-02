import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SampleService } from './sample.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller({ path: 'sample', version: '1' })
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Get()
  async findAll() {
    return {
      success: true,
      data: await this.sampleService.findAll(),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.sampleService.findOne(id);
    if (!item) {
      return {
        success: false,
        message: 'Item not found',
      };
    }
    return {
      success: true,
      data: item,
    };
  }

  @Post()
  async create(
    @Body()
    createItemDto: {
      name: string;
      description?: string;
      price?: number;
    },
  ) {
    return {
      success: true,
      data: await this.sampleService.create(createItemDto),
    };
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    updateItemDto: {
      name?: string;
      description?: string;
      price?: number;
      isActive?: boolean;
    },
  ) {
    const item = await this.sampleService.update(id, updateItemDto);
    if (!item) {
      return {
        success: false,
        message: 'Item not found',
      };
    }
    return {
      success: true,
      data: item,
    };
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.sampleService.delete(id);
    return {
      success: deleted,
      message: deleted ? 'Item deleted successfully' : 'Item not found',
    };
  }
}
