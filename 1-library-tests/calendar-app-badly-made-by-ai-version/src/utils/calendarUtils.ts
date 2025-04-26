import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    isSameMonth,
    isSameDay,
    parseISO,
    isWithinInterval,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
} from "date-fns"
import type { CalendarEvent, EventsByDate } from "../types"

export const getMonthDays = (date: Date): Date[] => {
    const start = startOfWeek(startOfMonth(date))
    const end = endOfWeek(endOfMonth(date))
    return eachDayOfInterval({ start, end })
}

export const getWeekDays = (date: Date): Date[] => {
    const start = startOfWeek(date)
    const end = endOfWeek(date)
    return eachDayOfInterval({ start, end })
}

export const formatDateKey = (date: Date): string => {
    return format(date, "yyyy-MM-dd")
}

export const groupEventsByDate = (events: CalendarEvent[]): EventsByDate => {
    return events.reduce((acc: EventsByDate, event) => {
        const startDate = parseISO(event.start)
        const endDate = parseISO(event.end)

        // For multi-day events, add the event to each day
        const dates = eachDayOfInterval({ start: startDate, end: endDate })

        dates.forEach((date) => {
            const dateKey = formatDateKey(date)
            if (!acc[dateKey]) {
                acc[dateKey] = []
            }
            acc[dateKey].push(event)
        })

        return acc
    }, {})
}

export const filterEventsForDay = (
    events: CalendarEvent[],
    date: Date
): CalendarEvent[] => {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    return events.filter((event) => {
        const eventStart = parseISO(event.start)
        const eventEnd = parseISO(event.end)

        return (
            isWithinInterval(dayStart, { start: eventStart, end: eventEnd }) ||
            isWithinInterval(dayEnd, { start: eventStart, end: eventEnd }) ||
            isWithinInterval(eventStart, { start: dayStart, end: dayEnd })
        )
    })
}

export const getNavigationFunctions = (view: "month" | "week" | "day") => {
    switch (view) {
        case "month":
            return {
                next: (date: Date) => addMonths(date, 1),
                prev: (date: Date) => subMonths(date, 1),
                today: () => new Date(),
            }
        case "week":
            return {
                next: (date: Date) => addWeeks(date, 1),
                prev: (date: Date) => subWeeks(date, 1),
                today: () => new Date(),
            }
        case "day":
            return {
                next: (date: Date) => addDays(date, 1),
                prev: (date: Date) => subDays(date, 1),
                today: () => new Date(),
            }
    }
}
