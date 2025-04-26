import { useMemo } from "react"
import { Event, getDateRange } from "../data"
import EventItem from "./EventItem"

interface MonthViewProps {
    date: Date
    events: Event[]
    onEventClick: (event: Event) => void
    onDayClick?: (date: Date) => void
}

export default function MonthView({
    date,
    events,
    onEventClick,
    onDayClick,
}: MonthViewProps) {
    // Get all days in the month view (including days from prev/next months to fill the grid)
    const monthDays = useMemo(() => {
        return getDateRange(date, "month")
    }, [date])

    // Get weekdays for header
    const weekDays = useMemo(() => {
        return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    }, [])

    // Check if a date is in the current month
    const isCurrentMonth = (day: Date) => {
        return day.getMonth() === date.getMonth()
    }

    // Check if a date is today
    const isToday = (day: Date) => {
        const today = new Date()
        return (
            day.getDate() === today.getDate() &&
            day.getMonth() === today.getMonth() &&
            day.getFullYear() === today.getFullYear()
        )
    }

    // Get events for a specific day
    const getEventsForDay = (day: Date) => {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)

        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        return events.filter((event) => {
            const eventStart = new Date(event.start)
            return eventStart >= dayStart && eventStart <= dayEnd
        })
    }

    const handleDayClick = (day: Date) => {
        if (onDayClick) {
            onDayClick(day)
        }
    }

    // Calculate the number of weeks to display (either 5 or 6)
    const numWeeks = Math.ceil(monthDays.length / 7)

    return (
        <div className="flex flex-col h-full">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b">
                {weekDays.map((day, index) => (
                    <div
                        key={index}
                        className="p-2 text-xs font-medium text-center text-gray-500"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-{numWeeks} border-b">
                {monthDays.map((day, index) => {
                    const dayEvents = getEventsForDay(day)
                    const maxEventsToShow = 3
                    const remainingEvents = dayEvents.length - maxEventsToShow

                    return (
                        <div
                            key={index}
                            className={`min-h-[100px] border-r border-b p-1 ${
                                isCurrentMonth(day) ? "bg-white" : "bg-gray-50"
                            } ${isToday(day) ? "bg-blue-50" : ""}`}
                            onClick={() => handleDayClick(day)}
                        >
                            <div
                                className={`text-right text-sm font-medium p-1 ${
                                    isCurrentMonth(day)
                                        ? isToday(day)
                                            ? "text-blue-600"
                                            : "text-gray-900"
                                        : "text-gray-400"
                                }`}
                            >
                                {day.getDate()}
                            </div>
                            <div className="mt-1 space-y-1 overflow-y-auto max-h-[80px]">
                                {dayEvents
                                    .slice(0, maxEventsToShow)
                                    .map((event) => (
                                        <EventItem
                                            key={event.id}
                                            event={event}
                                            isCompact
                                            onClick={onEventClick}
                                        />
                                    ))}
                                {remainingEvents > 0 && (
                                    <div className="text-xs font-medium text-gray-500 px-2">
                                        +{remainingEvents} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
