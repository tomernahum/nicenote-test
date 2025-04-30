export interface CalendarEvent {
    id: string
    title: string
    description?: string
    start: string // ISO date string
    end: string // ISO date string
    allDay?: boolean
    color?: string
}

export type EventsByDate = Record<string, CalendarEvent[]>

export interface CalendarViewState {
    currentDate: Date
    view: "month" | "week" | "day"
}
