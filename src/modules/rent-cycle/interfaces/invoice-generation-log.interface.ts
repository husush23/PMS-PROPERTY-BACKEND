export interface InvoiceGenerationLog {
  leaseId: string;
  period: string;
  invoiceNumber?: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  error?: string;
  timestamp: Date;
}
