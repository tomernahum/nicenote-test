import { useState } from "react"
import { CalendarHeader } from "./CalendarHeader"
import { MonthView } from "./MonthView"
import { WeekView } from "./WeekView"
import { DayView } from "./DayView"
import { EventModal } from "./EventModal"
import { useEvents } from "../hooks/useEvents"
import type { CalendarEvent, CalendarViewState } from "../types"

export const Calendar = () => {
    // State for managing calendar view
    const [viewState, setViewState] = useState<CalendarViewState>({
        currentDate: new Date(),
        view: "month",
    })

    // State for managing the event modal
    const [modalState, setModalState] = useState<{
        isOpen: boolean
        event?: CalendarEvent
        selectedDate?: Date
    }>({
        isOpen: false,
    })

    // Use the events hook for data
    const { events, isLoading, addEvent, updateEvent, deleteEvent } =
        useEvents()

    // Handle view change
    const handleViewChange = (view: "month" | "week" | "day") => {
        setViewState((prev) => ({ ...prev, view }))
    }

    // Handle date change
    const handleDateChange = (date: Date) => {
        setViewState((prev) => ({ ...prev, currentDate: date }))
    }

    // Handle adding a new event
    const handleAddEvent = () => {
        setModalState({
            isOpen: true,
            selectedDate: viewState.currentDate,
        })
    }

    // Handle clicking on a date to create a new event
    const handleSelectDate = (date: Date) => {
        setModalState({
            isOpen: true,
            selectedDate: date,
        })
    }

    // Handle clicking on an existing event to edit it
    const handleSelectEvent = (event: CalendarEvent) => {
        setModalState({
            isOpen: true,
            event,
        })
    }

    // Handle closing the modal
    const handleCloseModal = () => {
        setModalState({ isOpen: false })
    }

    // Handle saving an event
    const handleSaveEvent = (
        eventData: Omit<CalendarEvent, "id"> | CalendarEvent
    ) => {
        if ("id" in eventData) {
            updateEvent(eventData as CalendarEvent)
        } else {
            addEvent(eventData)
        }
    }

    // Render appropriate view based on current state
    const renderView = () => {
        const { currentDate, view } = viewState

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-lg">Loading...</p>
                </div>
            )
        }

        switch (view) {
            case "month":
                return (
                    <MonthView
                        currentDate={currentDate}
                        events={events}
                        onSelectDate={handleSelectDate}
                        onSelectEvent={handleSelectEvent}
                    />
                )
            case "week":
                return (
                    <WeekView
                        currentDate={currentDate}
                        events={events}
                        onSelectDate={handleSelectDate}
                        onSelectEvent={handleSelectEvent}
                    />
                )
            case "day":
                return (
                    <DayView
                        currentDate={currentDate}
                        events={events}
                        onSelectEvent={handleSelectEvent}
                    />
                )
            default:
                return null
        }
    }

    return (
        <div className="flex flex-col h-screen">
            <CalendarHeader
                currentDate={viewState.currentDate}
                view={viewState.view}
                onViewChange={handleViewChange}
                onDateChange={handleDateChange}
                onAddEvent={handleAddEvent}
            />

            <main className="flex-1 overflow-hidden">{renderView()}</main>

            <EventModal
                isOpen={modalState.isOpen}
                onClose={handleCloseModal}
                event={modalState.event}
                selectedDate={modalState.selectedDate}
                onSave={handleSaveEvent}
                onDelete={deleteEvent}
            />
        </div>
    )
}
