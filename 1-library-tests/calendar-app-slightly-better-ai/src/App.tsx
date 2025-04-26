import { useState } from "react"
import CalendarHeader from "./components/CalendarHeader"
import DayView from "./components/DayView"
import WeekView from "./components/WeekView"
import MonthView from "./components/MonthView"
import EventForm from "./components/EventForm"
import {
    Event,
    CalendarView,
    calendarViews,
    getEvents,
    addEvent,
    updateEvent,
    deleteEvent,
} from "./data"

function App() {
    const [currentDate, setCurrentDate] = useState<Date>(new Date())
    const [currentView, setCurrentView] = useState<CalendarView>(
        calendarViews[2]
    ) // Default to month view
    const [events, setEvents] = useState<Event[]>(getEvents())
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
    const [isAddingEvent, setIsAddingEvent] = useState<boolean>(false)

    const handleViewChange = (view: CalendarView) => {
        setCurrentView(view)
    }

    const handleDateChange = (date: Date) => {
        setCurrentDate(date)
    }

    const handleEventClick = (event: Event) => {
        setSelectedEvent(event)
    }

    const handleDayClick = (date: Date) => {
        // Set the currentDate to the clicked date
        setCurrentDate(date)

        // If we're in month view, switch to day view for the clicked date
        if (currentView.type === "month") {
            setCurrentView(calendarViews[0]) // Switch to day view
        }
    }

    const handleAddEventClick = () => {
        setIsAddingEvent(true)
        setSelectedEvent(null)
    }

    const handleCloseEventForm = () => {
        setIsAddingEvent(false)
        setSelectedEvent(null)
    }

    const handleSaveEvent = (eventData: Omit<Event, "id"> | Event) => {
        if ("id" in eventData) {
            // Update existing event
            const updatedEvent = updateEvent(eventData as Event)
            if (updatedEvent) {
                setEvents([
                    ...events.filter((e) => e.id !== updatedEvent.id),
                    updatedEvent,
                ])
            }
        } else {
            // Add new event
            const newEvent = addEvent(eventData)
            setEvents([...events, newEvent])
        }
        handleCloseEventForm()
    }

    const handleDeleteEvent = () => {
        if (selectedEvent) {
            deleteEvent(selectedEvent.id)
            setEvents(events.filter((e) => e.id !== selectedEvent.id))
            handleCloseEventForm()
        }
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <CalendarHeader
                date={currentDate}
                view={currentView}
                views={calendarViews}
                onViewChange={handleViewChange}
                onDateChange={handleDateChange}
            />

            <div className="flex justify-end p-4">
                <button
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={handleAddEventClick}
                >
                    Add Event
                </button>
            </div>

            <div className="flex-1 mx-4 mb-4 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {currentView.type === "day" && (
                    <DayView
                        date={currentDate}
                        events={events}
                        onEventClick={handleEventClick}
                    />
                )}

                {currentView.type === "week" && (
                    <WeekView
                        date={currentDate}
                        events={events}
                        onEventClick={handleEventClick}
                    />
                )}

                {currentView.type === "month" && (
                    <MonthView
                        date={currentDate}
                        events={events}
                        onEventClick={handleEventClick}
                        onDayClick={handleDayClick}
                    />
                )}
            </div>

            {(selectedEvent || isAddingEvent) && (
                <EventForm
                    event={selectedEvent || undefined}
                    onSave={handleSaveEvent}
                    onCancel={handleCloseEventForm}
                />
            )}
        </div>
    )
}

export default App
