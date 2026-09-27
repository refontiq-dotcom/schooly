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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adLabel, errorMessage, profileCompletion, reservationLabel } from "./_lib/helpers"
import type { TrouvetouAd, TrouvetouReservation, TrouvetouSchool } from "./_lib/types"
import { getInclusiveDays, getTrouvetouAdDailyRate } from "@/lib/trouvetou/ad-pricing"

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
  const [modal, setModal] = useState<Modal>(null)
  const [selectedReservation, setSelectedReservation] = useState<TrouvetouReservation | null>(null)
  const [qualificationLoading, setQualificationLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  const [published, setPublished] = useState(Boolean(school?.published_to_trouvetou))
  const [description, setDescription] = useState(school?.description_publique || "")
  const [latitude, setLatitude] = useState(school?.latitude?.toString() || "")
  const [longitude, setLongitude] = useState(school?.longitude?.toString() || "")
  const [itineraire, setItineraire] = useState(school?.itineraire || "")
  const [videoUrl, setVideoUrl] = useState(school?.video_url || "")
  const [coverPhoto, setCoverPhoto] = useState(school?.cover_photo_url || "")
  // Limites médias Trouvetou (migration 20260927005000) : 4 photos classiques
  // au total, la photo principale comprise, et une seule visite 360°.
  const [gallery, setGallery] = useState<string[]>(
    (school?.gallery_photos ?? []).slice(0, school?.cover_photo_url ? 3 : 4)
  )
  const [photos360, setPhotos360] = useState<string[]>((school?.photos_360 ?? []).slice(0, 1))
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
  const [adContactPhone, setAdContactPhone] = useState("")
  const [adCtaLabel, setAdCtaLabel] = useState("En savoir plus")

  const adDurationDays = useMemo(() => getInclusiveDays(adStartDate, adEndDate), [adStartDate, adEndDate])
  const adDailyRate = useMemo(() => getTrouvetouAdDailyRate(adDurationDays), [adDurationDays])
  const adTotalAmount = adDailyRate ? adDailyRate * adDurationDays : 0

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

  const hasPublicationPhoto = useMemo(
    () => Boolean(
      coverPhoto.trim() ||
      gallery.some((url) => typeof url === "string" && url.trim()) ||
      photos360.some((url) => typeof url === "string" && url.trim())
    ),
    [coverPhoto, gallery, photos360]
  )

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

  // Upload en deux temps. La route n'autorise que : elle vérifie le quota, le type
  // et la taille côté serveur, puis renvoie une URL signée. Le navigateur envoie
  // ensuite le fichier directement sur R2 — il ne transite jamais par la fonction
  // Next.js, ce qui permet de dépasser le plafond de 4,5 Mo de Vercel Hobby.
  const uploadMedia = useCallback(async (file: File, kind: "cover" | "gallery" | "360" | "ad") => {
    const res = await fetch("/api/v1/admin/trouvetou/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, contentType: file.type, size: file.size }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Upload impossible")

    // Le Content-Type entre dans la signature : il doit être renvoyé à l'identique.
    const put = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: data.headers,
      body: file,
    })
    if (!put.ok) throw new Error("Envoi vers le stockage impossible.")

    return data.publicUrl as string
  }, [])

  const handleMediaUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, kind: "cover" | "gallery" | "360") => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setLoading(true)
    try {
      if (kind === "cover") {
        setCoverPhoto(await uploadMedia(files[0], "cover"))
      } else if (kind === "gallery") {
        const remaining = Math.max(0, 4 - (coverPhoto.trim() ? 1 : 0) - gallery.length)
        if (remaining <= 0) throw new Error("Maximum 4 photos classiques, photo principale comprise.")
        const urls = await Promise.all(files.slice(0, remaining).map(file => uploadMedia(file, kind)))
        setGallery(prev => [...prev, ...urls].slice(0, coverPhoto.trim() ? 3 : 4))
      } else {
        if (photos360.length >= 1) throw new Error("Une seule visite 360° est autorisée par établissement.")
        const urls = await Promise.all(files.slice(0, 1).map(file => uploadMedia(file, kind)))
        setPhotos360(urls.slice(0, 1))
      }
      toast.success("Image ajoutée")
    } catch (error) {
      toast.error(errorMessage(error, "Erreur lors de l'upload"))
    } finally {
      setLoading(false)
      event.target.value = ""
    }
  }, [uploadMedia, coverPhoto, gallery, photos360])

  const togglePublish = useCallback(async () => {
    if (!published && !hasPublicationPhoto) {
      setModal("publication")
      toast.error("Ajoute au moins une photo avant de publier la fiche.")
      return
    }
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
  }, [published, hasPublicationPhoto, router])

  const createAd = useCallback(async () => {
    if (!adTitle.trim() || !adMessage.trim() || !adImageUrl.trim() || !adStartDate || !adEndDate) {
      toast.error("Complète l'affiche, le titre, le message et la période")
      return
    }
    if (!adDailyRate || adDurationDays < 1) {
      toast.error("La période de diffusion est invalide")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: adTitle, message: adMessage, image_url: adImageUrl, target_url: adTargetUrl,
          contact_phone: adContactPhone, cta_label: adCtaLabel, start_date: adStartDate, end_date: adEndDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Échec")
      setAds(prev => [{ ...data.ad, title: adTitle, message: adMessage, image_url: adImageUrl, target_url: adTargetUrl, start_date: adStartDate, end_date: adEndDate, is_active: false }, ...prev])
      setAdTitle(""); setAdMessage(""); setAdImageUrl(""); setAdTargetUrl(""); setAdStartDate(""); setAdEndDate(""); setAdContactPhone(""); setAdCtaLabel("En savoir plus")
      setModal(null)
      toast.success("Demande de paiement envoyée au Control Center : " + Number(data.ad.total_amount).toLocaleString("fr-FR") + " FCFA.")
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error, "Erreur"))
    } finally {
      setLoading(false)
    }
  }, [adTitle, adMessage, adImageUrl, adTargetUrl, adStartDate, adEndDate, adContactPhone, adCtaLabel, adDailyRate, adDurationDays, router])

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

  /**
   * Suppression réelle : l'API efface l'objet dans R2 puis sa référence en
   * base. Ne retirer l'URL que de l'état React laisserait le fichier dans le
   * bucket pour toujours — un stockage ne se libère pas tout seul, et la
   * référence disparue rendrait l'objet introuvable pour le dépanner.
   */
  const removeMedia = useCallback(async (url: string, apply: () => void) => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Suppression impossible")
      apply()
      toast.success("Média supprimé")
    } catch (error) {
      toast.error(errorMessage(error, "Suppression impossible"))
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={published ? "default" : "secondary"}>
              {published ? "Publié" : "Brouillon"}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{school?.name || "Trouvetou"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Une seule fiche établissement, automatiquement liée à ton établissement Schooly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModal("profile")}>
            <Pencil className="mr-2 h-4 w-4" /> Modifier ma fiche
          </Button>
          <Button onClick={() => setModal("ad")}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une publicité
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard icon={<Eye className="h-5 w-5" />} label="Visites de la fiche" value="—" hint="Suivi des visites à connecter" />
        <KpiCard icon={<Users className="h-5 w-5" />} label="Demandes reçues" value={String(reservations.length)} hint="Depuis Trouvetou" />
        <KpiCard icon={<Megaphone className="h-5 w-5" />} label="Publicités actives" value={String(ads.filter((ad) => ad.payment_status === "active" && ad.is_active).length)} hint="Campagnes temporaires" />
      </div>

      {!hasPublicationPhoto && (
        <Card className="border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Publication impossible pour le moment</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajoute au moins 1 photo de l&apos;établissement ou renseigne le lien d&apos;une photo pour pouvoir publier la fiche sur Trouvetou.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setModal("media")} className="shrink-0">
              <Camera className="mr-2 h-4 w-4" /> Ajouter une photo
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative min-h-[240px] overflow-hidden bg-muted">
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
                <button
                  type="button"
                  onClick={() => setModal("media")}
                  className="flex h-full min-h-[240px] w-full flex-col items-center justify-center text-muted-foreground hover:bg-muted/80"
                >
                  <Camera className="mb-3 h-10 w-10" />
                  <p className="font-medium">Ajouter une photo</p>
                  <p className="mt-1 text-xs">La fiche ne peut pas être publiée sans photo.</p>
                </button>
              )}
            </div>
            <div className="space-y-4 p-5">
              <div>
                <Badge variant={published ? "default" : "secondary"}>
                  {published ? "Visible sur Trouvetou" : "Non publiée"}
                </Badge>
                <h2 className="mt-3 text-xl font-semibold">{school?.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {school?.city || address || "Ville à renseigner"}
                </p>
              </div>

              <div className="grid gap-2 text-sm">
                <InfoLine icon={<MapPin />} label="Adresse" value={address || "À renseigner"} />
                <InfoLine icon={<Phone />} label="Téléphone" value={phone || "À renseigner"} />
                <InfoLine icon={<Globe2 />} label="Site web" value={website || "À renseigner"} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setModal("profile")}>
                  <Pencil className="mr-2 h-4 w-4" /> Modifier ma fiche
                </Button>
                {!published && (
                  <Button onClick={() => setModal("publication")}>
                    <Megaphone className="mr-2 h-4 w-4" /> Publier sur Trouvetou
                  </Button>
                )}
                {published && (
                  <Button variant="outline" onClick={() => setModal("publication")}>
                    <Power className="mr-2 h-4 w-4" /> Gérer la publication
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Qualité du profil</p><p className="text-xs text-muted-foreground">{completion.done}/{completion.total} éléments renseignés</p></div>
                <span className="text-lg font-semibold">{completion.percent}%</span>
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
            <CardContent>{ads.length === 0 ? <EmptyState text="Aucune publicité." /> : <div className="divide-y divide-border/50">{ads.map((ad)=><div key={ad.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-medium">{ad.title}</p><p className="truncate text-xs text-muted-foreground">{ad.message}</p><p className="text-xs text-muted-foreground">{ad.start_date} → {ad.end_date} • {ad.duration_days ?? "—"} jour(s) • {typeof ad.total_amount === "number" ? `${ad.total_amount.toLocaleString("fr-FR")} FCFA` : "—"}</p></div><Badge variant={ad.is_active ? "default" : "secondary"}>{adLabel(ad.payment_status, ad.is_active)}</Badge></div>)}</div>}</CardContent>
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
          <DialogHeader><DialogTitle>Médias de l&apos;établissement</DialogTitle><DialogDescription>Ajoute directement les photos depuis ton téléphone ou ton ordinateur. Les images sont stockées dans Cloudflare R2.</DialogDescription></DialogHeader>
          <div className="space-y-6 py-4">
            <MediaSection title="Photo principale" description="La photo de couverture de l'établissement." files={coverPhoto ? [coverPhoto] : []} multiple={false} onUpload={e=>handleMediaUpload(e,"cover")} onRemove={()=>{ if (coverPhoto) removeMedia(coverPhoto, () => setCoverPhoto("")) }} />
            <MediaSection title="Galerie photos" description={`4 photos classiques maximum, photo principale comprise. ${gallery.length + (coverPhoto ? 1 : 0)}/4`} files={gallery} multiple={gallery.length + (coverPhoto ? 1 : 0) < 4} onUpload={e=>handleMediaUpload(e,"gallery")} onRemove={i=>{ const url = i !== undefined ? gallery[i] : undefined; if (url) removeMedia(url, () => removeItem(setGallery, i as number)) }} />
            <MediaSection title="Visite 360°" description="Une seule visite 360° de l'établissement : entrée et cour, sans entrer dans les salles de classe." files={photos360} multiple={false} onUpload={e=>handleMediaUpload(e,"360")} onRemove={i=>{ const url = i !== undefined ? photos360[i] : undefined; if (url) removeMedia(url, () => removeItem(setPhotos360, i as number)) }} />
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
            {!published && !hasPublicationPhoto && <p className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><Info className="mr-1 inline h-4 w-4" /> Publication bloquée : il faut au moins une photo. Ajoute-la via « Gérer les photos ».</p>}
            {!published && hasPublicationPhoto && <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Ta fiche possède au moins une photo et peut être publiée.</p>}
            {!published && completion.percent < 75 && <p className="text-sm text-amber-700"><Info className="mr-1 inline h-4 w-4" />Tu peux publier, mais il est recommandé de compléter les éléments manquants.</p>}
            {published && <p className="text-sm text-muted-foreground">La désactivation retire l&apos;établissement du catalogue Trouvetou sans supprimer ses données.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setModal(null)}>Annuler</Button>
            <Button variant={published ? "destructive" : "default"} onClick={async()=>{
              if (published) {
                await togglePublish()
                return
              }
              setLoading(true)
              try {
                const profileRes = await fetch("/api/v1/admin/trouvetou/profile", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    description_publique: description,
                    public_address: address,
                    public_phone: phone,
                    public_email: email,
                    public_website_url: website,
                    video_url: videoUrl,
                    cover_photo_url: coverPhoto,
                    gallery_photos: gallery,
                    photos_360: photos360,
                  }),
                })
                const profileData = await profileRes.json()
                if (!profileRes.ok) throw new Error(profileData.error || "Impossible d'enregistrer l'annonce")

                const publishRes = await fetch("/api/v1/admin/trouvetou/publish", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ published: true }),
                })
                const publishData = await publishRes.json()
                if (!publishRes.ok) throw new Error(publishData.error || "Impossible de publier l'annonce")

                setPublished(true)
                setModal(null)
                toast.success("Fiche établissement publiée sur Trouvetou")
                router.refresh()
              } catch (error: any) {
                toast.error(error.message || "Erreur lors de la publication")
              } finally {
                setLoading(false)
              }
            }} disabled={loading || (!published && !hasPublicationPhoto)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {published ? <><PowerOff className="mr-2 h-4 w-4" />Dépublier</> : <><Megaphone className="mr-2 h-4 w-4" />Publier sur Trouvetou</>}
            </Button>
          </DialogFooter>
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

      <Dialog open={modal === "ad"} onOpenChange={(open)=>setModal(open ? "ad" : null)} label="Créer une publicité Trouvetou">
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle publicité Trouvetou</DialogTitle><DialogDescription>Cette publicité est distincte de la fiche de ton établissement. Elle a sa propre période, son affiche et son paiement Wave Business vérifié par Refontiq Control Center.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-4">
            <div className="rounded-xl border border-dashed p-4">
              <Field label="Affiche publicitaire" hint="JPG, PNG ou WebP • 8 Mo maximum">
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setLoading(true)
                  try {
                    const url = await uploadMedia(file, "ad")
                    setAdImageUrl(url)
                    toast.success("Affiche ajoutée")
                  } catch (error: any) {
                    toast.error(error.message || "Upload impossible")
                  } finally {
                    setLoading(false)
                    e.target.value = ""
                  }
                }} />
              </Field>
              {adImageUrl && <Image src={adImageUrl} alt="Aperçu de l'affiche" width={440} height={220} unoptimized className="mt-3 max-h-44 w-full rounded-lg object-cover" />}
            </div>
            <Field label="Titre"><Input value={adTitle} onChange={e=>setAdTitle(e.target.value)} placeholder="Ex. Journée portes ouvertes" /></Field><Field label="Message"><Textarea value={adMessage} onChange={e=>setAdMessage(e.target.value)} /></Field><Field label="Lien de l’affiche (facultatif)"><Input value={adImageUrl} onChange={e=>setAdImageUrl(e.target.value)} placeholder="https://..." /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Lien de destination"><Input value={adTargetUrl} onChange={e=>setAdTargetUrl(e.target.value)} placeholder="https://..." /></Field><Field label="Téléphone / WhatsApp"><Input value={adContactPhone} onChange={e=>setAdContactPhone(e.target.value)} placeholder="+225..." /></Field></div><Field label="Bouton d’action"><Input value={adCtaLabel} onChange={e=>setAdCtaLabel(e.target.value)} placeholder="En savoir plus" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Début"><Input type="date" value={adStartDate} onChange={e=>setAdStartDate(e.target.value)} /></Field><Field label="Fin"><Input type="date" value={adEndDate} onChange={e=>setAdEndDate(e.target.value)} /></Field></div>{adDurationDays > 0 && adDailyRate ? <div className="rounded-xl border bg-muted/40 p-4"><div className="flex items-center justify-between text-sm"><span>Durée</span><strong>{adDurationDays} jour(s)</strong></div><div className="mt-2 flex items-center justify-between text-sm"><span>Tarif journalier</span><strong>{adDailyRate.toLocaleString("fr-FR")} FCFA / jour</strong></div><div className="mt-3 flex items-center justify-between border-t pt-3"><span className="font-medium">Total à payer</span><strong className="text-lg">{adTotalAmount.toLocaleString("fr-FR")} FCFA</strong></div><p className="mt-2 text-xs text-muted-foreground">Paiement : Wave Business. Le Control Center reçoit la demande et confirme manuellement le paiement avant activation.</p></div> : <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">Choisis une période valide pour calculer automatiquement le prix.</p>}</div>
          <DialogFooter><Button variant="outline" onClick={()=>setModal(null)}>Annuler</Button><Button onClick={createAd} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</Button></DialogFooter><DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AlertIcon(){ return <Info className="h-4 w-4 text-amber-600" /> }
