import { describe, expect, it } from "vitest";
import {
  compareGroupsByDateThenReminder,
  reminderDisplayDate,
  reminderPaymentId,
} from "./expenseSchedule";

describe("reminderDisplayDate", () => {
  it("does not preview a due date still in the future, even inside this week", () => {
    expect(reminderDisplayDate("2026-08-19", "2026-08-17", "2026-08-23", "2026-08-17")).toBeNull();
  });

  it("does not preview next week's or next month's occurrence", () => {
    expect(reminderDisplayDate("2026-08-24", "2026-08-24", "2026-08-30", "2026-08-17")).toBeNull();
    expect(reminderDisplayDate("2026-09-15", "2026-09-01", "2026-09-30", "2026-08-17")).toBeNull();
  });

  it("shows the reminder on that weekday or month-day once it has arrived", () => {
    expect(reminderDisplayDate("2026-08-19", "2026-08-17", "2026-08-23", "2026-08-19")).toBe(
      "2026-08-19",
    );
    expect(reminderDisplayDate("2026-08-15", "2026-08-01", "2026-08-31", "2026-08-17")).toBe(
      "2026-08-15",
    );
  });

  it("pins a missed occurrence to today when the due day is off-screen", () => {
    expect(reminderDisplayDate("2026-07-15", "2026-08-01", "2026-08-31", "2026-08-17")).toBe(
      "2026-08-17",
    );
  });
});

describe("compareGroupsByDateThenReminder", () => {
  it("puts the due reminder first among that day's expenses", () => {
    const reminderId = reminderPaymentId("sched-1");
    const groups = [
      { paymentId: "pay-1", date: "2026-08-17" },
      { paymentId: reminderId, date: "2026-08-17" },
      { paymentId: "pay-2", date: "2026-08-16" },
    ];
    const sorted = [...groups].sort(compareGroupsByDateThenReminder);
    expect(sorted.map(g => g.paymentId)).toEqual([reminderId, "pay-1", "pay-2"]);
  });
});
