import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'PM Rental, A property management system for rental properties';
  }
}
