import { useMemo } from "react"
import { Event, getDateRange } from "../data"
import EventItem from "./EventItem"

interface WeekViewProps {
    date: Date
    events: Event[]
    onEventClick: (event: Event) => void
}

export default function WeekView({
    date,
    events,
    onEventClick,
}: WeekViewProps) {
    // Get all days in the week
    const weekDays = useMemo(() => {
        return getDateRange(date, "week")
    }, [date])

    // Format date display for day headers
    const formatDayHeader = (date: Date) => {
        const today = new Date()
        const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()

        return {
            day: date.toLocaleDateString("en-US", { weekday: "short" }),
            date: date.getDate(),
            isToday,
        }
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

    // Generate time slots for the day (hourly)
    const timeSlots = useMemo(() => {
        const slots = []
        for (let i = 0; i < 24; i++) {
            const slotDate = new Date()
            slotDate.setHours(i, 0, 0, 0)
            slots.push(slotDate)
        }
        return slots
    }, [])

    // Format time display
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
        })
    }

    // Find events for a specific day and hour
    const getEventsForTimeSlot = (day: Date, hour: number) => {
        const dayEvents = getEventsForDay(day)
        return dayEvents.filter((event) => {
            if (event.allDay) return false
            const eventHour = new Date(event.start).getHours()
            return eventHour === hour
        })
    }

    // Get all-day events for a day
    const getAllDayEventsForDay = (day: Date) => {
        const dayEvents = getEventsForDay(day)
        return dayEvents.filter((event) => event.allDay)
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Day headers */}
            <div className="flex border-b">
                <div className="w-16 shrink-0 border-r"></div>
                {weekDays.map((day, index) => {
                    const {
                        day: dayName,
                        date: dayNum,
                        isToday,
                    } = formatDayHeader(day)
                    return (
                        <div
                            key={index}
                            className={`flex-1 p-2 text-center border-r last:border-r-0 ${
                                isToday ? "bg-blue-50" : ""
                            }`}
                        >
                            <div className="text-xs font-medium text-gray-500">
                                {dayName}
                            </div>
                            <div
                                className={`text-sm font-semibold ${
                                    isToday ? "text-blue-600" : "text-gray-800"
                                }`}
                            >
                                {dayNum}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* All-day events section */}
            <div className="flex border-b">
                <div className="w-16 py-2 shrink-0 text-xs font-medium text-gray-500 text-center border-r">
                    ALL-DAY
                </div>
                {weekDays.map((day, index) => {
                    const allDayEvents = getAllDayEventsForDay(day)
                    return (
                        <div
                            key={index}
                            className="flex-1 p-1 border-r last:border-r-0 max-h-24 overflow-y-auto"
                        >
                            {allDayEvents.map((event) => (
                                <EventItem
                                    key={event.id}
                                    event={event}
                                    isCompact
                                    onClick={onEventClick}
                                />
                            ))}
                        </div>
                    )
                })}
            </div>

            {/* Scrollable time grid */}
            <div className="flex-1 overflow-y-auto">
                {timeSlots.map((timeSlot, timeIndex) => (
                    <div key={timeIndex} className="flex min-h-[3rem] border-b">
                        <div className="w-16 py-2 shrink-0 text-xs text-gray-500 text-right pr-2 border-r">
                            {formatTime(timeSlot)}
                        </div>
                        {weekDays.map((day, dayIndex) => {
                            const slotEvents = getEventsForTimeSlot(
                                day,
                                timeSlot.getHours()
                            )
                            const isCurrentHour =
                                timeSlot.getHours() === new Date().getHours() &&
                                day.getDate() === new Date().getDate() &&
                                day.getMonth() === new Date().getMonth() &&
                                day.getFullYear() === new Date().getFullYear()

                            return (
                                <div
                                    key={dayIndex}
                                    className={`flex-1 p-1 border-r last:border-r-0 ${
                                        isCurrentHour ? "bg-blue-50" : ""
                                    }`}
                                >
                                    {slotEvents.map((event) => (
                                        <EventItem
                                            key={event.id}
                                            event={event}
                                            isCompact
                                            onClick={onEventClick}
                                        />
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}
