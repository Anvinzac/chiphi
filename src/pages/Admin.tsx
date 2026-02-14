import AdminDashboard from "@/components/admin/AdminDashboard";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-3 py-2 border-b border-border flex items-center gap-3 bg-card">
        <Link to="/" className="text-muted-foreground hover:text-foreground p-1" aria-label="Back to daily input">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="font-display text-lg text-primary">Dashboard</span>
      </div>
      <div className="container py-6">
        <AdminDashboard />
      </div>
    </div>
  );
};

export default Admin;
