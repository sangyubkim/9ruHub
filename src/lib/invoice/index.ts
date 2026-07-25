import { StubInvoiceRegisterAdapter } from "@/lib/invoice/stub";
import type { InvoiceRegisterAdapter } from "@/lib/invoice/types";

export function getInvoiceRegisterAdapter(): InvoiceRegisterAdapter {
  return new StubInvoiceRegisterAdapter();
}

export type {
  InvoiceRegisterAdapter,
  InvoiceRegisterRequest,
  InvoiceRegisterResult,
} from "@/lib/invoice/types";
