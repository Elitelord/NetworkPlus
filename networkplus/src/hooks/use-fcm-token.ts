"use client";

import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { messagingPromise } from "@/lib/firebase";

export function useFcmToken() {
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] =
        useState<NotificationPermission>("default");

    const retrieveToken = async () => {
        try {
            if (typeof window !== "undefined" && "serviceWorker" in navigator) {
                const messaging = await messagingPromise;
                if (!messaging) return;

                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);

                if (permission === "granted") {
                    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                    if (!vapidKey) {
                        console.error("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY");
                        return;
                    }

                    const currentToken = await getToken(messaging, {
                        vapidKey: vapidKey,
                    });

                    if (currentToken) {
                        setToken(currentToken);
                        // Send token to backend
                        await fetch("/api/user/fcm-token", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ token: currentToken }),
                        });
                    }
                }
            }
        } catch (error) {
            console.error("An error occurred while retrieving token:", error);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setNotificationPermission(Notification.permission);
            if (Notification.permission === "granted") {
                retrieveToken();
            }
        }
    }, []);

    useEffect(() => {
        // Listen for foreground messages
        const setupOnMessage = async () => {
            const messaging = await messagingPromise;
            if (!messaging) return;

            const unsubscribe = onMessage(messaging, (payload) => {
                console.log("Foreground message received:", payload);
                if (payload.notification) {
                    new Notification(payload.notification.title || "New Notification", {
                        body: payload.notification.body,
                        icon: "/icon.png",
                    });
                }
            });

            return () => unsubscribe();
        };

        setupOnMessage();
    }, []);

    return { token, notificationPermission, retrieveToken };
}
