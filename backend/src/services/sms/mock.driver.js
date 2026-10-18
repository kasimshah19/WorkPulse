import { v4 as uuidv4 } from 'uuid';

/**
 * Mock SMS Driver
 * Prints a clear visual boxed line to stdout and simulates instant delivery.
 */
export const sendMockSms = async (phone, text) => {
  const messageId = `mock-${uuidv4()}`;
  const border = '═'.repeat(Math.max(text.length + 20, 60));

  console.log(`\n╔${border}╗`);
  console.log(`║ [MOCK SMS] to ${phone.padEnd(16)} : ${text}`);
  console.log(`║ MessageId: ${messageId}`);
  console.log(`╚${border}╝\n`);

  return {
    provider: 'mock',
    status: 'SENT',
    messageId,
  };
};
