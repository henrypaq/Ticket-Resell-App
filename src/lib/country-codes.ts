export type CountryCode = {
  iso2: string;
  name: string;
  dial: string;
  flag: string;
};

/**
 * Curated, not exhaustive — this is a Montreal-based waitlist, so Canada
 * leads (and is the default) with the US right behind it, then a modest
 * spread of countries a McGill/Concordia-sized international student
 * population would actually need.
 */
export const COUNTRY_CODES: CountryCode[] = [
  { iso2: "CA", name: "Canada", dial: "1", flag: "🇨🇦" },
  { iso2: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { iso2: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { iso2: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { iso2: "BE", name: "Belgium", dial: "32", flag: "🇧🇪" },
  { iso2: "CH", name: "Switzerland", dial: "41", flag: "🇨🇭" },
  { iso2: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { iso2: "MX", name: "Mexico", dial: "52", flag: "🇲🇽" },
  { iso2: "BR", name: "Brazil", dial: "55", flag: "🇧🇷" },
  { iso2: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { iso2: "CN", name: "China", dial: "86", flag: "🇨🇳" },
  { iso2: "MA", name: "Morocco", dial: "212", flag: "🇲🇦" },
  { iso2: "SN", name: "Senegal", dial: "221", flag: "🇸🇳" },
  { iso2: "LB", name: "Lebanon", dial: "961", flag: "🇱🇧" },
  { iso2: "HT", name: "Haiti", dial: "509", flag: "🇭🇹" },
  { iso2: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
  { iso2: "KR", name: "South Korea", dial: "82", flag: "🇰🇷" },
  { iso2: "JP", name: "Japan", dial: "81", flag: "🇯🇵" },
  { iso2: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
];

export const DEFAULT_COUNTRY_ISO2 = "CA";

export function countryByIso2(iso2: string): CountryCode {
  return COUNTRY_CODES.find((c) => c.iso2 === iso2) ?? COUNTRY_CODES[0];
}
