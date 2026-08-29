import { Link } from "react-router-dom";
import MoneyLabel from "./MoneyLabel";
import type { ExpenseLine } from "@/lib/salaryEmployees";

interface SalaryRosterProps {
  lines: ExpenseLine[];
  periodLabel?: string | null;
  /** Salary roster: empty state links to /salary; otherwise a plain empty table. */
  salary?: boolean;
}

export default function SalaryRoster({ lines, periodLabel, salary = false }: SalaryRosterProps) {
  if (lines.length === 0) {
    return (
      <div className="salary-roster-empty">
        {salary ? (
          <>
            <p>Chưa có nhân viên.</p>
            <Link to="/salary" className="salary-roster-empty__link">
              Nhập từng người hoặc dán JSON
            </Link>
          </>
        ) : (
          <p>Chưa có chi tiết.</p>
        )}
      </div>
    );
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <div>
      <div className="salary-roster" role="list" aria-label={salary ? "Chi tiết lương nhân viên" : "Chi tiết khoản chi"}>
        {lines.map(line => (
          <div key={line.id || line.name} className="salary-roster__cell" role="listitem">
            <span className="salary-roster__name">{line.name}</span>
            <MoneyLabel
              amount={line.amount}
              className="salary-roster__pay"
              smallClassName="text-[0.7em]"
            />
          </div>
        ))}
      </div>
      <div className="salary-roster-foot">
        <span>
          {salary ? `${lines.length} NV` : `${lines.length} dòng`}
          {periodLabel ? ` · ${periodLabel}` : ""}
          {salary ? (
            <Link to="/salary" className="salary-roster-foot__edit">
              Sửa
            </Link>
          ) : null}
        </span>
        <MoneyLabel amount={total} className="salary-roster__pay" smallClassName="text-[0.7em]" />
      </div>
    </div>
  );
}
