import { BulletinView } from "./bulletin-view"

export default async function BulletinPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollment?: string }>
}) {
  const params = await searchParams
  return <BulletinView enrollmentId={params.enrollment ?? ""} />
}