function KpiCard({icon,label,value,hint}:{icon:React.ReactNode,label:string,value:string,hint:string}){return <Card><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div className="rounded-xl bg-muted p-2.5">{icon}</div><span className="text-2xl font-semibold">{value}</span></div><p className="mt-3 text-sm font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{hint}</p></CardContent></Card>}
function QuickCard({icon,title,value,action}:{icon:React.ReactNode,title:string,value:string,action:()=>void}){return <Card className="cursor-pointer transition hover:-translate-y-0.5" onClick={action}><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-muted p-2.5">{icon}</div><div className="min-w-0"><p className="text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground">{value}</p></div></CardContent></Card>}
function InfoLine({icon,label,value}:{icon:React.ReactNode,label:string,value:string}){return <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/25 p-3"><div className="mt-0.5 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm font-medium">{value}</p></div></div>}
function Field({label,hint,children}:{label:string,hint?:string,children:React.ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint&&<p className="text-xs text-muted-foreground">{hint}</p>}</div>}
function EmptyState({text}:{text:string}){return <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>}
function MediaSection({title,description,files,multiple,onUpload,onRemove}:{title:string,description:string,files:string[],multiple:boolean,onUpload:(e:React.ChangeEvent<HTMLInputElement>)=>void,onRemove:(index?:number)=>void}){return <div><div className="mb-2 flex items-start justify-between gap-3"><div><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{description}</p></div><label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"><Upload className="mr-2 h-4 w-4" />Ajouter<input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} className="sr-only" onChange={onUpload} /></label></div>{files.length===0?<div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">Aucune image</div>:<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map((url,i)=><div key={url+i} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"><Image src={url} alt={`${title} — image ${i + 1}`} fill sizes="(min-width: 640px) 25vw, 50vw" unoptimized className="object-cover" /><button type="button" onClick={()=>onRemove(i)} className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-2 text-white opacity-100 transition hover:bg-black/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" aria-label={`Supprimer ${title} ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}</div>}
