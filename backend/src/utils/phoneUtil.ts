// src/utils/phoneUtil.ts
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalizes a phone number to E.164 format.
 * Returns null if the number is invalid.
 *
 * @param input Raw phone number string
 * @param country Optional ISO‑2 country code used for numbers without a leading '+'
 */
export function normalizePhoneNumber(input: string, country?: string): string | null {
  const trimmed = input.trim();
  const phone = parsePhoneNumberFromString(trimmed, country as any);
  if (phone && phone.isValid()) {
    return phone.number; // E.164 format, e.g. +919876543210
  }
  return null;
}
