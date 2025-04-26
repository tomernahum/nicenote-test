import { useMemo } from "react"
import { Event } from "../data"
import EventItem from "./EventItem"

interface DayViewProps {
    date: Date
    events: Event[]
    onEventClick: (event: Event) => void
}

export default function DayView({ date, events, onEventClick }: DayViewProps) {
    // Generate time slots for the day (hourly)
    const timeSlots = useMemo(() => {
        const slots = []
        for (let i = 0; i < 24; i++) {
            slots.push(new Date(date.setHours(i, 0, 0, 0)))
        }
        return slots
    }, [date])

    // Filter events for the current day
    const dayEvents = useMemo(() => {
        const currentDate = new Date(date)
        currentDate.setHours(0, 0, 0, 0)

        const nextDate = new Date(currentDate)
        nextDate.setDate(nextDate.getDate() + 1)

        return events.filter((event) => {
            const eventStart = new Date(event.start)
            return eventStart >= currentDate && eventStart < nextDate
        })
    }, [date, events])

    // Format time display
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
        })
    }

    // Find events for a specific hour
    const getEventsForHour = (hour: number) => {
        return dayEvents.filter((event) => {
            const eventHour = new Date(event.start).getHours()
            return eventHour === hour
        })
    }

    // Get all-day events
    const allDayEvents = useMemo(() => {
        return dayEvents.filter((event) => event.allDay)
    }, [dayEvents])

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* All-day events section */}
            {allDayEvents.length > 0 && (
                <div className="px-4 py-2 border-b">
                    <h3 className="mb-2 text-xs font-medium text-gray-500">
                        ALL-DAY
                    </h3>
                    <div className="space-y-1">
                        {allDayEvents.map((event) => (
                            <EventItem
                                key={event.id}
                                event={event}
                                isCompact
                                onClick={onEventClick}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Scrollable time slots */}
            <div className="flex-1 overflow-y-auto">
                {timeSlots.map((timeSlot, index) => {
                    const hourEvents = getEventsForHour(timeSlot.getHours())

                    return (
                        <div
                            key={index}
                            className={`flex min-h-[6rem] border-b ${
                                timeSlot.getHours() === new Date().getHours() &&
                                date.getDate() === new Date().getDate() &&
                                date.getMonth() === new Date().getMonth() &&
                                date.getFullYear() === new Date().getFullYear()
                                    ? "bg-blue-50"
                                    : ""
                            }`}
                        >
                            <div className="w-16 py-2 text-right text-sm text-gray-500 border-r">
                                {formatTime(timeSlot)}
                            </div>
                            <div className="flex-1 p-2">
                                {hourEvents.map((event) => (
                                    <EventItem
                                        key={event.id}
                                        event={event}
                                        onClick={onEventClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
