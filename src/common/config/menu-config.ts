export const MENU_CONFIG_MAP = {
  quotation: {
    modelName: 'QuoteHeader',
    primaryKey: 'QuoteHeaderSid'
  },
  enquiry: {
    modelName: 'EnquiryHeader', 
    primaryKey: 'EnquiryHeaderSid'
  },
  booking : {
    modelName: 'BookingHeader',
    primaryKey: 'BookingHeaderSid'
  },
  masterJob : {
    modelName: 'MasterJob',
    primaryKey: 'MasterJobSid'
  }
} as const;

