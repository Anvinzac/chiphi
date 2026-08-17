import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureMockVendors, type VendorRow } from "@/lib/mockVendors";
import { readLaggedSnapshot } from "@/lib/laggedSnapshot";
import { isThrowawayAccount } from "@/lib/throwawayAccount";
import { useAuth } from "@/hooks/useAuth";

interface VendorsManagerProps {
  userId: string;
  /** Compact layout for embedding inside Admin tabs */
  compact?: boolean;
  onVendorsChange?: (vendors: VendorRow[]) => void;
}

export default function VendorsManager({
  userId,
  compact = false,
  onVendorsChange,
}: VendorsManagerProps) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const publish = useCallback(
    (rows: VendorRow[]) => {
      setVendors(rows);
      onVendorsChange?.(rows);
    },
    [onVendorsChange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await ensureMockVendors(userId, {
        allowSeed: isThrowawayAccount(user?.email),
      });
      publish(rows);
    } catch (err: any) {
      const lagged = await readLaggedSnapshot(userId);
      if (lagged?.data.suppliers.length) {
        publish(
          lagged.data.suppliers.map(s => ({
            id: s.id,
            name: s.name,
            contact: s.contact,
            notes: s.notes,
          })),
        );
      } else {
        toast.error(err?.message || "Không tải được nhà cung cấp");
      }
    } finally {
      setLoading(false);
    }
  }, [userId, publish, user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const addVendor = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: trimmed,
          contact: contact.trim() || null,
          notes: notes.trim() || null,
          user_id: userId,
        })
        .select("id, name, contact, notes")
        .single();
      if (error) throw error;
      if (data) {
        publish([...vendors, data].sort((a, b) => a.name.localeCompare(b.name, "vi")));
        setName("");
        setContact("");
        setNotes("");
        toast.success("Đã thêm nhà cung cấp");
      }
    } catch (err: any) {
      toast.error(err?.message || "Không thêm được");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (v: VendorRow) => {
    setEditingId(v.id);
    setEditName(v.name);
    setEditContact(v.contact || "");
    setEditNotes(v.notes || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditContact("");
    setEditNotes("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .update({
          name: editName.trim(),
          contact: editContact.trim() || null,
          notes: editNotes.trim() || null,
        })
        .eq("id", editingId)
        .select("id, name, contact, notes")
        .single();
      if (error) throw error;
      if (data) {
        publish(
          vendors
            .map(v => (v.id === editingId ? data : v))
            .sort((a, b) => a.name.localeCompare(b.name, "vi")),
        );
        cancelEdit();
        toast.success("Đã cập nhật");
      }
    } catch (err: any) {
      toast.error(err?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async (id: string) => {
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      publish(vendors.filter(v => v.id !== id));
      if (editingId === id) cancelEdit();
      toast.success("Đã xóa");
    } catch (err: any) {
      toast.error(err?.message || "Không xóa được");
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground px-0.5">
          Thêm nhà cung cấp
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Input
            placeholder="Tên..."
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-[10rem]"
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                addVendor();
              }
            }}
          />
          <Input
            placeholder="Liên hệ..."
            value={contact}
            onChange={e => setContact(e.target.value)}
            className="sm:w-36"
          />
          <Input
            placeholder="Ghi chú..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="flex-1 min-w-[8rem]"
          />
          <Button onClick={addVendor} disabled={!name.trim() || saving} size="sm" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Đang tải...</p>
        ) : vendors.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Chưa có nhà cung cấp
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {vendors.map(v =>
              editingId === v.id ? (
                <li key={v.id} className="p-3 space-y-2 bg-muted/30">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Tên"
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={editContact}
                      onChange={e => setEditContact(e.target.value)}
                      placeholder="Liên hệ"
                      className="text-sm"
                    />
                    <Input
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="Ghi chú"
                      className="text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={saveEdit}
                      disabled={!editName.trim() || saving}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={v.id} className="flex items-start gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.contact || "—"}
                      {v.notes ? ` · ${v.notes}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => startEdit(v)}
                    aria-label={`Sửa ${v.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => deleteVendor(v.id)}
                    aria-label={`Xóa ${v.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
