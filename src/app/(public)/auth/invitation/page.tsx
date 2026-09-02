import { Suspense } from "react";
import InvitationForm from "./invitation-form";

export default function InvitationPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto card">Chargement…</div>}>
      <InvitationForm />
    </Suspense>
  );
}
