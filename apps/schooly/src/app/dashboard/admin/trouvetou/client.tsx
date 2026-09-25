"use client"

import { useMemo, useState, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Megaphone, Power, PowerOff, Plus, MapPin, Image as ImageIcon, Video,
  Users, CheckCircle2, XCircle, Loader2, Sparkles, Camera, Globe2,
  Phone, Mail, ExternalLink, Eye, Pencil, Trash2, Info, Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { errorMessage, profileCompletion, reservationLabel } from "./_lib/helpers"
import type { TrouvetouAd, TrouvetouReservation, TrouvetouSchool } from "./_lib/types"

interface TrouvetouAdminClientProps {
  school: TrouvetouSchool | null
  reservations: TrouvetouReservation[]
  ads: TrouvetouAd[]
}

type Modal = "profile" | "media" | "publication" | "reservation" | "ad" | null

export function TrouvetouAdminClient({
  school,
  reservations: initialReservations,
  ads: initialAds,
}: TrouvetouAdminClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [modal, setModal] = useState<Modal>(null)
  const [selectedReservation, setSelectedReservation] = useState<TrouvetouReservation | null>(null)
  const [qualificationLoading, setQualificationLoading] = useState(false)

  const [published, setPublished] = useState(Boolean(school?.published_to_trouvetou))
  const [description, setDescription] = useState(school?.description_publique || "")
  const [latitude, setLatitude] = useState(school?.latitude?.toString() || "")
  const [longitude, setLongitude] = useState(school?.longitude?.toString() || "")
  const [itineraire, setItineraire] = useState(school?.itineraire || "")
  const [videoUrl, setVideoUrl] = useState(school?.video_url || "")
  const [coverPhoto, setCoverPhoto] = useState(school?.cover_photo_url || "")
  const [gallery, setGallery] = useState<string[]>(school?.gallery_photos ?? [])
  const [photos360, setPhotos360] = useState<string[]>(school?.photos_360 ?? [])
  const [address, setAddress] = useState(school?.public_address || "")
  const [phone, setPhone] = useState(school?.public_phone || "")
  const [email, setEmail] = useState(school?.public_email || "")
  const [website, setWebsite] = useState(school?.public_website_url || "")
  const [highlights, setHighlights] = useState<string[]>(school?.public_highlights ?? [])
  const [admissionNotes, setAdmissionNotes] = useState(school?.admission_notes || "")

  const [reservations] = useState(initialReservations)
  const [ads, setAds] = useState(initialAds)
  const [adTitle, setAdTitle] = useState("")
  const [adMessage, setAdMessage] = useState("")
  const [adImageUrl, setAdImageUrl] = useState("")
  const [adTargetUrl, setAdTargetUrl] = useState("")
  const [adStartDate, setAdStartDate] = useState("")
  const [adEndDate, setAdEndDate] = useState("")

  const completion = useMemo(() => {
    return profileCompletion({
      coverPhoto,
      description,
      address,
      latitude,
      longitude,
      phone,
      email,
      gallery,
      videoUrl,
      highlights,
      admissionNotes,
    })
  }, [coverPhoto, description, address, latitude, longitude, phone, email, gallery, videoUrl, highlights, admissionNotes])

  const saveProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description_publique: description,
          latitude,
          longitude,
          itineraire,
          video_url: videoUrl,
          cover_photo_url: coverPhoto,
          gallery_photos: gallery,
          photos_360: photos360,
          public_address: address,
          public_phone: phone,
          public_email: email,
          public_website_url: website,
          public_highlights: highlights,
          admission_notes: admissionNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Échec")
      toast.success("Profil Trouvetou mis à jour")
      setModal(null)
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error, "Erreur lors de la sauvegarde"))
    } finally {
      setLoading(false)
    }
  }, [description, latitude, longitude, itineraire, videoUrl, coverPhoto, gallery, photos360, address, phone, email, website, highlights, admissionNotes, router])

  const uploadMedia = useCallback(async (file: File, kind: "cover" | "gallery" | "360") => {
    const form = new FormData()
    form.append("file", file)
    form.append("kind", kind)
    const res = await fetch("/api/v1/admin/trouvetou/media", { method: "POST", body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Upload impossible")
    return data.url as string
  }, [])

  const handleMediaUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, kind: "cover" | "gallery" | "360") => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setLoading(true)
    try {
      if (kind === "cover") {
        setCoverPhoto(await uploadMedia(files[0], "cover"))
      } else {
        const urls = await Promise.all(files.slice(0, 10).map(file => uploadMedia(file, kind)))
        if (kind === "gallery") setGallery(prev => [...prev, ...urls])
        else setPhotos360(prev => [...prev, ...urls])
      }
      toast.success("Image ajoutée")
    } catch (error) {
      toast.error(errorMessage(error, "Erreur lors de l'upload"))
    } finally {
      setLoading(false)
      event.target.value = ""
    }
  }, [uploadMedia])

  const togglePublish = useCallback(async () => {
    setLoading(true)
    try {
      const next = !published
      const res = await fetch("/api/v1/admin/trouvetou/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Échec")
      setPublished(next)
      toast.success(next ? "Établissement publié sur Trouvetou" : "Publication désactivée")
      setModal(null)
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error, "Erreur de publication"))
    } finally {
      setLoading(false)
    }
  }, [published, router])

  const createAd = useCallback(async () => {
    if (!adTitle.trim() || !adMessage.trim() || !adStartDate || !adEndDate) {
      toast.error("Complète le titre, message et période")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: adTitle, message: adMessage, image_url: adImageUrl, target_url: adTargetUrl, start_date: adStartDate, end_date: adEndDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Échec")
      setAds(prev => [{ id: crypto.randomUUID(), title: adTitle, message: adMessage, image_url: adImageUrl, target_url: adTargetUrl, start_date: adStartDate, end_date: adEndDate, is_active: true }, ...prev])
      setAdTitle(""); setAdMessage(""); setAdImageUrl(""); setAdTargetUrl(""); setAdStartDate(""); setAdEndDate("")
      setModal(null)
      toast.success("Publicité créée")
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error, "Erreur"))
    } finally {
      setLoading(false)
    }
  }, [adTitle, adMessage, adImageUrl, adTargetUrl, adStartDate, adEndDate, router])

  const updateReservation = useCallback(async () => {
    if (!selectedReservation) return
    setQualificationLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/reservations/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: selectedReservation.id,
          student_full_name: selectedReservation.student_full_name,
          student_birthdate: selectedReservation.student_birthdate,
          parent_full_name: selectedReservation.parent_full_name,
          parent_phone: selectedReservation.parent_phone,
          parent_email: selectedReservation.parent_email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Impossible de mettre à jour la demande")
      setSelectedReservation(data.reservation)
      toast.success("Dossier qualifié et mis à jour")
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error, "Erreur de qualification"))
    } finally {
      setQualificationLoading(false)
    }
  }, [selectedReservation, router])

  const removeItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={published ? "default" : "secondary"}>{published ? "Publié" : "Brouillon"}</Badge>
            <Badge variant="outline"><Sparkles className="mr-1 h-3.5 w-3.5" /> Profil intelligent</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{school?.name || "Trouvetou"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prépare la vitrine publique de ton établissement et transforme les demandes en inscriptions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModal("profile")}><Pencil className="mr-2 h-4 w-4" /> Modifier le profil</Button>
          <Button onClick={() => setModal("publication")}><Megaphone className="mr-2 h-4 w-4" /> {published ? "Gérer la publication" : "Publier"}</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_.8fr]">
            <div className="relative min-h-[220px] overflow-hidden bg-muted">
              {coverPhoto ? (
                <Image
                  src={coverPhoto}
                  alt="Photo principale de l'établissement"
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-muted-foreground">
                  <Camera className="mb-3 h-10 w-10" />
                  <p className="font-medium">Ajoute une photo principale</p>
                  <p className="mt-1 text-xs">Elle sera utilisée comme couverture sur Trouvetou.</p>
                </div>
              )}
              <Button size="sm" variant="secondary" className="absolute bottom-3 left-3 shadow-md" onClick={() => setModal("media")}>
                <Camera className="mr-2 h-4 w-4" /> Gérer les photos
              </Button>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Qualité du profil</p><p className="text-xs text-muted-foreground">{completion.done}/{completion.total} éléments renseignés</p></div>
                <span className="text-lg font-semibold">{completion.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion.percent}%` }} /></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {completion.checks.map(([ok, label]) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertIcon />}
                    <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
              <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground"><Sparkles className="mr-1 inline h-3.5 w-3.5" /> Schooly utilise cette complétude pour t&apos;indiquer ce qui manque avant une publication de qualité.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="reservations"><Users className="mr-2 h-4 w-4" />Demandes ({reservations.length})</TabsTrigger>
          <TabsTrigger value="ads"><ImageIcon className="mr-2 h-4 w-4" />Publicités ({ads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <QuickCard icon={<Globe2 className="h-5 w-5" />} title="Profil public" value={school?.city || "Localisation à renseigner"} action={() => setModal("profile")} />
            <QuickCard icon={<Camera className="h-5 w-5" />} title="Galerie" value={`${gallery.length} photo(s) • ${photos360.length} 360°`} action={() => setModal("media")} />
            <QuickCard icon={<Users className="h-5 w-5" />} title="Demandes" value={`${reservations.length} reçue(s)`} action={() => setActiveTab("reservations")} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ce que les familles verront</CardTitle>
              <CardDescription>Aperçu des informations publiques configurées dans Schooly.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <InfoLine icon={<MapPin />} label="Adresse" value={address || "À renseigner"} />
              <InfoLine icon={<Phone />} label="Téléphone" value={phone || "À renseigner"} />
              <InfoLine icon={<Mail />} label="Email" value={email || "À renseigner"} />
              <InfoLine icon={<Globe2 />} label="Site web" value={website || "À renseigner"} />
              <div className="md:col-span-2"><InfoLine icon={<Info />} label="Admission" value={admissionNotes || "À renseigner"} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations">
          <Card>
            <CardHeader><CardTitle>Demandes reçues</CardTitle><CardDescription>Les familles qui viennent de Trouvetou doivent pouvoir être traitées rapidement.</CardDescription></CardHeader>
            <CardContent>
              {reservations.length === 0 ? <EmptyState text="Aucune demande pour le moment." /> : (
                <div className="divide-y divide-border/50">
                  {reservations.map((r) => (
                    <div key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="font-medium">{r.student_full_name}</p><p className="text-xs text-muted-foreground">Parent : {r.parent_full_name} • {r.parent_phone}</p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p></div>
                      <div className="flex items-center gap-2"><Badge variant="outline">{reservationLabel(r.status)}</Badge><Button size="sm" variant="outline" onClick={() => { setSelectedReservation(r); setModal("reservation") }}><Eye className="mr-1 h-4 w-4" /> Détails</Button>{r.status === "reserved" && <Button size="sm" onClick={() => { setSelectedReservation(r); setModal("reservation") }} disabled={loading}>Finaliser</Button>}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Publicités</CardTitle><CardDescription>Promouvoir un événement, une offre ou une période d&apos;inscription.</CardDescription></div><Button onClick={() => setModal("ad")}><Plus className="mr-2 h-4 w-4" /> Créer</Button></CardHeader>
            <CardContent>{ads.length === 0 ? <EmptyState text="Aucune publicité." /> : <div className="divide-y divide-border/50">{ads.map((ad)=><div key={ad.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{ad.title}</p><p className="text-xs text-muted-foreground">{ad.message}</p><p className="text-xs text-muted-foreground">{ad.start_date} → {ad.end_date}</p></div><Badge variant={ad.is_active ? "default" : "secondary"}>{ad.is_active ? "Active" : "Inactive"}</Badge></div>)}</div>}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={modal === "profile"} onOpenChange={(open) => setModal(open ? "profile" : null)} label="Modifier le profil public">
        <DialogContent>
          <DialogHeader><DialogTitle>Profil public Trouvetou</DialogTitle><DialogDescription>Les champs sont regroupés par usage pour éviter un formulaire lourd.</DialogDescription></DialogHeader>
          <div className="space-y-5 py-4">
            <Field label="Description" hint="Présente l'établissement en quelques phrases."><Textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="Ex. établissement familial..." /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Adresse publique"><Input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Quartier, rue..." /></Field><Field label="Téléphone"><Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+225..." /></Field><Field label="Email"><Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@..." /></Field><Field label="Site web"><Input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://..." /></Field></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Latitude"><Input value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder="5.36..." /></Field><Field label="Longitude"><Input value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder="-4.00..." /></Field></div>
            <Field label="Itinéraire" hint="Aide la famille à trouver l'entrée."><Textarea value={itineraire} onChange={e=>setItineraire(e.target.value)} rows={2} /></Field>
            <Field label="Vidéo de présentation"><Input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." /></Field>
            <Field label="Points forts" hint="Sépare les éléments par des virgules."><Input value={highlights.join(", ")} onChange={e=>setHighlights(e.target.value.split(",").map(x=>x.trim()).filter(Boolean))} placeholder="Cantine, transport, sport..." /></Field>
            <Field label="Informations admission"><Textarea value={admissionNotes} onChange={e=>setAdmissionNotes(e.target.value)} rows={3} placeholder="Périodes, pièces, conditions..." /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setModal(null)}>Annuler</Button><Button onClick={saveProfile} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button></DialogFooter>
          <DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "media"} onOpenChange={(open) => setModal(open ? "media" : null)} label="Gérer les photos">
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Médias de l&apos;établissement</DialogTitle><DialogDescription>Ajoute directement les photos depuis ton téléphone ou ton ordinateur. Les images sont stockées dans Supabase Storage.</DialogDescription></DialogHeader>
          <div className="space-y-6 py-4">
            <MediaSection title="Photo principale" description="La photo de couverture de l'établissement." files={coverPhoto ? [coverPhoto] : []} multiple={false} onUpload={e=>handleMediaUpload(e,"cover")} onRemove={()=>setCoverPhoto("")} />
            <MediaSection title="Galerie photos" description="Photos des salles, cour, activités, équipements..." files={gallery} multiple onUpload={e=>handleMediaUpload(e,"gallery")} onRemove={i=>{ if(i!==undefined) removeItem(setGallery,i) }} />
            <MediaSection title="Photos 360°" description="Pour une visite immersive quand les fichiers 360° sont disponibles." files={photos360} multiple onUpload={e=>handleMediaUpload(e,"360")} onRemove={i=>{ if(i!==undefined) removeItem(setPhotos360,i) }} />
          </div>
          <DialogFooter><Button onClick={saveProfile} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer les médias</Button></DialogFooter>
          <DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "publication"} onOpenChange={(open) => setModal(open ? "publication" : null)} label="Gérer la publication">
        <DialogContent>
          <DialogHeader><DialogTitle>{published ? "Publication Trouvetou" : "Préparer la publication"}</DialogTitle><DialogDescription>{published ? "Ton établissement est actuellement visible." : "Schooly vérifie les informations renseignées avant publication."}</DialogDescription></DialogHeader>
          <div className="space-y-3 py-4">
            <div className="rounded-xl bg-muted/60 p-4"><p className="font-medium">Qualité du profil : {completion.percent}%</p><p className="mt-1 text-sm text-muted-foreground">{completion.done}/{completion.total} éléments recommandés.</p></div>
            {!published && completion.percent < 75 && <p className="text-sm text-amber-700"><Info className="mr-1 inline h-4 w-4" />Tu peux publier, mais il est recommandé de compléter les éléments manquants.</p>}
            {published && <p className="text-sm text-muted-foreground">La désactivation retire l&apos;établissement du catalogue Trouvetou sans supprimer ses données.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setModal(null)}>Annuler</Button><Button variant={published ? "destructive" : "default"} onClick={togglePublish} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{published ? <><PowerOff className="mr-2 h-4 w-4" />Dépublier</> : <><Power className="mr-2 h-4 w-4" />Publier</>}</Button></DialogFooter>
          <DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "reservation"} onOpenChange={(open)=>setModal(open ? "reservation" : null)} label="Détails de la demande">
        <DialogContent>
          <DialogHeader><DialogTitle>Demande de pré-inscription</DialogTitle><DialogDescription>Informations reçues depuis Trouvetou.</DialogDescription></DialogHeader>
          {selectedReservation && <div className="space-y-4 py-4">
            <div className="rounded-xl bg-muted/60 p-3 text-sm"><Sparkles className="mr-1 inline h-4 w-4" />Qualification intelligente : complète les informations critiques avant de finaliser l&apos;inscription.</div>
            <Field label="Nom complet de l'élève"><Input value={selectedReservation.student_full_name || ""} onChange={e=>setSelectedReservation((v)=>(v?{...v,student_full_name:e.target.value}:v))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date de naissance"><Input type="date" value={selectedReservation.student_birthdate || ""} onChange={e=>setSelectedReservation((v)=>(v?{...v,student_birthdate:e.target.value}:v))} /></Field>
              <Field label="Téléphone parent"><Input value={selectedReservation.parent_phone || ""} onChange={e=>setSelectedReservation((v)=>(v?{...v,parent_phone:e.target.value}:v))} /></Field>
            </div>
            <Field label="Nom complet du parent"><Input value={selectedReservation.parent_full_name || ""} onChange={e=>setSelectedReservation((v)=>(v?{...v,parent_full_name:e.target.value}:v))} /></Field>
            <Field label="Email parent"><Input type="email" value={selectedReservation.parent_email || ""} onChange={e=>setSelectedReservation((v)=>(v?{...v,parent_email:e.target.value}:v))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><InfoLine icon={<CheckCircle2 />} label="Statut" value={reservationLabel(selectedReservation.status)} /><InfoLine icon={<Info />} label="Reçue le" value={selectedReservation.created_at ? new Date(selectedReservation.created_at).toLocaleString("fr-FR") : "—"} /></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={()=>setModal(null)}>Fermer</Button>{selectedReservation && ["pending_payment","reserved"].includes(selectedReservation.status) && <><Button onClick={updateReservation} disabled={qualificationLoading}>{qualificationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer la qualification</Button><Button onClick={async()=>{ if(!selectedReservation) return; setQualificationLoading(true); try { const res=await fetch("/api/v1/admin/trouvetou/reservations/finalize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reservation_id:selectedReservation.id})}); const data=await res.json(); if(!res.ok) throw new Error(data.error||"Finalisation impossible"); toast.success("Inscription finalisée"); setModal(null); router.refresh() } catch(error){ toast.error(errorMessage(error,"Finalisation impossible")) } finally { setQualificationLoading(false) } }} disabled={qualificationLoading || selectedReservation?.status !== "reserved"}>{qualificationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Finaliser l&apos;inscription</Button></>}</DialogFooter><DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "ad"} onOpenChange={(open)=>setModal(open ? "ad" : null)} label="Créer une publicité">
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle publicité</DialogTitle><DialogDescription>Crée une campagne courte sans quitter la page Trouvetou.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-4"><Field label="Titre"><Input value={adTitle} onChange={e=>setAdTitle(e.target.value)} /></Field><Field label="Message"><Textarea value={adMessage} onChange={e=>setAdMessage(e.target.value)} /></Field><Field label="Image (URL facultative)"><Input value={adImageUrl} onChange={e=>setAdImageUrl(e.target.value)} /></Field><Field label="Lien (facultatif)"><Input value={adTargetUrl} onChange={e=>setAdTargetUrl(e.target.value)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Début"><Input type="date" value={adStartDate} onChange={e=>setAdStartDate(e.target.value)} /></Field><Field label="Fin"><Input type="date" value={adEndDate} onChange={e=>setAdEndDate(e.target.value)} /></Field></div></div>
          <DialogFooter><Button variant="outline" onClick={()=>setModal(null)}>Annuler</Button><Button onClick={createAd} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</Button></DialogFooter><DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AlertIcon(){ return <Info className="h-4 w-4 text-amber-600" /> }
function QuickCard({icon,title,value,action}:{icon:React.ReactNode,title:string,value:string,action:()=>void}){return <Card className="cursor-pointer transition hover:-translate-y-0.5" onClick={action}><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-muted p-2.5">{icon}</div><div className="min-w-0"><p className="text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground">{value}</p></div></CardContent></Card>}
function InfoLine({icon,label,value}:{icon:React.ReactNode,label:string,value:string}){return <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/25 p-3"><div className="mt-0.5 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm font-medium">{value}</p></div></div>}
function Field({label,hint,children}:{label:string,hint?:string,children:React.ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint&&<p className="text-xs text-muted-foreground">{hint}</p>}</div>}
function EmptyState({text}:{text:string}){return <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>}
function MediaSection({title,description,files,multiple,onUpload,onRemove}:{title:string,description:string,files:string[],multiple:boolean,onUpload:(e:React.ChangeEvent<HTMLInputElement>)=>void,onRemove:(index?:number)=>void}){return <div><div className="mb-2 flex items-start justify-between gap-3"><div><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{description}</p></div><label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"><Upload className="mr-2 h-4 w-4" />Ajouter<input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} className="sr-only" onChange={onUpload} /></label></div>{files.length===0?<div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">Aucune image</div>:<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map((url,i)=><div key={url+i} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"><Image src={url} alt={`${title} — image ${i + 1}`} fill sizes="(min-width: 640px) 25vw, 50vw" unoptimized className="object-cover" /><button type="button" onClick={()=>onRemove(i)} className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-2 text-white opacity-100 transition hover:bg-black/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" aria-label={`Supprimer ${title} ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}</div>}
