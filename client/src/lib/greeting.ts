// Time-of-day greeting + a daily rotating quote for the dashboard.
// The quote is deterministic per day (and nudged per user) so it feels
// personal but stays stable through the day.

export function timeGreeting(language: string, name: string): string {
  const h = new Date().getHours();
  const no = h < 5 ? "God kveld" : h < 10 ? "God morgen" : h < 12 ? "God formiddag" : h < 17 ? "God ettermiddag" : "God kveld";
  const en = h < 5 ? "Good evening" : h < 10 ? "Good morning" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${language === "no" ? no : en}, ${name}`;
}

// [norsk, english]
const QUOTES: [string, string][] = [
  ["Gode ski er ingen tilfeldighet — de er dokumentert.", "Fast skis are no accident — they are documented."],
  ["Den som tester mest, gjetter minst.", "The one who tests the most guesses the least."],
  ["Hundredeler vinnes i smørebua, ikke bare i sporet.", "Hundredths are won in the wax cabin, not just on the track."],
  ["Dagens test er morgendagens forsprang.", "Today's test is tomorrow's head start."],
  ["Snøen forandrer seg. Notatene dine består.", "The snow changes. Your notes remain."],
  ["Magefølelse er fint. Data er bedre. Begge er best.", "Gut feeling is nice. Data is better. Both together are best."],
  ["Det finnes ikke dårlig føre — bare føre du ikke har testet ennå.", "There is no bad snow — only snow you haven't tested yet."],
  ["Flyt i sporet starter med orden i garasjen.", "Flow on the track starts with order in the garage."],
  ["Én god logg i dag sparer ti diskusjoner i mars.", "One good log today saves ten debates in March."],
  ["Vinnerskia ble valgt lenge før startskuddet.", "The winning skis were chosen long before the start gun."],
  ["Test som en forsker. Smør som en kunstner.", "Test like a scientist. Wax like an artist."],
  ["De beste lagene husker ikke best — de noterer best.", "The best teams don't remember best — they take the best notes."],
  ["Været bestemmer mye. Forberedelsene bestemmer resten.", "The weather decides a lot. Preparation decides the rest."],
  ["Hver runde i testbakken er et innskudd på resultatkontoen.", "Every run on the test hill is a deposit in the results account."],
  ["Glid er fysikk. Gode valg er erfaring satt i system.", "Glide is physics. Good choices are experience, systematised."],
  ["Ingen husker den nest raskeste skien.", "Nobody remembers the second-fastest ski."],
  ["Kald morgen, varm smørebu, klare svar.", "Cold morning, warm wax cabin, clear answers."],
  ["Struktur i dataene gir struktur under skiene.", "Structure in your data puts structure under your skis."],
  ["Tvil er bare en test du ikke har kjørt ennå.", "Doubt is just a test you haven't run yet."],
  ["Små marginer, store dager.", "Small margins, big days."],
  ["Det du målte i går, slår det du tror i dag.", "What you measured yesterday beats what you assume today."],
  ["Godt skivalg høres ikke — det synes på resultatlisten.", "A great ski pick makes no sound — it shows on the results list."],
  ["Én test til. Alltid én test til.", "One more test. Always one more test."],
  ["Vinteren er kort. Kunnskapen varer.", "Winter is short. Knowledge lasts."],
  ["Presisjon i bua gir ro på start.", "Precision in the cabin brings calm at the start."],
  ["Alle snakker om følelsen. Du har tallene også.", "Everyone talks about the feeling. You have the numbers too."],
  ["Systematikk er den stilleste superkraften i langrenn.", "System is the quietest superpower in skiing."],
  ["I dag legger du grunnlaget noen takker deg for på pallen.", "Today you lay the groundwork someone will thank you for on the podium."],
];

/** Every account rotates through the whole bank, offset by a hash of their
 * name — two teammates see different quotes on the same day, and everyone
 * gets a fresh one daily. */
export function dailyQuote(language: string, seedName?: string): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  let hash = 0;
  for (const ch of seedName ?? "") hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const idx = (dayOfYear + hash) % QUOTES.length;
  return language === "no" ? QUOTES[idx][0] : QUOTES[idx][1];
}
