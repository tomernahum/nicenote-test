import { format } from "date-fns"
import { filterEventsForDay } from "../utils/calendarUtils"
import type { CalendarEvent } from "../types"

interface DayViewProps {
    currentDate: Date
    events: CalendarEvent[]
    onSelectEvent: (event: CalendarEvent) => void
}

export const DayView = ({
    currentDate,
    events,
    onSelectEvent,
}: DayViewProps) => {
    const dayEvents = filterEventsForDay(events, currentDate)

    // Sort events: all-day events first, then by start time
    const sortedEvents = [...dayEvents].sort((a, b) => {
        if (a.allDay && !b.allDay) return -1
        if (!a.allDay && b.allDay) return 1
        return new Date(a.start).getTime() - new Date(b.start).getTime()
    })

    // Hours to display (6am to 9pm)
    const hours = Array.from({ length: 16 }, (_, i) => i + 6)

    // Get all-day events
    const allDayEvents = sortedEvents.filter((event) => event.allDay)

    // Get timed events
    const timedEvents = sortedEvents.filter((event) => !event.allDay)

    return (
        <div className="flex flex-col h-full overflow-auto">
            <div className="bg-white p-4 border-b sticky top-0 z-10">
                <h2 className="text-lg font-bold text-center">
                    {format(currentDate, "EEEE, MMMM d, yyyy")}
                </h2>
            </div>

            {/* All-day events section */}
            {allDayEvents.length > 0 && (
                <div className="bg-white border-b p-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">
                        ALL DAY
                    </div>
                    <div className="space-y-2">
                        {allDayEvents.map((event) => (
                            <div
                                key={event.id}
                                className="px-3 py-2 rounded cursor-pointer text-sm"
                                style={{
                                    backgroundColor: `${
                                        event.color || "#4f46e5"
                                    }20`,
                                    borderLeft: `3px solid ${
                                        event.color || "#4f46e5"
                                    }`,
                                }}
                                onClick={() => onSelectEvent(event)}
                            >
                                {event.title}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Hourly timeline */}
            <div className="flex flex-1">
                <div className="w-16 flex-shrink-0 border-r">
                    {hours.map((hour) => (
                        <div
                            key={hour}
                            className="h-16 text-xs text-right pr-2 text-gray-500 border-b"
                        >
                            {hour === 12
                                ? "12pm"
                                : hour > 12
                                ? `${hour - 12}pm`
                                : `${hour}am`}
                        </div>
                    ))}
                </div>

                <div className="flex-1 relative">
                    {hours.map((hour) => (
                        <div key={hour} className="h-16 border-b" />
                    ))}

                    {/* Render timed events */}
                    {timedEvents.map((event) => {
                        const startDate = new Date(event.start)
                        const endDate = new Date(event.end)

                        const startHour =
                            startDate.getHours() + startDate.getMinutes() / 60
                        const endHour =
                            endDate.getHours() + endDate.getMinutes() / 60
                        const duration = endHour - startHour

                        // Calculate position and height
                        const top = Math.max(0, (startHour - 6) * 64) // 64px per hour
                        const height = Math.max(32, duration * 64) // Min height 32px

                        return (
                            <div
                                key={event.id}
                                className="absolute rounded px-3 py-2 mx-2 overflow-hidden cursor-pointer"
                                style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    backgroundColor: `${
                                        event.color || "#4f46e5"
                                    }20`,
                                    borderLeft: `3px solid ${
                                        event.color || "#4f46e5"
                                    }`,
                                    width: "calc(100% - 16px)",
                                }}
                                onClick={() => onSelectEvent(event)}
                            >
                                <div className="font-medium">{event.title}</div>
                                <div className="text-sm">
                                    {format(startDate, "HH:mm")} -{" "}
                                    {format(endDate, "HH:mm")}
                                </div>
                                {duration > 0.5 && (
                                    <div className="text-sm mt-1 overflow-hidden">
                                        {event.description}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
