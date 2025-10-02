import { db } from './db';
import { sessions, documents } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface AppointmentSection {
  appointmentNumber: number;
  content: string;
  date?: string;
  billingCode?: string;
  time?: string;
}

export function parseProgressNotesDocument(documentContent: string): AppointmentSection[] {
  const appointments: AppointmentSection[] = [];
  
  // Use \s+ to match any whitespace including non-breaking spaces (char code 160)
  const appointmentPattern = /APPOINTMENT\s+#(\d+)/gi;
  const matches = Array.from(documentContent.matchAll(appointmentPattern));
  
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const appointmentNumber = parseInt(currentMatch[1]);
    const startIndex = currentMatch.index!;
    
    const endIndex = i < matches.length - 1 
      ? matches[i + 1].index! 
      : documentContent.length;
    
    let appointmentContent = documentContent.substring(startIndex, endIndex).trim();
    
    const dateMatch = appointmentContent.match(/^([A-Z]{3}\s+\d{1,2})/);
    const date = dateMatch ? dateMatch[1] : undefined;
    
    const billingCodeMatch = appointmentContent.match(/BILLING CODE:\s*([\w\d]+)/);
    const billingCode = billingCodeMatch ? billingCodeMatch[1] : undefined;
    
    const timeMatch = appointmentContent.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)\s*–\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    const time = timeMatch ? timeMatch[1] : undefined;
    
    appointments.push({
      appointmentNumber,
      content: appointmentContent,
      date,
      billingCode,
      time
    });
  }
  
  return appointments;
}

export async function updateSessionsWithParsedAppointments(
  clientId: string,
  documentId: string
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  try {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document || !document.content) {
      return {
        success: false,
        updated: 0,
        errors: ['Document not found or has no content']
      };
    }

    const parsedAppointments = parseProgressNotesDocument(document.content);
    console.log(`Parsed ${parsedAppointments.length} appointments from document`);

    const clientSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.clientId, clientId));

    for (const session of clientSessions) {
      if (!session.notes) continue;
      
      const appointmentMatch = session.notes.match(/Appointment #(\d+)/i);
      if (!appointmentMatch) continue;
      
      const appointmentNumber = parseInt(appointmentMatch[1]);
      
      const matchedAppointment = parsedAppointments.find(
        apt => apt.appointmentNumber === appointmentNumber
      );

      if (matchedAppointment) {
        try {
          await db
            .update(sessions)
            .set({
              notes: matchedAppointment.content,
              updatedAt: new Date()
            })
            .where(eq(sessions.id, session.id));
          
          updated++;
          console.log(`Updated session ${session.id} with Appointment #${appointmentNumber} content`);
        } catch (error) {
          const errorMsg = `Failed to update session ${session.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      } else {
        errors.push(`No matching appointment found for session ${session.id} (Appointment #${appointmentNumber})`);
      }
    }

    return {
      success: true,
      updated,
      errors
    };
  } catch (error) {
    console.error('Error updating sessions:', error);
    return {
      success: false,
      updated,
      errors: [`Failed to process: ${error}`]
    };
  }
}
