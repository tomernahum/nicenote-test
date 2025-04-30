// Types for Calendar App
export interface Event {
    id: string
    title: string
    description: string
    start: Date
    end: Date
    color: string
    allDay: boolean
}

export interface CalendarView {
    id: string
    name: string
    type: "day" | "week" | "month"
}

// Mock data
export const events: Event[] = [
    {
        id: "1",
        title: "Team Meeting",
        description: "Weekly team sync to discuss progress",
        start: new Date(new Date().setHours(10, 0, 0, 0)),
        end: new Date(new Date().setHours(11, 0, 0, 0)),
        color: "#4f46e5", // indigo
        allDay: false,
    },
    {
        id: "2",
        title: "Product Review",
        description: "Review the latest product features",
        start: new Date(new Date().setHours(14, 0, 0, 0)),
        end: new Date(new Date().setHours(15, 30, 0, 0)),
        color: "#0891b2", // cyan
        allDay: false,
    },
    {
        id: "3",
        title: "Project Deadline",
        description: "Submit final deliverables",
        start: new Date(new Date().setDate(new Date().getDate() + 2)),
        end: new Date(new Date().setDate(new Date().getDate() + 2)),
        color: "#dc2626", // red
        allDay: true,
    },
    {
        id: "4",
        title: "Training Session",
        description: "New technology workshop",
        start: new Date(new Date().setDate(new Date().getDate() + 1)),
        end: new Date(new Date().setDate(new Date().getDate() + 1)),
        color: "#15803d", // green
        allDay: false,
    },
    {
        id: "5",
        title: "Client Meeting",
        description: "Discuss project progress with the client",
        start: new Date(new Date().setDate(new Date().getDate() - 1)),
        end: new Date(new Date().setDate(new Date().getDate() - 1)),
        color: "#9333ea", // purple
        allDay: false,
    },
]

export const calendarViews: CalendarView[] = [
    { id: "1", name: "Day", type: "day" },
    { id: "2", name: "Week", type: "week" },
    { id: "3", name: "Month", type: "month" },
]

// Functions to interact with data
export const getEvents = (): Event[] => {
    return events
}

export const getEventById = (id: string): Event | undefined => {
    return events.find((event) => event.id === id)
}

export const addEvent = (event: Omit<Event, "id">): Event => {
    const newEvent = {
        ...event,
        id: Math.random().toString(36).substring(2, 9),
    }
    events.push(newEvent)
    return newEvent
}

export const updateEvent = (updatedEvent: Event): Event | undefined => {
    const index = events.findIndex((event) => event.id === updatedEvent.id)
    if (index !== -1) {
        events[index] = updatedEvent
        return updatedEvent
    }
    return undefined
}

export const deleteEvent = (id: string): boolean => {
    const index = events.findIndex((event) => event.id === id)
    if (index !== -1) {
        events.splice(index, 1)
        return true
    }
    return false
}

// Utility functions
export const getDateRange = (
    date: Date,
    view: "day" | "week" | "month"
): Date[] => {
    const dates: Date[] = []
    const currentDate = new Date(date)

    if (view === "day") {
        dates.push(new Date(currentDate))
    } else if (view === "week") {
        // Start from Sunday of the week
        const day = currentDate.getDay()
        const diff = currentDate.getDate() - day
        const weekStart = new Date(currentDate)
        weekStart.setDate(diff)

        for (let i = 0; i < 7; i++) {
            const nextDate = new Date(weekStart)
            nextDate.setDate(weekStart.getDate() + i)
            dates.push(nextDate)
        }
    } else if (view === "month") {
        // Start from the first day of the month
        const firstDay = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
        )
        const lastDay = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
        )

        // Include last days of previous month if month doesn't start on Sunday
        const firstDayOfWeek = firstDay.getDay()
        for (let i = 0; i < firstDayOfWeek; i++) {
            const prevDate = new Date(firstDay)
            prevDate.setDate(firstDay.getDate() - (firstDayOfWeek - i))
            dates.push(prevDate)
        }

        // Add all days of current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            dates.push(
                new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
            )
        }

        // Fill remaining days from next month to complete the grid
        const lastDayOfWeek = lastDay.getDay()
        if (lastDayOfWeek < 6) {
            for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
                const nextDate = new Date(lastDay)
                nextDate.setDate(lastDay.getDate() + i)
                dates.push(nextDate)
            }
        }
    }

    return dates
}
