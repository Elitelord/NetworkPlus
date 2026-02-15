"use client";

import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { messagingPromise } from "@/lib/firebase";

export function useFcmToken() {
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] =
        useState<NotificationPermission>("default");

    useEffect(() => {
        const retrieveToken = async () => {
            try {
                if (typeof window !== "undefined" && "serviceWorker" in navigator) {
                    const messaging = await messagingPromise;
                    if (!messaging) return;

                    const permission = await Notification.requestPermission();
                    setNotificationPermission(permission);

                    if (permission === "granted") {
                        const currentToken = await getToken(messaging, {
                            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
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
                        } else {
                            console.log("No registration token available. Request permission to generate one.");
                        }
                    }
                }
            } catch (error) {
                console.error("An error occurred while retrieving token:", error);
            }
        };

        retrieveToken();
    }, []);

    useEffect(() => {
        // Listen for foreground messages
        const setupOnMessage = async () => {
            const messaging = await messagingPromise;
            if (!messaging) return;

            const unsubscribe = onMessage(messaging, (payload) => {
                console.log("Foreground message received:", payload);
                // Optionally display a toast or UI notification here
                // e.g. toast(payload.notification?.title)
            });

            return () => unsubscribe();
        };

        setupOnMessage();
    }, []);

    return { token, notificationPermission };
}
