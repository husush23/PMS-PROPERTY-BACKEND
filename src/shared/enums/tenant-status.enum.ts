export enum TenantStatus {
  PENDING = 'PENDING', // Tenant created, no lease yet
  ACTIVE = 'ACTIVE', // Has an active lease
  FORMER = 'FORMER', // All leases ended
}

