import { useState, useEffect } from "react"
import type { CalendarEvent } from "../types"

// Sample data for initial events
const initialEvents: CalendarEvent[] = [
    {
        id: "1",
        title: "Team Meeting",
        description: "Weekly team sync",
        start: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            15,
            10,
            0
        ).toISOString(),
        end: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            15,
            11,
            0
        ).toISOString(),
        color: "#4f46e5",
    },
    {
        id: "2",
        title: "Product Demo",
        description: "Show new features to the client",
        start: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            17,
            14,
            0
        ).toISOString(),
        end: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            17,
            15,
            30
        ).toISOString(),
        color: "#10b981",
    },
    {
        id: "3",
        title: "Conference",
        description: "Annual industry conference",
        start: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            20
        ).toISOString(),
        end: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            22
        ).toISOString(),
        allDay: true,
        color: "#f59e0b",
    },
    {
        id: "4",
        title: "Deadline",
        description: "Project submission deadline",
        start: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate() + 5,
            23,
            59
        ).toISOString(),
        end: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate() + 5,
            23,
            59
        ).toISOString(),
        color: "#ef4444",
    },
]

const STORAGE_KEY = "calendar-events"

export const useEvents = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Load events from localStorage on mount
    useEffect(() => {
        const loadEvents = () => {
            const storedEvents = localStorage.getItem(STORAGE_KEY)

            if (storedEvents) {
                try {
                    setEvents(JSON.parse(storedEvents))
                } catch (e) {
                    console.error("Failed to parse stored events", e)
                    setEvents(initialEvents)
                }
            } else {
                setEvents(initialEvents)
            }

            setIsLoading(false)
        }

        loadEvents()
    }, [])

    // Save events to localStorage whenever they change
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
        }
    }, [events, isLoading])

    const addEvent = (event: Omit<CalendarEvent, "id">) => {
        const newEvent: CalendarEvent = {
            ...event,
            id: Math.random().toString(36).substring(2, 11),
        }

        setEvents((prevEvents) => [...prevEvents, newEvent])
        return newEvent
    }

    const updateEvent = (updatedEvent: CalendarEvent) => {
        setEvents((prevEvents) =>
            prevEvents.map((event) =>
                event.id === updatedEvent.id ? updatedEvent : event
            )
        )
    }

    const deleteEvent = (eventId: string) => {
        setEvents((prevEvents) =>
            prevEvents.filter((event) => event.id !== eventId)
        )
    }

    return {
        events,
        isLoading,
        addEvent,
        updateEvent,
        deleteEvent,
    }
}
