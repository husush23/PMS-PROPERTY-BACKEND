import { Controller } from '@nestjs/common';
import { LeaseService } from './lease.service';

@Controller({ path: 'leases', version: '1' })
export class LeaseController {
  constructor(private readonly leaseService: LeaseService) {}
}






