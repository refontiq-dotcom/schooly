import { Suspense } from "react";
import AuthForm from "./auth-form";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[85vh]" />}>
      <AuthForm />
    </Suspense>
  );
}
