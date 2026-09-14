"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Megaphone,
  Power,
  PowerOff,
  Plus,
  RefreshCw,
  MapPin,
  Image as ImageIcon,
  Video,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TrouvetouAdminClientProps {
  schoolId: string
  school: any
  reservations: any[]
  ads: any[]
  levels: any[]
  roleCode: string
}

export function TrouvetouAdminClient({
  schoolId: _schoolId,
  school,
  reservations: initialReservations,
  ads: initialAds,
  levels,
  roleCode: _roleCode,
}: TrouvetouAdminClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("publication")

  // Etat publication
  const [published, setPublished] = useState(school?.published_to_trouvetou || false)
  const [description, setDescription] = useState(school?.description_publique || "")
  const [latitude, setLatitude] = useState(school?.latitude?.toString() || "")
  const [longitude, setLongitude] = useState(school?.longitude?.toString() || "")
  const [itineraire, setItineraire] = useState(school?.itineraire || "")
  const [videoUrl, setVideoUrl] = useState(school?.video_url || "")
  const [photos360, setPhotos360] = useState<string[]>(school?.photos_360 || [])
  const [newPhotoUrl, setNewPhotoUrl] = useState("")

  // Etat publicites
  const [ads, setAds] = useState(initialAds)
  const [showAdForm, setShowAdForm] = useState(false)
  const [adTitle, setAdTitle] = useState("")
  const [adMessage, setAdMessage] = useState("")
  const [adImageUrl, setAdImageUrl] = useState("")
  const [adTargetUrl, setAdTargetUrl] = useState("")
  const [adStartDate, setAdStartDate] = useState("")
  const [adEndDate, setAdEndDate] = useState("")

  // Etat reservations
  const [reservations] = useState(initialReservations)

  const handlePublishToggle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      })
      if (!res.ok) throw new Error("Echec")
      setPublished(!published)
      toast.success(!published ? "Etablissement publie sur Trouvetou" : "Publication desactivee")
      router.refresh()
    } catch {
      toast.error("Erreur lors de la mise a jour")
    } finally {
      setLoading(false)
    }
  }, [published, router])

  const handleSaveProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description_publique: description,
          latitude: parseFloat(latitude) || null,
          longitude: parseFloat(longitude) || null,
          itineraire,
          video_url: videoUrl,
          photos_360: photos360,
        }),
      })
      if (!res.ok) throw new Error("Echec")
      toast.success("Profil mis a jour")
      router.refresh()
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setLoading(false)
    }
  }, [description, latitude, longitude, itineraire, videoUrl, photos360, router])

  const handleAddPhoto = useCallback(() => {
    if (!newPhotoUrl.trim()) return
    setPhotos360((prev) => [...prev, newPhotoUrl.trim()])
    setNewPhotoUrl("")
  }, [newPhotoUrl])

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos360((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleCreateAd = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: adTitle,
          message: adMessage,
          image_url: adImageUrl,
          target_url: adTargetUrl,
          start_date: adStartDate,
          end_date: adEndDate,
        }),
      })
      if (!res.ok) throw new Error("Echec")
      toast.success("Publicite creee")
      setShowAdForm(false)
      setAdTitle("")
      setAdMessage("")
      setAdImageUrl("")
      setAdTargetUrl("")
      setAdStartDate("")
      setAdEndDate("")
      router.refresh()
    } catch {
      toast.error("Erreur lors de la creation")
    } finally {
      setLoading(false)
    }
  }, [adTitle, adMessage, adImageUrl, adTargetUrl, adStartDate, adEndDate, router])

  const handleFinalizeReservation = useCallback(async (reservationId: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/admin/trouvetou/reservations/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId }),
      })
      if (!res.ok) throw new Error("Echec")
      toast.success("Reservation finalisee")
      router.refresh()
    } catch {
      toast.error("Erreur lors de la finalisation")
    } finally {
      setLoading(false)
    }
  }, [router])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Trouvetou</h1>
        <p className="text-sm text-slate-500 mt-1">
          Publication de votre etablissement sur la plateforme Trouvetou
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="publication">
            <Megaphone className="w-4 h-4 mr-2" /> Publication
          </TabsTrigger>
          <TabsTrigger value="reservations">
            <Users className="w-4 h-4 mr-2" /> Reservations
          </TabsTrigger>
          <TabsTrigger value="ads">
            <ImageIcon className="w-4 h-4 mr-2" /> Publicites
          </TabsTrigger>
        </TabsList>

        {/* ONGLET PUBLICATION */}
        <TabsContent value="publication" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Statut de publication</CardTitle>
                  <CardDescription>
                    {published
                      ? "Votre etablissement est visible sur Trouvetou"
                      : "Votre etablissement n'est pas visible sur Trouvetou"}
                  </CardDescription>
                </div>
                <Badge variant={published ? "default" : "secondary"}>
                  {published ? "Publie" : "Non publie"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handlePublishToggle}
                disabled={loading}
                variant={published ? "destructive" : "default"}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : published ? (
                  <PowerOff className="w-4 h-4 mr-2" />
                ) : (
                  <Power className="w-4 h-4 mr-2" />
                )}
                {published ? "Depublier" : "Publier"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profil public</CardTitle>
              <CardDescription>
                Informations visibles par les parents sur Trouvetou
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Decrivez votre etablissement..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="5.3600"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="-4.0083"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="itineraire">
                  <MapPin className="w-3 h-3 inline mr-1" /> Itineraire
                </Label>
                <Textarea
                  id="itineraire"
                  value={itineraire}
                  onChange={(e) => setItineraire(e.target.value)}
                  placeholder="Instructions d acces..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="video_url">
                  <Video className="w-3 h-3 inline mr-1" /> Video (YouTube, etc.)
                </Label>
                <Input
                  id="video_url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div>
                <Label>Photos 360</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                    placeholder="URL d'une photo 360..."
                  />
                  <Button type="button" variant="outline" onClick={handleAddPhoto}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {photos360.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {photos360.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="truncate flex-1">{url}</span>
                        <button
                          onClick={() => handleRemovePhoto(i)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSaveProfile} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ONGLET RESERVATIONS */}
        <TabsContent value="reservations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reservations recues</CardTitle>
              <CardDescription>
                Demandes de pre-inscription depuis Trouvetou
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reservations.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  Aucune reservation pour le moment.
                </p>
              ) : (
                <div className="space-y-2">
                  {reservations.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{r.student_full_name}</p>
                        <p className="text-xs text-slate-500">
                          Parent: {r.parent_full_name} • {r.parent_phone}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(r.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            r.status === "pending_payment"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                              : r.status === "reserved"
                                ? "bg-blue-50 text-blue-700 border-blue-300"
                                : r.status === "confirmed"
                                  ? "bg-green-50 text-green-700 border-green-300"
                                  : "bg-red-50 text-red-700 border-red-300"
                          }
                        >
                          {r.status === "pending_payment" ? "Attente paiement"
                            : r.status === "reserved" ? "Reserve"
                            : r.status === "confirmed" ? "Confirme"
                            : "Expire"}
                        </Badge>
                        {r.status === "reserved" && (
                          <Button
                            size="sm"
                            onClick={() => handleFinalizeReservation(r.id)}
                            disabled={loading}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Finaliser
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ONGLET PUBLICITES */}
        <TabsContent value="ads" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Publicites</CardTitle>
                  <CardDescription>
                    Promouvoir votre etablissement sur Trouvetou
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowAdForm(!showAdForm)}>
                  <Plus className="w-4 h-4 mr-1" /> Creer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAdForm && (
                <div className="mb-4 space-y-3 p-4 rounded-lg border bg-slate-50">
                  <div>
                    <Label htmlFor="ad-title">Titre</Label>
                    <Input id="ad-title" value={adTitle} onChange={(e) => setAdTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ad-message">Message</Label>
                    <Textarea id="ad-message" value={adMessage} onChange={(e) => setAdMessage(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ad-image">URL Image</Label>
                    <Input id="ad-image" value={adImageUrl} onChange={(e) => setAdImageUrl(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ad-target">URL Destination</Label>
                    <Input id="ad-target" value={adTargetUrl} onChange={(e) => setAdTargetUrl(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ad-start">Debut</Label>
                      <Input id="ad-start" type="date" value={adStartDate} onChange={(e) => setAdStartDate(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="ad-end">Fin</Label>
                      <Input id="ad-end" type="date" value={adEndDate} onChange={(e) => setAdEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateAd} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Creer
                    </Button>
                    <Button variant="outline" onClick={() => setShowAdForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
              {ads.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  Aucune publicite.
                </p>
              ) : (
                <div className="space-y-2">
                  {ads.map((ad: any) => (
                    <div key={ad.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{ad.title}</p>
                        <p className="text-xs text-slate-500">{ad.message}</p>
                        <p className="text-xs text-slate-400">
                          {ad.start_date} → {ad.end_date}
                        </p>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
