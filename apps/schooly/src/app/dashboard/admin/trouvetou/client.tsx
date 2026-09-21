"use client"

import { useMemo, useState, useCallback } from "react"
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

interface TrouvetouAdminClientProps {
  schoolId: string
  school: any
  reservations: any[]
  ads: any[]
  levels: any[]
  roleCode: string
}

type Modal = "profile" | "media" | "publication" | "reservation" | "ad" | null

const asStrings = (value: unknown): string[] => Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []

export function TrouvetouAdminClient({
  schoolId: _schoolId,
  school,
  reservations: initialReservations,
  ads: initialAds,
}: TrouvetouAdminClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [selectedReservation, setSelectedReservation] = useState<any>(null)
  const [qualificationLoading, setQualificationLoading] = useState(false)

  const [published, setPublished] = useState(Boolean(school?.published_to_trouvetou))
  const [description, setDescription] = useState(school?.description_publique || "")
  const [latitude, setLatitude] = useState(school?.latitude?.toString() || "")
  const [longitude, setLongitude] = useState(school?.longitude?.toString() || "")
  const [itineraire, setItineraire] = useState(school?.itineraire || "")
  const [videoUrl, setVideoUrl] = useState(school?.video_url || "")
  const [coverPhoto, setCoverPhoto] = useState(school?.cover_photo_url || "")
  const [gallery, setGallery] = useState<string[]>(asStrings(school?.gallery_photos))
  const [photos360, setPhotos360] = useState<string[]>(asStrings(school?.photos_360))
  const [address, setAddress] = useState(school?.public_address || "")
  const [phone, setPhone] = useState(school?.public_phone || "")
  const [email, setEmail] = useState(school?.public_email || "")
  const [website, setWebsite] = useState(school?.public_website_url || "")
  const [highlights, setHighlights] = useState<string[]>(asStrings(school?.public_highlights))
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
    const checks = [
      [Boolean(coverPhoto), "Photo principale"],
      [Boolean(description.trim()), "Description"],
      [Boolean(address.trim() || (latitude && longitude)), "Localisation"],
      [Boolean(phone.trim() || email.trim()), "Contact"],
      [gallery.length > 0, "Galerie photo"],
      [Boolean(videoUrl.trim()), "Vidéo"],
      [highlights.length > 0, "Services / points forts"],
      [Boolean(admissionNotes.trim()), "Informations admission"],
    ] as const
    const done = checks.filter(([ok]) => ok).length
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100), checks }
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
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la sauvegarde")
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
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'upload")
    } finally {
      setLoading(false)
      event.target.value = ""
    }
  }, [uploadMedia])

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
    } catch (error: any) {
      toast.error(error.message || "Erreur de publication")
    } finally {
      setLoading(false)
    }
  }, [published, hasPublicationPhoto, router])

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
    } catch (error: any) {
      toast.error(error.message || "Erreur")
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
    } catch (error: any) {
      toast.error(error.message || "Erreur de qualification")
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
            <Badge variant={published ? "default" : "secondary"}>
              {published ? "Fiche publiée" : "Fiche non publiée"}
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
        <KpiCard icon={<Megaphone className="h-5 w-5" />} label="Publicités actives" value={String(ads.filter((ad: any) => ad.is_active).length)} hint="Campagnes temporaires" />
      </div>

      {!hasPublicationPhoto && (
        <Card className="border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Publication impossible pour le moment</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajoute au moins 1 photo de l'établissement ou renseigne le lien d'une photo pour pouvoir publier la fiche sur Trouvetou.
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
                <img src={coverPhoto} alt="Photo principale de l'établissement" className="h-full min-h-[240px] w-full object-cover" />
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
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demandes récentes</CardTitle>
            <CardDescription>{reservations.length} demande(s) reçue(s) depuis Trouvetou.</CardDescription>
          </CardHeader>
          <CardContent>
            {reservations.length === 0 ? (
              <EmptyState text="Aucune demande pour le moment." />
            ) : (
              <div className="divide-y divide-border/50">
                {reservations.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.student_full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.parent_full_name} • {r.parent_phone}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedReservation(r); setModal("reservation") }}>
                      <Eye className="mr-1 h-4 w-4" /> Détails
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Publicités</CardTitle>
              <CardDescription>Contenu promotionnel temporaire.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setModal("ad")}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </CardHeader>
          <CardContent>
            {ads.length === 0 ? (
              <EmptyState text="Aucune publicité." />
            ) : (
              <div className="divide-y divide-border/50">
                {ads.slice(0, 5).map((ad: any) => (
                  <div key={ad.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ad.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{ad.message}</p>
                    </div>
                    <Badge variant={ad.is_active ? "default" : "secondary"}>
                      {ad.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
          <DialogHeader><DialogTitle>Médias de l'établissement</DialogTitle><DialogDescription>Ajoute directement les photos depuis ton téléphone ou ton ordinateur. Les images sont stockées dans Supabase Storage.</DialogDescription></DialogHeader>
          <div className="space-y-6 py-4">
            <MediaSection title="Photo principale" description="La photo de couverture de l'établissement." files={coverPhoto ? [coverPhoto] : []} multiple={false} onUpload={e=>handleMediaUpload(e,"cover")} onRemove={()=>setCoverPhoto("")} />
            <MediaSection title="Galerie photos" description="Photos des salles, cour, activités, équipements..." files={gallery} multiple onUpload={e=>handleMediaUpload(e,"gallery")} onRemove={i=>{ if(i!==undefined) removeItem(setGallery,i) }} />
            <MediaSection title="Photos 360°" description="Pour une visite immersive quand les fichiers 360° sont disponibles." files={photos360} multiple onUpload={e=>handleMediaUpload(e,"360")} onRemove={i=>{ if(i!==undefined) removeItem(setPhotos360,i) }} />
          </div>
          <DialogFooter><Button onClick={saveProfile} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer les médias</Button></DialogFooter>
          <DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "publication"} onOpenChange={(open) => setModal(open ? "publication" : null)} label="Gérer ma fiche Trouvetou">
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{published ? "Mon annonce Trouvetou" : "Publier ma fiche Trouvetou"}</DialogTitle>
            <DialogDescription>
              Renseigne uniquement les informations que tu veux montrer aux familles. Les informations techniques sont gérées automatiquement par Schooly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm font-medium">{school?.name || "Mon établissement"}</p>
              <p className="text-xs text-muted-foreground">{school?.city || "Ville non renseignée"}</p>
            </div>

            <Field label="Présentation" hint="Quelques phrases pour présenter simplement l'établissement.">
              <Textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="Présente ton établissement aux familles..." />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Site web" hint="Facultatif — si l'école possède un site.">
                <Input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://www.ecole.ci" />
              </Field>
              <Field label="Vidéo YouTube" hint="Facultatif — lien vers une vidéo de présentation.">
                <Input type="url" value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Adresse publique" hint="Facultatif">
                <Input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Quartier, rue..." />
              </Field>
              <Field label="Téléphone" hint="Facultatif">
                <Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+225..." />
              </Field>
            </div>

            <Field label="Email" hint="Facultatif">
              <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@ecole.ci" />
            </Field>

            {!published && (
              <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                <Info className="mr-1 inline h-3.5 w-3.5" />
                Tu peux publier même si certains champs facultatifs ne sont pas renseignés.
              </p>
            )}
            {published && (
              <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Ta fiche établissement est actuellement publiée sur Trouvetou.
              </p>
            )}
            {!published && !hasPublicationPhoto && (
              <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-sm dark:bg-amber-950/20">
                <p className="font-medium text-amber-900 dark:text-amber-200">⚠️ Publication bloquée</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Il faut au moins 1 photo. Tu peux téléverser une photo ou coller son lien ci-dessous.
                </p>
                <div className="mt-3">
                  <Field label="Lien de la photo">
                    <Input value={coverPhoto} onChange={e=>setCoverPhoto(e.target.value)} placeholder="https://..." />
                  </Field>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setModal("media") }}>
                  <Camera className="mr-2 h-4 w-4" /> Ajouter une photo
                </Button>
              </div>
            )}
            {!published && hasPublicationPhoto && (
              <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Ta fiche possède au moins une photo et peut être publiée.
              </p>
            )}
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
            <div className="rounded-xl bg-muted/60 p-3 text-sm"><Sparkles className="mr-1 inline h-4 w-4" />Qualification intelligente : complète les informations critiques avant de finaliser l'inscription.</div>
            <Field label="Nom complet de l'élève"><Input value={selectedReservation.student_full_name || ""} onChange={e=>setSelectedReservation((v:any)=>({...v,student_full_name:e.target.value}))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date de naissance"><Input type="date" value={selectedReservation.student_birthdate || ""} onChange={e=>setSelectedReservation((v:any)=>({...v,student_birthdate:e.target.value}))} /></Field>
              <Field label="Téléphone parent"><Input value={selectedReservation.parent_phone || ""} onChange={e=>setSelectedReservation((v:any)=>({...v,parent_phone:e.target.value}))} /></Field>
            </div>
            <Field label="Nom complet du parent"><Input value={selectedReservation.parent_full_name || ""} onChange={e=>setSelectedReservation((v:any)=>({...v,parent_full_name:e.target.value}))} /></Field>
            <Field label="Email parent"><Input type="email" value={selectedReservation.parent_email || ""} onChange={e=>setSelectedReservation((v:any)=>({...v,parent_email:e.target.value}))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><InfoLine icon={<CheckCircle2 />} label="Statut" value={reservationLabel(selectedReservation.status)} /><InfoLine icon={<Info />} label="Reçue le" value={selectedReservation.created_at ? new Date(selectedReservation.created_at).toLocaleString("fr-FR") : "—"} /></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={()=>setModal(null)}>Fermer</Button>{selectedReservation && ["pending_payment","reserved"].includes(selectedReservation.status) && <><Button onClick={updateReservation} disabled={qualificationLoading}>{qualificationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer la qualification</Button><Button onClick={async()=>{ if(!selectedReservation) return; setQualificationLoading(true); try { const res=await fetch("/api/v1/admin/trouvetou/reservations/finalize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reservation_id:selectedReservation.id})}); const data=await res.json(); if(!res.ok) throw new Error(data.error||"Finalisation impossible"); toast.success("Inscription finalisée"); setModal(null); router.refresh() } catch(error:any){ toast.error(error.message||"Finalisation impossible") } finally { setQualificationLoading(false) } }} disabled={qualificationLoading || selectedReservation?.status !== "reserved"}>{qualificationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Finaliser l'inscription</Button></>}</DialogFooter><DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "ad"} onOpenChange={(open)=>setModal(open ? "ad" : null)} label="Créer une publicité Trouvetou">
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle publicité Trouvetou</DialogTitle><DialogDescription>Cette publicité est distincte de la fiche de ton établissement. Elle peut avoir sa propre période, image et lien.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-4"><Field label="Titre"><Input value={adTitle} onChange={e=>setAdTitle(e.target.value)} /></Field><Field label="Message"><Textarea value={adMessage} onChange={e=>setAdMessage(e.target.value)} /></Field><Field label="Image (URL facultative)"><Input value={adImageUrl} onChange={e=>setAdImageUrl(e.target.value)} /></Field><Field label="Lien (facultatif)"><Input value={adTargetUrl} onChange={e=>setAdTargetUrl(e.target.value)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Début"><Input type="date" value={adStartDate} onChange={e=>setAdStartDate(e.target.value)} /></Field><Field label="Fin"><Input type="date" value={adEndDate} onChange={e=>setAdEndDate(e.target.value)} /></Field></div></div>
          <DialogFooter><Button variant="outline" onClick={()=>setModal(null)}>Annuler</Button><Button onClick={createAd} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</Button></DialogFooter><DialogClose onClick={()=>setModal(null)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AlertIcon(){ return <Info className="h-4 w-4 text-amber-600" /> }
function KpiCard({icon,label,value,hint}:{icon:React.ReactNode,label:string,value:string,hint:string}){return <Card><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div className="rounded-xl bg-muted p-2.5">{icon}</div><span className="text-2xl font-semibold">{value}</span></div><p className="mt-3 text-sm font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{hint}</p></CardContent></Card>}\nfunction QuickCard({icon,title,value,action}:{icon:React.ReactNode,title:string,value:string,action:()=>void}){return <Card className="cursor-pointer transition hover:-translate-y-0.5" onClick={action}><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-muted p-2.5">{icon}</div><div className="min-w-0"><p className="text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground">{value}</p></div></CardContent></Card>}
function InfoLine({icon,label,value}:{icon:React.ReactNode,label:string,value:string}){return <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/25 p-3"><div className="mt-0.5 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm font-medium">{value}</p></div></div>}
function Field({label,hint,children}:{label:string,hint?:string,children:React.ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint&&<p className="text-xs text-muted-foreground">{hint}</p>}</div>}
function EmptyState({text}:{text:string}){return <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>}
function reservationLabel(status:string){return status==="pending_payment"?"Attente paiement":status==="reserved"?"Réservée":status==="confirmed"?"Confirmée":status==="expired"?"Expirée":status}
function MediaSection({title,description,files,multiple,onUpload,onRemove}:{title:string,description:string,files:string[],multiple:boolean,onUpload:(e:React.ChangeEvent<HTMLInputElement>)=>void,onRemove:(index?:number)=>void}){return <div><div className="mb-2 flex items-start justify-between gap-3"><div><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{description}</p></div><label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"><Upload className="mr-2 h-4 w-4" />Ajouter<input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} className="sr-only" onChange={onUpload} /></label></div>{files.length===0?<div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">Aucune image</div>:<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map((url,i)=><div key={url+i} className="group relative overflow-hidden rounded-xl border bg-muted"><img src={url} alt={title} className="aspect-square w-full object-cover" /><button type="button" onClick={()=>onRemove(i)} className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100" aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}</div>}
