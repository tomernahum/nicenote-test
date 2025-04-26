import { format, isSameDay, isToday } from "date-fns"
import {
    getWeekDays,
    filterEventsForDay,
    formatDateKey,
} from "../utils/calendarUtils"
import type { CalendarEvent } from "../types"

interface WeekViewProps {
    currentDate: Date
    events: CalendarEvent[]
    onSelectDate: (date: Date) => void
    onSelectEvent: (event: CalendarEvent) => void
}

export const WeekView = ({
    currentDate,
    events,
    onSelectDate,
    onSelectEvent,
}: WeekViewProps) => {
    const weekDays = getWeekDays(currentDate)

    // Hours to display (6am to 9pm)
    const hours = Array.from({ length: 16 }, (_, i) => i + 6)

    return (
        <div className="flex flex-col h-full overflow-auto">
            <div className="sticky top-0 z-10 flex bg-white border-b">
                <div className="w-16 flex-shrink-0" />
                {weekDays.map((day) => (
                    <div
                        key={formatDateKey(day)}
                        className={`flex-1 text-center p-2 ${
                            isToday(day) ? "bg-blue-50" : ""
                        }`}
                    >
                        <div className="text-sm font-medium">
                            {format(day, "EEE")}
                        </div>
                        <div
                            className={`text-xl ${
                                isToday(day)
                                    ? "h-8 w-8 rounded-full bg-blue-500 text-white mx-auto flex items-center justify-center"
                                    : ""
                            }`}
                        >
                            {format(day, "d")}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-1 min-h-0">
                <div className="w-16 flex-shrink-0 border-r">
                    {hours.map((hour) => (
                        <div
                            key={hour}
                            className="h-12 text-xs text-right pr-2 text-gray-500 border-b"
                        >
                            {hour === 12
                                ? "12pm"
                                : hour > 12
                                ? `${hour - 12}pm`
                                : `${hour}am`}
                        </div>
                    ))}
                </div>

                <div className="flex flex-1">
                    {weekDays.map((day) => {
                        const dayEvents = filterEventsForDay(events, day)

                        return (
                            <div
                                key={formatDateKey(day)}
                                className={`flex-1 relative border-r ${
                                    isToday(day) ? "bg-blue-50" : ""
                                }`}
                                onClick={() => onSelectDate(day)}
                            >
                                {hours.map((hour) => (
                                    <div key={hour} className="h-12 border-b" />
                                ))}

                                {/* Render events */}
                                {dayEvents.map((event) => {
                                    const startDate = new Date(event.start)
                                    const endDate = new Date(event.end)

                                    // Skip all-day events in this view
                                    if (event.allDay) return null

                                    // Only show events for this day
                                    if (!isSameDay(startDate, day)) return null

                                    const startHour =
                                        startDate.getHours() +
                                        startDate.getMinutes() / 60
                                    const endHour =
                                        endDate.getHours() +
                                        endDate.getMinutes() / 60
                                    const duration = endHour - startHour

                                    // Calculate position and height
                                    const top = Math.max(
                                        0,
                                        (startHour - 6) * 48
                                    ) // 48px per hour
                                    const height = Math.max(24, duration * 48) // Min height 24px

                                    return (
                                        <div
                                            key={event.id}
                                            className="absolute mx-1 rounded px-2 py-1 overflow-hidden cursor-pointer text-xs"
                                            style={{
                                                top: `${top}px`,
                                                height: `${height}px`,
                                                backgroundColor: `${
                                                    event.color || "#4f46e5"
                                                }20`,
                                                borderLeft: `3px solid ${
                                                    event.color || "#4f46e5"
                                                }`,
                                                width: "calc(100% - 8px)",
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onSelectEvent(event)
                                            }}
                                        >
                                            <div className="font-medium">
                                                {event.title}
                                            </div>
                                            <div>
                                                {format(startDate, "HH:mm")} -{" "}
                                                {format(endDate, "HH:mm")}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
