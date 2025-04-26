import { format } from "date-fns"
import { CalendarDay } from "./CalendarDay"
import {
    getMonthDays,
    groupEventsByDate,
    formatDateKey,
} from "../utils/calendarUtils"
import type { CalendarEvent } from "../types"

interface MonthViewProps {
    currentDate: Date
    events: CalendarEvent[]
    onSelectDate: (date: Date) => void
    onSelectEvent: (event: CalendarEvent) => void
}

export const MonthView = ({
    currentDate,
    events,
    onSelectDate,
    onSelectEvent,
}: MonthViewProps) => {
    const monthDays = getMonthDays(currentDate)
    const eventsByDate = groupEventsByDate(events)

    // Get weekday names
    const weekdays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(2023, 0, i + 1) // Using a Sunday as first day (Jan 1, 2023 was a Sunday)
        return format(date, "EEE")
    })

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 gap-px bg-gray-200">
                {weekdays.map((day, i) => (
                    <div
                        key={i}
                        className="text-center py-2 font-semibold text-gray-600 bg-gray-100"
                    >
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-px flex-1 bg-gray-200">
                {monthDays.map((day) => {
                    const dateKey = formatDateKey(day)
                    const dayEvents = eventsByDate[dateKey] || []

                    return (
                        <CalendarDay
                            key={dateKey}
                            date={day}
                            currentMonth={currentDate}
                            events={dayEvents}
                            onSelectDate={onSelectDate}
                            onSelectEvent={onSelectEvent}
                        />
                    )
                })}
            </div>
        </div>
    )
}
