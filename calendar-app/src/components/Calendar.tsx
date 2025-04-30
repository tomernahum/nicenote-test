import { useCallback, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg, EventChangeArg } from '@fullcalendar/core';
import { CalendarEvent, createEvent, getAllEvents, updateEvent, deleteEvent } from '../db';

export const Calendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    // Load initial events
    setEvents(getAllEvents());
  }, []);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const title = prompt('Please enter a title for your event:');
    if (!title) return;

    const newEvent = createEvent({
      title,
      start: selectInfo.start,
      end: selectInfo.end,
      allDay: selectInfo.allDay,
    });

    setEvents(getAllEvents());
  }, []);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    if (confirm('Would you like to delete this event?')) {
      deleteEvent(clickInfo.event.id);
      setEvents(getAllEvents());
    }
  }, []);

  const handleEventChange = useCallback((changeInfo: EventChangeArg) => {
    const updatedEvent = updateEvent(changeInfo.event.id, {
      start: changeInfo.event.start || new Date(),
      end: changeInfo.event.end || new Date(),
    });
    
    if (updatedEvent) {
      setEvents(getAllEvents());
    }
  }, []);

  return (
    <div className="calendar-container">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        initialView="dayGridMonth"
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        events={events}
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventChange={handleEventChange}
      />
    </div>
  );
}; 