/**
 * Shared "is this worth reading out?" filters. Heritage-register imports
 * flood OSM and Wikidata with items that say nothing beyond "there is a
 * building at this address" — those are noise, not facts.
 */

/** "Marktstraße 12", "Hauptstr. 5a", "King Street 3" — address-as-name. */
const ADDRESS_TITLE =
  /^.+(?:straße|strasse|str\.|gasse|weg|platz|allee|ring|ufer|damm|markt|hof|street|road|lane|avenue|square)\s+\d+\s*[a-z]?$/i;

export function isAddressTitle(title: string): boolean {
  return ADDRESS_TITLE.test(title.trim());
}

/**
 * Descriptions that only restate "this is a building (here)" — including
 * the German heritage-register phrasings.
 */
const BORING_DESCRIPTION =
  /^(?:building|house|residential building|apartment (?:building|house)|commercial building|office building|architectural structure|Wohnhaus|Wohngebäude|Gebäude|Bauwerk|Wohn- und Geschäftshaus|Geschäftshaus|Mehrfamilienhaus|Einfamilienhaus|Bürogebäude|cultural (?:heritage )?(?:monument|property)|(?:protected |listed )?heritage (?:site|monument)|historic(?:al)? building|monument|Kulturdenkmal|Baudenkmal|denkmalgeschütztes (?:Gebäude|Haus)|Denkmal)(?:\s+(?:in|at|of|an der|am|auf|bei)\b.*)?$/i;

export function isBoringDescription(description: string): boolean {
  return BORING_DESCRIPTION.test(description.trim());
}
