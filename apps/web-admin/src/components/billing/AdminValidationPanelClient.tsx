"use client";

import { useState } from "react";
import { AdminValidationPanel } from "./AdminValidationPanel";
import { validatePaymentRequest, rejectPaymentRequest } from "@/app/dashboard/billing/actions";

interface AdminValidationPanelClientProps {
  requests: any[];
}

export function AdminValidationPanelClient({ requests }: AdminValidationPanelClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AdminValidationPanel
      productId="schooly"
      productName="Schooly"
      requests={requests}
      onValidate={async (requestId) => {
        const res = await validatePaymentRequest(requestId);
        if ("error" in res && res.error) throw new Error(res.error);
      }}
      onReject={async (requestId) => {
        const res = await rejectPaymentRequest(requestId);
        if ("error" in res && res.error) throw new Error(res.error);
      }}
      onRefresh={async () => {
        setRefreshKey((k) => k + 1);
      }}
    />
  );
}
