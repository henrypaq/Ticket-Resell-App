/**
 * Live "as you type" formatting for the national-number part of the phone
 * field. Purely presentational — the stored/submitted value is always the
 * composed E.164 string (see composePhone in the waitlist components), built
 * from the raw digits this strips back out.
 */

// Digit-group sizes for the national significant number, keyed by dial code
// (see src/lib/country-codes.ts). Not locale-perfect for every subscriber
// numbering plan — just a readable grouping matching how the number is
// typically written in that country.
const GROUPS_BY_DIAL: Record<string, number[]> = {
  "33": [1, 2, 2, 2, 2], // France: 6 12 34 56 78
  "44": [4, 6], // UK: 7911 123456
  "32": [3, 2, 2, 2], // Belgium: 470 12 34 56
  "41": [2, 3, 2, 2], // Switzerland: 79 123 45 67
  "49": [4, 7], // Germany: 1512 3456789
  "52": [2, 4, 4], // Mexico: 55 1234 5678
  "55": [2, 5, 4], // Brazil: 11 91234 5678
  "91": [5, 5], // India: 98765 43210
  "86": [3, 4, 4], // China: 138 1234 5678
  "212": [2, 2, 2, 3], // Morocco: 61 23 45 678
  "221": [2, 3, 2, 2], // Senegal: 77 123 45 67
  "961": [2, 3, 3], // Lebanon: 71 234 567
  "509": [4, 4], // Haiti: 3712 3456
  "84": [3, 3, 3], // Vietnam: 912 345 678
  "82": [2, 4, 4], // South Korea: 10 1234 5678
  "81": [2, 4, 4], // Japan: 90 1234 5678
  "61": [3, 3, 3], // Australia: 412 345 678
};

export function formatPhoneNational(digits: string, dial: string): string {
  const d = digits.slice(0, 15);

  // NANP (Canada/US, +1): (514) 555-0123
  if (dial === "1") {
    if (d.length === 0) return "";
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }

  const groups = GROUPS_BY_DIAL[dial];
  if (groups) {
    const parts: string[] = [];
    let idx = 0;
    for (const size of groups) {
      if (idx >= d.length) break;
      parts.push(d.slice(idx, idx + size));
      idx += size;
    }
    return parts.join(" ");
  }

  // Generic fallback for any dial code not in the table above: group in 3s.
  return d.replace(/(\d{3})(?=\d)/g, "$1 ");
}
