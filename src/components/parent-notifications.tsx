"use client";

import { useState, useEffect, useCallback } from "react";

type Notification = {
  id: string;
  type: "grade" | "payment" | "attendance" | "message" | "alert";
  title: string;
  body: string;
  read: boolean;
  timestamp: Date;
};

type Props = {
  studentName: string;
  attendanceRate: number | null;
  missingPayments: number;
  missingDocs: number;
  unreadMessages: number;
};

export default function ParentNotifications({
  studentName,
  attendanceRate,
  missingPayments,
  missingDocs,
  unreadMessages,
}: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // Build notifications from props
  useEffect(() => {
    const items: Notification[] = [];

    if (attendanceRate !== null && attendanceRate < 60) {
      items.push({
        id: "attendance-alert",
        type: "attendance",
        title: "⚠️ Absences fréquentes",
        body: `${studentName} a ${attendanceRate}% de présence. Contactez l'établissement.`,
        read: false,
        timestamp: new Date(),
      });
    }

    if (missingPayments > 0) {
      items.push({
        id: "payment-alert",
        type: "payment",
        title: "💰 Frais en attente",
        body: `${missingPayments} paiement(s) en attente pour ${studentName}.`,
        read: false,
        timestamp: new Date(),
      });
    }

    if (missingDocs > 0) {
      items.push({
        id: "doc-alert",
        type: "alert",
        title: "📄 Documents manquants",
        body: `${missingDocs} document(s) manquant(s) pour ${studentName}.`,
        read: false,
        timestamp: new Date(),
      });
    }

    if (unreadMessages > 0) {
      items.push({
        id: "message-alert",
        type: "message",
        title: "💬 Nouveau(x) message(s)",
        body: `${unreadMessages} message(s) non lu(s) de l'établissement.`,
        read: false,
        timestamp: new Date(),
      });
    }

    setNotifications(items);
  }, [studentName, attendanceRate, missingPayments, missingDocs, unreadMessages]);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        // Send a test notification
        new Notification("🔔 Schooly", {
          body: "Notifications activées ! Vous recevrez des alertes importantes.",
          icon: "/icon.svg",
        });
      }
    }
  }, []);

  // Send browser notification for new alerts
  useEffect(() => {
    if (permission !== "granted") return;

    const unread = notifications.filter((n) => !n.read);
    if (unread.length > 0) {
      const latest = unread[0];
      new Notification(latest.title, {
        body: latest.body,
        icon: "/icon.svg",
        tag: latest.id, // Prevents duplicates
      });
    }
  }, [notifications, permission]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      {/* Notification bell button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
      >
        <span className="text-2xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                🔔 Alertes
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Tout marquer lu ✓
                </button>
              )}
            </div>

            {/* Permission prompt */}
            {permission === "default" && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-xs text-amber-800 mb-2">
                  🔔 Activez les notifications pour recevoir des alertes importantes
                </p>
                <button
                  type="button"
                  onClick={requestPermission}
                  className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  Activer les notifications
                </button>
              </div>
            )}

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="text-4xl block mb-2">✅</span>
                  <p className="text-sm text-slate-500">Tout va bien !</p>
                  <p className="text-xs text-slate-400">Aucune alerte pour le moment.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => markAsRead(notif.id)}
                    className={`w-full px-4 py-3 text-left border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      !notif.read ? "bg-amber-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">
                        {notif.type === "grade"
                          ? "📝"
                          : notif.type === "payment"
                            ? "💰"
                            : notif.type === "attendance"
                              ? "📋"
                              : notif.type === "message"
                                ? "💬"
                                : "⚠️"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {notif.body}
                        </p>
                      </div>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400 text-center">
                {notifications.filter((n) => !n.read).length} alerte(s) non lue(s)
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
