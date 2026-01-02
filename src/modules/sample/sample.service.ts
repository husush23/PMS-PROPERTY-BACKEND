import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './entities/item.entity';

@Injectable()
export class SampleService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
  ) {}

  async findAll() {
    return this.itemRepository.find();
  }

  async findOne(id: string) {
    return this.itemRepository.findOne({ where: { id } });
  }

  async create(data: { name: string; description?: string; price?: number }) {
    const item = this.itemRepository.create(data);
    return this.itemRepository.save(item);
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      isActive?: boolean;
    },
  ) {
    await this.itemRepository.update(id, data);
    return this.itemRepository.findOne({ where: { id } });
  }

  async delete(id: string) {
    const result = await this.itemRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
