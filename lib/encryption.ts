import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY = process.env.ENCRYPTION_KEY || 'monetra-super-secret-key-32-chars-long'; // Should be 32 chars

export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY.padEnd(32).slice(0, 32)), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Return IV + Encrypted Text + Auth Tag
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  
  try {
    const [ivHex, encrypted, tagHex] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY.padEnd(32).slice(0, 32)), iv);
    
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData;
  }
}
