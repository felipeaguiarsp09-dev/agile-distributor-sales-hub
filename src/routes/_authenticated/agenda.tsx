import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, NoAccess, RowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Dcalice" },
      { name: "description", content: "Visitas aos clientes por dia e semana, com check-in e registro." },
      { property: "og:title", content: "Agenda — Dcalice" },
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

type Visit = { id: string; scheduled_at: string; status: string; check_in_at: string | null; check_in_lat: number | null; check_in_lng: number | null; check_in_accuracy_m: number | null; notes: string | null; seller_id: string; customers: { name: string; address: unknown } | null; seller: { full_name: string } | null };

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

function AgendaPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"dia" | "semana">("dia");
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [newOpen, setNewOpen] = useState(false);
  const [record, setRecord] = useState<Visit | null>(null);
  const allowed = profile && profile.role !== "cliente";
  const from = view === "dia" ? anchor : startOfWeek(anchor);
  const to = addDays(from, view === "dia" ? 1 : 7);

  const visits = useQuery({
    queryKey: ["agenda_visits", from.toISOString(), to.toISOString()],
    enabled: !!allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("agenda_visits")
        .select("id, scheduled_at, status, check_in_at, check_in_lat, check_in_lng, check_in_accuracy_m, notes, seller_id, customers(name, address), seller:profiles!agenda_visits_seller_id_fkey(full_name)")
        .gte("scheduled_at", from.toISOString()).lt("scheduled_at", to.toISOString()).order("scheduled_at");
      if (error) throw error;
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

  const label = view === "dia"
    ? anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    : `${from.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${addDays(from, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1"><PageHeader title="Agenda" description="Suas visitas aos clientes, com check-in na chegada e registro do que foi feito." /></div>
        {(profile.role === "vendedor" || profile.role === "administrador") && <Button onClick={() => setNewOpen(true)}><CalendarPlus className="h-4 w-4" /> Nova visita</Button>}
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
        <EmptyState title={view === "dia" ? "Nenhuma visita neste dia" : "Nenhuma visita nesta semana"}>Use “Nova visita” para planejar.</EmptyState>
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
                    const addr = (v.customers?.address ?? {}) as Record<string, string>;
                    const mine = v.seller_id === profile.id || profile.role === "administrador";
                    return (
                      <li key={v.id} className="rounded-lg border bg-card p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tabular-nums">{new Date(v.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="font-medium">{v.customers?.name}</span>
                          <Badge variant={v.status === "cancelada" ? "destructive" : v.status === "realizada" ? "secondary" : "outline"} className="ml-auto">{STATUS[v.status]}</Badge>
                        </div>
                        {(addr["street"] || addr["city"]) && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3 w-3" /> {[addr["street"], addr["city"], addr["state"]].filter(Boolean).join(", ")}</p>}
                        {profile.role !== "vendedor" && <p className="text-xs text-muted-foreground">Vendedor: {v.seller?.full_name}</p>}
                        {v.check_in_at && <p className="mt-1 text-xs text-muted-foreground">Check-in às {new Date(v.check_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                        {v.check_in_lat != null && v.check_in_lng != null && (
                          <a href={mapsUrl(v.check_in_lat, v.check_in_lng)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2">
                            <MapPin className="h-3 w-3" /> Ver local do check-in no Google Maps
                          </a>
                        )}
                        {v.notes && <p className="mt-2 whitespace-pre-line text-sm">{v.notes}</p>}
                        {mine && v.status === "planejada" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setRecord(v)}><MapPin className="h-4 w-4" /> Check-in e registro</Button>
                            <Button size="sm" variant="outline" onClick={() => setStatus(v, "cancelada")}><X className="h-4 w-4" /> Cancelar</Button>
                          </div>
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

      <NewVisitDialog open={newOpen} onOpenChange={setNewOpen} defaultDate={anchor} />
      <RecordDialog visit={record} onClose={() => setRecord(null)} />
    </div>
  );
}

function NewVisitDialog({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (v: boolean) => void; defaultDate: Date }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const customers = useQuery({
    queryKey: ["customers", "agenda", profile?.id],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("customers").select("id, name, owner_id").order("name");
      if (profile?.role === "vendedor") q = q.eq("owner_id", profile.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    const c = customers.data?.find((x) => x.id === customer);
    const day = date || dayKey(defaultDate);
    if (!c) return void toast.error("Escolha o cliente");
    setBusy(true);
    const { error } = await supabase.from("agenda_visits").insert({
      organization_id: profile!.organization_id, customer_id: c.id,
      seller_id: profile!.role === "administrador" ? c.owner_id : profile!.id,
      scheduled_at: new Date(`${day}T${time}:00`).toISOString(), notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) return void toast.error("Não foi possível agendar a visita");
    toast.success("Visita agendada");
    onOpenChange(false);
    setCustomer(""); setNotes(""); setDate("");
    void qc.invalidateQueries({ queryKey: ["agenda_visits"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova visita</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Cliente</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger><SelectValue placeholder={customers.isLoading ? "Carregando..." : "Escolha o cliente"} /></SelectTrigger>
              <SelectContent>{customers.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {customers.isSuccess && !customers.data.length && <p className="text-xs text-muted-foreground">Nenhum cliente na sua carteira ainda.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="v-date">Data</Label><Input id="v-date" type="date" value={date || dayKey(defaultDate)} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="v-time">Horário</Label><Input id="v-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="v-notes">Objetivo (opcional)</Label><Textarea id="v-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Agendar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type GeoFix = { lat: number; lng: number; accuracy: number };

function RecordDialog({ visit, onClose }: { visit: Visit | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "buscando" | "erro">("idle");
  const [geoDenied, setGeoDenied] = useState(false);

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
    if (visit) capture();
  }, [visit?.id, capture]);

  async function save() {
    if (!visit || !geo) return;
    setBusy(true);
    const text = [visit.notes, notes.trim()].filter(Boolean).join("\n— Registro: ");
    const { error } = await supabase.from("agenda_visits").update({
      status: "realizada", check_in_at: new Date().toISOString(), notes: text || null,
      check_in_lat: geo?.lat ?? null, check_in_lng: geo?.lng ?? null, check_in_accuracy_m: geo?.accuracy ?? null,
    }).eq("id", visit.id);
    setBusy(false);
    if (error) return void toast.error("Não foi possível registrar a visita");
    toast.success(geo ? "Check-in registrado com localização" : "Check-in registrado");
    setNotes("");
    setGeo(null);
    onClose();
    void qc.invalidateQueries({ queryKey: ["agenda_visits"] });
  }
  return (
    <Dialog open={!!visit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Check-in — {visit?.customers?.name}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          {geoState === "buscando" && <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Obtendo sua localização...</span>}
          {geoState === "erro" && <span className="text-muted-foreground">Localização indisponível — o check-in será salvo sem ela.</span>}
          {geo && (
            <span className="text-muted-foreground">
              Localização capturada (precisão de ~{Math.round(geo.accuracy)} m) ·{" "}
              <a href={mapsUrl(geo.lat, geo.lng)} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">ver no mapa</a>
            </span>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-notes">O que foi feito na visita</Label>
          <Textarea id="r-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: cliente pediu reposição de água na próxima semana" />
        </div>
        <DialogFooter><Button disabled={busy || geoState === "buscando"} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Registrar visita</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
