import { redirect } from "next/navigation";
import { ParentOtpForm } from "./parent-otp-form";

export default async function ParentOtpVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const phone = params.phone?.trim();
  if (!phone) redirect("/auth");

  return (
    <main className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg md:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl">🔐</div>
          <h1 className="text-2xl font-bold text-slate-800">Vérification du téléphone</h1>
          <p className="mt-2 text-sm text-slate-500">
            Entrez le code reçu par SMS au numéro <strong>{phone}</strong>.
          </p>
        </div>
        <ParentOtpForm phone={phone} returnTo={params.returnTo || "/dashboard/parent"} />
      </div>
    </main>
  );
}
