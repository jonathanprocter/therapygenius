import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  attendees?: string[];
  isTherapySession: boolean;
  clientName?: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  totalEvents: number;
  therapySessions: number;
  otherEvents: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export function useCalendarEvents(date: Date) {
  // Format date to YYYY-MM-DD for API
  const startDate = format(date, 'yyyy-MM-dd');
  const endDate = format(date, 'yyyy-MM-dd');

  return useQuery<CalendarEventsResponse>({
    queryKey: ["/api/calendar/events", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/calendar/events?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error("Failed to fetch calendar events");
      }
      const data = await response.json();
      
      // Convert date strings to Date objects
      if (data.events) {
        data.events = data.events.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }));
      }
      
      return data;
    },
  });
}
