export interface VoiceLog {
  id: string;
  userId?: string | number | null;
  sessionId: string;
  raw: string;
  intent: string;
  screen: string;
  field?: string | null;
  value?: string | null;
  success: boolean;
  timestamp: string;
}

export const SUPPORTED_VOICE_COMMANDS = [
  { category: 'Navigation', phrases: ['go to dashboard', 'open leads', 'go to meetings', 'open calendar', 'show organisations', 'open enquiries', 'go to quotation', 'open booking', 'open to do'] },
  { category: 'Search', phrases: ['search [name]', 'find [value]', 'look for [company]'] },
  { category: 'Create', phrases: ['create new lead', 'add new meeting', 'create enquiry', 'new quotation'] },
  { category: 'Lead Form Fill', phrases: ['customer name [value]', 'lead source [value]', 'lead status [value]', 'customer type [value]', 'contact person [value]', 'email [value]', 'phone [value]', 'city [value]', 'address [value]', 'save', 'reset', 'go back'] },
  { category: 'Meeting Fill', phrases: ['meeting type [value]', 'salesperson [value]', 'duration [value]', 'meeting status [value]', 'meeting note [value]', 'follow up note [value]', 'update', 'cancel'] },
  { category: 'Filters', phrases: ['show active leads', 'show scheduled meetings', "show today's meetings", 'show this month'] },
];
