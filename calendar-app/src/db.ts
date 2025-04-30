// Types for our calendar events
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  description?: string;
  color?: string;
}

// In-memory storage
let events: CalendarEvent[] = [];

// Generate a unique ID for events
const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Create a new event
export const createEvent = (eventData: Omit<CalendarEvent, 'id'>): CalendarEvent => {
  const newEvent = {
    ...eventData,
    id: generateId(),
  };
  events.push(newEvent);
  return newEvent;
};

// Read all events
export const getAllEvents = (): CalendarEvent[] => {
  return [...events];
};

// Read a single event
export const getEventById = (id: string): CalendarEvent | undefined => {
  return events.find(event => event.id === id);
};

// Update an event
export const updateEvent = (id: string, eventData: Partial<CalendarEvent>): CalendarEvent | null => {
  const index = events.findIndex(event => event.id === id);
  if (index === -1) return null;
  
  events[index] = {
    ...events[index],
    ...eventData,
  };
  return events[index];
};

// Delete an event
export const deleteEvent = (id: string): boolean => {
  const initialLength = events.length;
  events = events.filter(event => event.id !== id);
  return events.length !== initialLength;
};

// Clear all events (useful for testing)
export const clearEvents = (): void => {
  events = [];
}; 