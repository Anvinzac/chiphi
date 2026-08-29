import { Link } from "react-router-dom";
import MoneyLabel from "./MoneyLabel";
import type { ExpenseLine } from "@/lib/salaryEmployees";

interface SalaryRosterProps {
  lines: ExpenseLine[];
  periodLabel?: string | null;
  /** Salary roster: empty state links to /salary; otherwise a plain empty table. */
  salary?: boolean;
  /** Flush padding for the add-expense panel (list view keeps the fold indent). */
  panel?: boolean;
}

export default function SalaryRoster({ lines, periodLabel, salary = false, panel = false }: SalaryRosterProps) {
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
  const caption = salary ? "Chi tiết lương nhân viên" : "Chi tiết khoản chi";

  return (
    <div className={panel ? "salary-roster-wrap salary-roster-wrap--panel" : "salary-roster-wrap"}>
      <table className="salary-roster">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {lines.map(line => (
            <tr key={line.id || line.name}>
              <th scope="row" className="salary-roster__name">
                {line.name}
              </th>
              <td className="salary-roster__pay">
                <MoneyLabel amount={line.amount} smallClassName="text-[0.7em]" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">
              <span className="salary-roster-foot__label">Tổng cộng</span>
              <span className="salary-roster-foot__note">
                {salary ? `${lines.length} NV` : `${lines.length} dòng`}
                {periodLabel ? ` · ${periodLabel}` : ""}
                {salary ? (
                  <Link to="/salary" className="salary-roster-foot__edit">
                    Sửa
                  </Link>
                ) : null}
              </span>
            </th>
            <td className="salary-roster__pay">
              <MoneyLabel amount={total} smallClassName="text-[0.7em]" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
