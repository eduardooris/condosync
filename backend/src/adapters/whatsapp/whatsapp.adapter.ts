export const WHATSAPP_ADAPTER = 'WHATSAPP_ADAPTER';

export interface IWhatsAppAdapter {
  sendMessage(to: string, message: string): Promise<void>;
  sendDocument(to: string, fileUrl: string, caption?: string): Promise<void>;
}
