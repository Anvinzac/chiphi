import { supabase } from "@/integrations/supabase/client";
import {
  addMonthsKeepingDom,
  dayOfMonthFromIso,
  formatSpanFractionLabel,
  splitAmountAcrossPeriods,
} from "@/lib/expenseSpan";

export type SpanLineMeta = {
  item_name: string;
  item_id?: string | null;
  category_id?: string | null;
  sub_category_id?: string | null;
  sub_sub_category_id?: string | null;
  supplier_id?: string | null;
  notes?: string | null;
  unit_price?: number;
};

type ActiveSpan = {
  id: string;
  user_id: string;
  item_name: string;
  item_id: string | null;
  category_id: string | null;
  sub_category_id: string | null;
  sub_sub_category_id: string | null;
  supplier_id: string | null;
  notes: string | null;
  total_amount: number;
  period_count: number;
  posted_count: number;
  day_of_month: number;
  next_due_date: string;
  status: string;
};

/** Create span + first installment payment on `firstDate`. Returns first installment amount. */
export async function createExpenseSpan(args: {
  userId: string;
  firstDate: string;
  totalAmount: number;
  periodCount: number;
  meta: SpanLineMeta;
}): Promise<{ spanId: string; firstAmount: number; periodCount: number } | null> {
  const periodCount = Math.min(120, Math.max(2, Math.floor(args.periodCount)));
  const amounts = splitAmountAcrossPeriods(args.totalAmount, periodCount);
  const firstAmount = amounts[0];
  if (firstAmount <= 0) return null;

  const dayOfMonth = dayOfMonthFromIso(args.firstDate);
  const nextDue = addMonthsKeepingDom(args.firstDate, dayOfMonth, 1);

  const { data: span, error: spanErr } = await supabase
    .from("expense_spans")
    .insert({
      user_id: args.userId,
      item_name: args.meta.item_name,
      item_id: args.meta.item_id ?? null,
      category_id: args.meta.category_id ?? null,
      sub_category_id: args.meta.sub_category_id ?? null,
      sub_sub_category_id: args.meta.sub_sub_category_id ?? null,
      supplier_id: args.meta.supplier_id ?? null,
      notes: args.meta.notes ?? null,
      total_amount: args.totalAmount,
      period_count: periodCount,
      posted_count: 0,
      day_of_month: dayOfMonth,
      start_date: args.firstDate,
      next_due_date: args.firstDate,
      status: "active",
    })
    .select("*")
    .single();

  if (spanErr || !span) {
    throw new Error(spanErr?.message || "Không tạo được lịch chia kỳ");
  }

  await postSpanInstallment({
    span: span as ActiveSpan,
    amounts,
    dueDate: args.firstDate,
    unitPrice: args.meta.unit_price,
  });

  return { spanId: span.id, firstAmount, periodCount };
}

async function postSpanInstallment(args: {
  span: ActiveSpan;
  amounts: number[];
  dueDate: string;
  unitPrice?: number;
}): Promise<boolean> {
  const { span, amounts, dueDate } = args;
  const index = span.posted_count + 1;
  if (index > span.period_count) return false;

  const amount = amounts[index - 1];
  if (!amount || amount <= 0) return false;

  // Idempotent: skip if this index already exists
  const { data: existing } = await supabase
    .from("expense_span_installments")
    .select("id")
    .eq("span_id", span.id)
    .eq("installment_index", index)
    .maybeSingle();
  if (existing) return false;

  const label = formatSpanFractionLabel(index, span.period_count);
  const noteParts = [span.notes, label].filter(Boolean);
  const unitPrice = args.unitPrice && args.unitPrice > 0 ? args.unitPrice : amount;

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      date: dueDate,
      user_id: span.user_id,
      total_amount: 0,
      supplier_id: span.supplier_id,
    })
    .select("id")
    .single();
  if (payErr || !payment) throw new Error(payErr?.message || "Không tạo payment chia kỳ");

  const { data: sub, error: subErr } = await supabase
    .from("sub_payments")
    .insert({
      payment_id: payment.id,
      item_name: span.item_name,
      item_id: span.item_id,
      quantity: unitPrice ? amount / unitPrice : 1,
      unit_price: unitPrice,
      amount,
      category_id: span.category_id,
      sub_category_id: span.sub_category_id,
      sub_sub_category_id: span.sub_sub_category_id,
      supplier_id: span.supplier_id,
      notes: noteParts.join(" · "),
      user_id: span.user_id,
    })
    .select("id")
    .single();
  if (subErr || !sub) throw new Error(subErr?.message || "Không tạo dòng chia kỳ");

  const { error: instErr } = await supabase.from("expense_span_installments").insert({
    span_id: span.id,
    installment_index: index,
    amount,
    due_date: dueDate,
    payment_id: payment.id,
    sub_payment_id: sub.id,
  });
  if (instErr) throw new Error(instErr.message);

  const posted = index;
  const done = posted >= span.period_count;
  const nextDue = done
    ? dueDate
    : addMonthsKeepingDom(dueDate, span.day_of_month, 1);

  const { error: updErr } = await supabase
    .from("expense_spans")
    .update({
      posted_count: posted,
      next_due_date: nextDue,
      status: done ? "completed" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", span.id);
  if (updErr) throw new Error(updErr.message);

  span.posted_count = posted;
  span.next_due_date = nextDue;
  span.status = done ? "completed" : "active";
  return true;
}

/**
 * Post any due span installments with next_due_date <= asOfDate (never future).
 * Returns number of installments created.
 */
export async function applyDueExpenseSpans(userId: string, asOfDate: string): Promise<number> {
  const { data: spans, error } = await supabase
    .from("expense_spans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("next_due_date", asOfDate)
    .order("next_due_date", { ascending: true });

  if (error) throw new Error(error.message);
  if (!spans?.length) return 0;

  let created = 0;
  for (const raw of spans) {
    const span = raw as ActiveSpan;
    const amounts = splitAmountAcrossPeriods(Number(span.total_amount), span.period_count);

    // Catch up all overdue installments through asOfDate (still never past asOfDate)
    let guard = 0;
    while (
      span.status === "active" &&
      span.posted_count < span.period_count &&
      span.next_due_date <= asOfDate &&
      guard < 130
    ) {
      guard += 1;
      const due = span.next_due_date;
      const ok = await postSpanInstallment({ span, amounts, dueDate: due });
      if (!ok) break;
      created += 1;
    }
  }
  return created;
}
