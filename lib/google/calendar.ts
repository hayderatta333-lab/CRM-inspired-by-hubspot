import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Google service account credentials are not configured.");
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

export async function checkAvailability(
  date: string,
  durationMinutes: number
): Promise<{ start: string; end: string }[]> {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = getCalendarId();

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busy = res.data.calendars?.[calendarId]?.busy || [];

  const workStartHour = 9;
  const workEndHour = 18;
  const slotMs = durationMinutes * 60 * 1000;

  const freeSlots: { start: string; end: string }[] = [];
  let cursor = new Date(date);
  cursor.setHours(workStartHour, 0, 0, 0);
  const dayEndTime = new Date(date);
  dayEndTime.setHours(workEndHour, 0, 0, 0);

  while (cursor.getTime() + slotMs <= dayEndTime.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor.getTime() + slotMs);

    const overlaps = busy.some((b) => {
      if (!b.start || !b.end) return false;
      const busyStart = new Date(b.start);
      const busyEnd = new Date(b.end);
      return slotStart < busyEnd && slotEnd > busyStart;
    });

    if (!overlaps) {
      freeSlots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
    }

    cursor = new Date(cursor.getTime() + slotMs);
  }

  return freeSlots;
}

export async function createCalendarEvent(
  date: string,
  time: string,
  durationMinutes: number,
  customerName: string,
  customerPhone: string
): Promise<{ eventId: string; htmlLink: string | null }> {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = getCalendarId();

  const startDateTime = new Date(`${date}T${time}`);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Appointment: ${customerName}`,
      description: `Booked via WhatsApp. Customer phone: ${customerPhone}`,
      start: { dateTime: startDateTime.toISOString() },
      end: { dateTime: endDateTime.toISOString() },
    },
  });

  return {
    eventId: res.data.id || "",
    htmlLink: res.data.htmlLink || null,
  };
}
