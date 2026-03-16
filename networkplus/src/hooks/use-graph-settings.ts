"use client"

import { useState, useEffect } from "react"

export interface GraphSettings {
    clusterThreshold: number
    contactSpacing: number
}

const DEFAULT_SETTINGS: GraphSettings = {
    clusterThreshold: 2.0,
    contactSpacing: 50,
}

const SETTINGS_KEY = "networkplus-graph-settings"

export function useGraphSettings() {
    // Start with default settings to avoid hydration mismatches
    const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS)
    const [isLoaded, setIsLoaded] = useState(false)

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                setSettings({ ...DEFAULT_SETTINGS, ...parsed })
            }
        } catch (error) {
            console.error("Failed to load graph settings:", error)
        } finally {
            setIsLoaded(true)
        }
    }, [])

    // Update settings and save to localStorage
    const updateSettings = (newSettings: Partial<GraphSettings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings }
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
                // Dispatch custom event so other mounted components can sync
                window.dispatchEvent(new CustomEvent('graph-settings-updated', { detail: updated }))
            } catch (error) {
                console.error("Failed to save graph settings:", error)
            }
            return updated
        })
    }

    // Listen for changes from other components/tabs
    useEffect(() => {
        const handleCustomEvent = (e: CustomEvent<GraphSettings>) => {
            setSettings(e.detail)
        }

        const handleStorageEvent = (e: StorageEvent) => {
            if (e.key === SETTINGS_KEY && e.newValue) {
                try {
                    setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) })
                } catch (error) {
                    console.error("Failed to parse cross-tab graph settings:", error)
                }
            }
        }

        window.addEventListener('graph-settings-updated', handleCustomEvent as EventListener)
        window.addEventListener('storage', handleStorageEvent)

        return () => {
            window.removeEventListener('graph-settings-updated', handleCustomEvent as EventListener)
            window.removeEventListener('storage', handleStorageEvent)
        }
    }, [])

    return {
        settings,
        updateSettings,
        isLoaded
    }
}
