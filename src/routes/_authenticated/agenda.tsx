import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, MapPin, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canRegisterVisit, canViewCheckInLocation, checkInDayRange, customerVisitAddress } from "@/lib/agenda";
import { listVisits } from "@/lib/agenda.functions";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, NoAccess, RowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Visitas — Dcalice" },
      { name: "description", content: "Visitas aos clientes por dia e semana, com check-in e registro." },
      { property: "og:title", content: "Visitas — Dcalice" },
      { property: "og:description", content: "Visitas aos clientes por dia e semana, com check-in e registro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

const STATUS: Record<string, string> = { planejada: "Planejada", realizada: "Realizada", cancelada: "Cancelada" };
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE");
function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

type Visit = { id: string; customer_id: string; scheduled_at: string; status: string; check_in_at: string | null; check_in_lat: number | null; check_in_lng: number | null; check_in_accuracy_m: number | null; notes: string | null; seller_id: string; customers: { name: string; address: unknown } | null; seller: { full_name: string } | null };

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

function AgendaPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"dia" | "semana">("dia");
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [newOpen, setNewOpen] = useState(false);
  const [record, setRecord] = useState<Visit | null>(null);
  const allowed = profile && profile.role !== "cliente";
  // Só supervisor e administrador visualizam a localização dos check-ins.
  const canViewLocation = canViewCheckInLocation(profile?.role);
  const from = view === "dia" ? anchor : startOfWeek(anchor);
  const to = addDays(from, view === "dia" ? 1 : 7);

  const visits = useQuery({
    queryKey: ["agenda_visits", profile?.id, profile?.role, from.toISOString(), to.toISOString()],
    enabled: !!allowed,
    queryFn: async () => {
      const data = await listVisits({ data: { from: from.toISOString(), to: to.toISOString() } });
      return data as Visit[];
    },
  });

  const days = useMemo(() => Array.from({ length: view === "dia" ? 1 : 7 }, (_, i) => addDays(from, i)), [from.getTime(), view]);
  if (!allowed) return <NoAccess />;

  async function setStatus(v: Visit, status: "cancelada") {
    const { error } = await supabase.from("agenda_visits").update({ status }).eq("id", v.id);
    if (error) return void toast.error("Não foi possível atualizar a visita");
    toast.success("Visita cancelada");
    void qc.invalidateQueries({ queryKey: ["agenda_visits"] });
  }

  async function removeVisit(v: Visit) {
    if (!window.confirm("Excluir este agendamento? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("agenda_visits").delete().eq("id", v.id);
    if (error) return void toast.error("Não foi possível excluir o agendamento");
    toast.success("Agendamento excluído");
    void qc.invalidateQueries({ queryKey: ["agenda_visits"] });
  }

  const label = view === "dia"
    ? anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    : `${from.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${addDays(from, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1"><PageHeader title="Visitas" description="Faça o check-in ao chegar no cliente e anote a observação da visita." /></div>
        {(profile.role === "vendedor" || profile.role === "administrador") && <Button onClick={() => setNewOpen(true)}><MapPin className="h-4 w-4" /> Fazer check-in</Button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border">
          {(["dia", "semana"] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? "default" : "ghost"} onClick={() => setView(v)} className="capitalize">{v}</Button>
          ))}
        </div>
        <Button size="icon" variant="outline" aria-label="Anterior" onClick={() => setAnchor(addDays(anchor, view === "dia" ? -1 : -7))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" aria-label="Próximo" onClick={() => setAnchor(addDays(anchor, view === "dia" ? 1 : 7))}><ChevronRight className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d); }}>Hoje</Button>
        <span className="text-sm font-medium capitalize">{label}</span>
      </div>

      {visits.isLoading ? <RowsSkeleton rows={3} /> : visits.isError ? (
        <ErrorState message="Não foi possível carregar a agenda" onRetry={() => visits.refetch()} />
      ) : !visits.data?.length ? (
        <EmptyState title={view === "dia" ? "Nenhuma visita neste dia" : "Nenhuma visita nesta semana"}>Ao chegar no cliente, use “Fazer check-in”.</EmptyState>
      ) : (
        <div className="space-y-5">
          {days.map((d) => {
            const list = visits.data.filter((v) => dayKey(new Date(v.scheduled_at)) === dayKey(d));
            if (view === "semana" && !list.length) return null;
            return (
              <section key={dayKey(d)}>
                {view === "semana" && <h2 className="mb-2 text-sm font-semibold capitalize">{d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}</h2>}
                <ul className="space-y-2">
                  {list.map((v) => {
                    const address = customerVisitAddress(v.customers?.address);
                    const mine = v.seller_id === profile.id || profile.role === "administrador";
                    return (
                      <li key={v.id} className="rounded-lg border bg-card p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tabular-nums">{new Date(v.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="font-medium">{v.customers?.name}</span>
                          <Badge variant={v.status === "cancelada" ? "destructive" : v.status === "realizada" ? "secondary" : "outline"} className={`ml-auto${v.status === "realizada" ? " border-transparent bg-success text-success-foreground" : v.status === "planejada" ? " border-transparent bg-warning text-warning-foreground" : ""}`}>{STATUS[v.status]}</Badge>
                        </div>
                        {address && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3 w-3" /> {address}</p>}
                        {profile.role !== "vendedor" && <p className="text-xs text-muted-foreground">Vendedor: {v.seller?.full_name}</p>}
                        {v.check_in_at && <p className="mt-1 text-xs text-muted-foreground">Check-in às {new Date(v.check_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                        {canViewLocation && v.check_in_lat != null && v.check_in_lng != null && (
                          <a href={mapsUrl(v.check_in_lat, v.check_in_lng)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2">
                            <MapPin className="h-3 w-3" /> Ver local do check-in no Google Maps
                          </a>
                        )}
                        {v.notes && <p className="mt-2 whitespace-pre-line text-sm">{v.notes}</p>}
                        {mine && v.status === "planejada" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setRecord(v)}><MapPin className="h-4 w-4" /> {v.check_in_at ? "Registrar visita" : "Fazer check-in"}</Button>
                            {!v.check_in_at && <Button size="sm" variant="outline" onClick={() => setStatus(v, "cancelada")}><X className="h-4 w-4" /> Cancelar</Button>}
                          </div>
                        )}
                        {mine && v.status !== "realizada" && !v.check_in_at && (
                          <Button size="sm" variant="ghost" className="mt-2 text-destructive" onClick={() => removeVisit(v)}><Trash2 className="h-4 w-4" /> Excluir</Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <CheckInDialog open={newOpen} onOpenChange={setNewOpen} />
      <RecordDialog visit={record} onClose={() => setRecord(null)} />
    </div>
  );
}

function CheckInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { profile } = useAuth();
  const canViewLocation = canViewCheckInLocation(profile?.role);
  const qc = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "buscando" | "erro">("idle");
  const [geoDenied, setGeoDenied] = useState(false);
  const [geoTimeout, setGeoTimeout] = useState(false);
  const customers = useQuery({
    queryKey: ["customers", "agenda", profile?.id],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("customers").select("id, name, owner_id, address").order("name");
      if (profile?.role === "vendedor") q = q.eq("owner_id", profile.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const capture = useCallback(() => {
    setGeo(null); setGeoDenied(false); setGeoTimeout(false);
    if (!("geolocation" in navigator)) { setGeoState("erro"); return; }
    setGeoState("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGeoState("idle"); },
      (err) => { setGeoDenied(err.code === err.PERMISSION_DENIED); setGeoTimeout(err.code === err.TIMEOUT); setGeoState("erro"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);
  useEffect(() => { if (open) { setCustomer(""); setNotes(""); capture(); } }, [open, capture]);
  const selected = customers.data?.find((x) => x.id === customer);
  const address = customerVisitAddress(selected?.address);

  async function save() {
    if (!profile || busy) return;
    if (!selected) return void toast.error("Escolha o cliente");
    if (!geo) return void toast.error("É preciso a localização para fazer o check-in");
    setBusy(true);
    const now = new Date();
    const range = checkInDayRange(now);
    const { data: existing, error: lookupError } = await supabase.from("agenda_visits")
      .select("id").eq("customer_id", selected.id).gte("check_in_at", range.from).lt("check_in_at", range.to).limit(1);
    if (lookupError || existing?.length) {
      setBusy(false);
      return void toast.error(lookupError ? "Não foi possível verificar os check-ins. Tente novamente." : "Já existe um check-in neste cliente hoje. Só é permitido um check-in por cliente por dia.");
    }
    const { data: saved, error } = await supabase.from("agenda_visits").insert({
      organization_id: profile.organization_id, customer_id: selected.id,
      seller_id: profile.role === "administrador" ? selected.owner_id : profile.id,
      scheduled_at: now.toISOString(), check_in_at: now.toISOString(),
      check_in_lat: geo.lat, check_in_lng: geo.lng, check_in_accuracy_m: geo.accuracy,
    }).select("id").single();
    if (error || !saved) {
      setBusy(false);
      return void toast.error(error?.code === "23505" ? "Já existe um check-in neste cliente hoje. Só é permitido um check-in por cliente por dia." : "Não foi possível fazer o check-in");
    }
    const { error: regError } = await supabase.from("agenda_visits").update({ status: "realizada", notes: notes.trim() || null }).eq("id", saved.id);
    setBusy(false);
    void qc.invalidateQueries({ queryKey: ["agenda_visits"] });
    if (regError) return void toast.error("Check-in feito, mas a observação não foi salva. Tente registrar de novo pela lista.");
    toast.success("Check-in registrado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Fazer check-in</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Cliente</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger><SelectValue placeholder={customers.isLoading ? "Carregando..." : "Escolha o cliente"} /></SelectTrigger>
              <SelectContent>{customers.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {customers.isSuccess && !customers.data.length && <p className="text-xs text-muted-foreground">Nenhum cliente na sua carteira ainda.</p>}
            {address && <p className="flex items-start gap-2 pt-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{address}</p>}
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {geoState === "buscando" && <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Obtendo sua localização...</span>}
              {geoState === "erro" && <span role="alert" className="font-medium text-destructive">{geoDenied ? "Localização negada." : geoTimeout ? "A localização demorou demais para responder." : "Localização indisponível."} Sem ela, o check-in não pode ser feito.</span>}
              {geo && <span>Localização capturada{canViewLocation && <> · <a href={mapsUrl(geo.lat, geo.lng)} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">ver no mapa</a></>}</span>}
            </div>
            {geoState === "erro" && (
              <div className="mt-2 space-y-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">{geoDenied ? "Para fazer o check-in, permita a Localização nas permissões do site (cadeado na barra de endereço). No celular, confira também se a localização do aparelho está ligada." : "Verifique se o GPS do aparelho está ligado e se há sinal, depois tente novamente."}</p>
                <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:h-8 sm:w-auto" onClick={capture}><RefreshCw className="h-4 w-4" /> Tentar novamente</Button>
              </div>
            )}
          </div>
          <div className="space-y-1"><Label htmlFor="c-notes">Observação</Label><Textarea id="c-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: cliente pediu reposição de água na próxima semana" /></div>
        </div>
        <DialogFooter><Button disabled={busy || !geo || !selected} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar check-in</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type GeoFix = { lat: number; lng: number; accuracy: number };

function RecordDialog({ visit, onClose }: { visit: Visit | null; onClose: () => void }) {
  const { profile } = useAuth();
  const canViewLocation = canViewCheckInLocation(profile?.role);
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "buscando" | "erro">("idle");
  const [geoDenied, setGeoDenied] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const checkedIn = canRegisterVisit(checkedInAt);

  // Captura o GPS ao abrir o diálogo; o check-in exige a localização.
  const capture = useCallback(() => {
    setGeo(null);
    setGeoDenied(false);
    if (!("geolocation" in navigator)) { setGeoState("erro"); return; }
    setGeoState("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGeoState("idle"); },
      (err) => { setGeoDenied(err.code === err.PERMISSION_DENIED); setGeoState("erro"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    setNotes("");
    setCheckedInAt(visit?.check_in_at ?? null);
    setGeo(null);
    if (visit && !visit.check_in_at) capture();
  }, [visit?.id, capture]);

  async function checkIn() {
    if (!visit || !geo || busy) return;
    setBusy(true);
    const now = new Date();
    const range = checkInDayRange(now);
    const { data: existing, error: lookupError } = await supabase.from("agenda_visits")
      .select("id").eq("customer_id", visit.customer_id)
      .gte("check_in_at", range.from).lt("check_in_at", range.to).limit(1);
    if (lookupError || existing?.length) {
      setBusy(false);
      toast.error(lookupError ? "Não foi possível verificar os check-ins. Tente novamente." : "Já existe um check-in neste cliente hoje. Só é permitido um check-in por cliente por dia.");
      return;
    }
    const { data: saved, error } = await supabase.from("agenda_visits").update({
      check_in_at: now.toISOString(),
      check_in_lat: geo.lat, check_in_lng: geo.lng, check_in_accuracy_m: geo.accuracy,
    }).eq("id", visit.id).is("check_in_at", null).select("id, check_in_at").single();
    setBusy(false);
    if (error) return void toast.error(error.code === "23505" ? "Já existe um check-in neste cliente hoje. Só é permitido um check-in por cliente por dia." : "Não foi possível registrar a visita");
    toast.success("Check-in registrado");
    setCheckedInAt(saved.check_in_at);
    setGeo(null);
    void qc.invalidateQueries({ queryKey: ["agenda_visits"] });
  }

  async function save() {
    if (!visit || !checkedIn || busy) return;
    setBusy(true);
    const text = [visit.notes, notes.trim()].filter(Boolean).join("\n— Registro: ");
    const { error } = await supabase.from("agenda_visits").update({ status: "realizada", notes: text || null })
      .eq("id", visit.id).not("check_in_at", "is", null).select("id").single();
    setBusy(false);
    if (error) return void toast.error("Não foi possível registrar a visita. Faça o check-in primeiro.");
    toast.success("Visita registrada");
    onClose();
    void qc.invalidateQueries({ queryKey: ["agenda_visits"] });
  }
  return (
    <Dialog open={!!visit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{checkedIn ? "Registrar visita" : "Check-in"} — {visit?.customers?.name}</DialogTitle></DialogHeader>
        {customerVisitAddress(visit?.customers?.address) && <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{customerVisitAddress(visit?.customers?.address)}</p>}
        {checkedIn && <p className="text-sm text-muted-foreground">Check-in registrado às {new Date(checkedInAt ?? "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
        {!checkedIn && (canViewLocation || !geo) && <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            {geoState === "buscando" && <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Obtendo sua localização...</span>}
            {geoState === "erro" && (
              <span className="text-muted-foreground">
                {geoDenied ? "Permissão de localização negada." : "Não foi possível obter sua localização."}
              </span>
            )}
            {geo && (
              <span className="text-muted-foreground">
                Localização capturada (precisão de ~{Math.round(geo.accuracy)} m)
                {canViewLocation && (
                  <>
                    {" · "}
                    <a href={mapsUrl(geo.lat, geo.lng)} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">ver no mapa</a>
                  </>
                )}
              </span>
            )}
          </div>
          {geoState === "erro" && (
            <div className="mt-2 space-y-2 border-t pt-2">
              <p className="text-xs text-muted-foreground">
                {geoDenied
                  ? "Para concluir o check-in, ative a localização: toque no cadeado (ou ícone de ajustes) na barra de endereço do navegador, abra as permissões do site e permita a Localização. No celular, verifique também se a localização do aparelho está ligada."
                  : "Verifique se o GPS do aparelho está ligado e se há sinal, depois tente novamente."}
              </p>
              <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:h-8 sm:w-auto" onClick={capture}>
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          )}
        </div>}
        {checkedIn && <div className="space-y-1">
          <Label htmlFor="r-notes">O que foi feito na visita</Label>
          <Textarea id="r-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: cliente pediu reposição de água na próxima semana" />
        </div>}
        <DialogFooter><Button disabled={busy || (!checkedIn && !geo)} onClick={checkedIn ? save : checkIn}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {checkedIn ? "Registrar visita" : "Confirmar check-in"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
