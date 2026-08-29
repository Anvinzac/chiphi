import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Settings, Store, Bell, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BrandMenuProps {
  isDemo?: boolean;
  onSignOut?: () => void;
}

/** Interactive Mìsè brand trigger with Settings / Sign Out. */
export default function BrandMenu({ isDemo, onSignOut }: BrandMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1 justify-self-start rounded-lg px-1.5 py-1 -ml-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98]"
          aria-label="Mở menu Mìsè"
          aria-haspopup="menu"
        >
          <span className="font-display text-xl text-primary leading-none">Mìsè</span>
          <ChevronDown className="h-3.5 w-3.5 text-primary/55 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/vendors" className="flex cursor-pointer items-center gap-2">
            <Store className="h-4 w-4" />
            Nhà cung cấp
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/reminders" className="flex cursor-pointer items-center gap-2">
            <Bell className="h-4 w-4" />
            Lịch nhắc
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/salary" className="flex cursor-pointer items-center gap-2">
            <Users className="h-4 w-4" />
            Nhân viên
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex cursor-pointer items-center gap-2">
            <Settings className="h-4 w-4" />
            Cài đặt
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isDemo ? (
          <DropdownMenuItem asChild>
            <Link to="/auth" className="flex cursor-pointer items-center gap-2">
              <LogOut className="h-4 w-4" />
              Đăng nhập
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
            onSelect={() => onSignOut?.()}
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
