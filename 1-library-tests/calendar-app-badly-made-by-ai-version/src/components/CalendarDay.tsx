import { format, isSameMonth, isSameDay, isBefore, isToday } from "date-fns"
import type { CalendarEvent } from "../types"

interface CalendarDayProps {
    date: Date
    currentMonth: Date
    events: CalendarEvent[]
    onSelectDate: (date: Date) => void
    onSelectEvent: (event: CalendarEvent) => void
}

export const CalendarDay = ({
    date,
    currentMonth,
    events,
    onSelectDate,
    onSelectEvent,
}: CalendarDayProps) => {
    const isCurrentMonth = isSameMonth(date, currentMonth)
    const isPast = isBefore(date, new Date()) && !isToday(date)

    // Get day number
    const dayNumber = format(date, "d")

    // Sort events by start time
    const sortedEvents = [...events].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )

    // Limit visible events for day view
    const visibleEvents = sortedEvents.slice(0, 3)
    const hiddenEvents = sortedEvents.length > 3 ? sortedEvents.length - 3 : 0

    return (
        <div
            className={`relative h-32 border p-1 overflow-hidden ${
                isCurrentMonth ? "bg-white" : "bg-gray-50"
            } ${isPast ? "text-gray-400" : "text-gray-800"}`}
            onClick={() => onSelectDate(date)}
        >
            <div className="flex justify-between">
                <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-sm ${
                        isToday(date)
                            ? "bg-blue-500 text-white font-semibold"
                            : ""
                    }`}
                >
                    {dayNumber}
                </span>
                <span className="text-xs text-gray-500">
                    {format(date, "EEE")}
                </span>
            </div>

            <div className="mt-2 space-y-1 overflow-hidden">
                {visibleEvents.map((event) => (
                    <div
                        key={event.id}
                        className="text-xs truncate py-1 px-2 rounded cursor-pointer"
                        style={{
                            backgroundColor: `${event.color || "#4f46e5"}20`,
                            borderLeft: `3px solid ${event.color || "#4f46e5"}`,
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelectEvent(event)
                        }}
                    >
                        {event.allDay
                            ? "🔄 "
                            : `${format(new Date(event.start), "HH:mm")} `}
                        {event.title}
                    </div>
                ))}

                {hiddenEvents > 0 && (
                    <div className="text-xs text-gray-500 pl-2">
                        +{hiddenEvents} more
                    </div>
                )}
            </div>
        </div>
    )
}
