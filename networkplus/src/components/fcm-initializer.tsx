"use client";

import { useFcmToken } from "@/hooks/use-fcm-token";

export default function FcmInitializer() {
    useFcmToken();
    return null;
}
