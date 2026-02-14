export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  notes?: string;
}

export interface SubCategory {
  id: string;
  name: string;
  categoryId: string;
  parentSubCategoryId?: string; // for 2nd level
}

export interface Category {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  subCategoryId?: string;
  subSubCategoryId?: string;
  defaultSupplierId?: string;
  defaultUnitPrice?: number;
  unit?: string;
}

export interface SubPayment {
  id: string;
  paymentId: string;
  itemId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  categoryId?: string;
  subCategoryId?: string;
  subSubCategoryId?: string;
  supplierId?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  date: string; // ISO date
  time: string; // HH:mm
  totalAmount: number;
  supplierId?: string;
  receiptPhoto?: string; // URL or placeholder
  notes?: string;
  subPayments: SubPayment[];
}

export interface DailyExpense {
  date: string;
  payments: Payment[];
}

// For the quick verify popup
export interface VerifyData {
  itemName: string;
  categoryName: string;
  subCategoryName: string;
  subSubCategoryName?: string;
  supplierName: string;
  unitPrice: number;
  unit: string;
  // IDs for saving
  itemId?: string;
  categoryId?: string;
  subCategoryId?: string;
  subSubCategoryId?: string;
  supplierId?: string;
}
