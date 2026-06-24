import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Configurações — AI Workforce" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, company_name")
        .eq("id", u.user.id)
        .maybeSingle();
      return { email: u.user.email ?? "", ...data };
    },
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCompanyName(profile.company_name ?? "");
    }
  }, [profile]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim().slice(0, 120), company_name: companyName.trim().slice(0, 120) })
        .eq("id", u.user.id);
      if (error) throw error;
      toast.success("Perfil atualizado");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <header className="flex h-14 items-center border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="text-sm font-medium text-muted-foreground">Configurações</div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <h1 className="font-display text-4xl text-foreground">Sua conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atualize seus dados e proteja seu acesso.
        </p>

        <section className="surface-card mt-8 p-6">
          <h2 className="text-sm font-semibold">Perfil</h2>
          {isLoading ? (
            <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <LabeledInput label="E-mail" value={profile?.email ?? ""} disabled />
              <LabeledInput
                label="Seu nome"
                value={fullName}
                onChange={setFullName}
                maxLength={120}
              />
              <LabeledInput
                label="Empresa"
                value={companyName}
                onChange={setCompanyName}
                maxLength={120}
              />
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar perfil
              </button>
            </form>
          )}
        </section>

        <section className="surface-card mt-6 p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Senha</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Verificamos sua nova senha contra bases públicas de senhas vazadas antes de aceitar.
          </p>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <LabeledInput
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              hint="Mínimo de 8 caracteres"
            />
            <LabeledInput
              label="Confirmar senha"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
            <button
              type="submit"
              disabled={savingPassword || !newPassword}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              Atualizar senha
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        maxLength={maxLength}
        className="mt-1.5 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
