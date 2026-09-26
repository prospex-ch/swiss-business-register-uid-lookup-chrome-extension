# Chrome Web Store listing

Name and short description come from `_locales/*/messages.json` (`appName`, `appDescription`). The long descriptions below go into the Developer Dashboard, one per language. Category: Productivity (alternative: Tools). Privacy policy URL: the GitHub URL of `PRIVACY.md`.

Graphic assets in `store/assets/`:
- Screenshots (1280×800): `screenshot-<lang>-1.png` (hover card), `-2` (right-click matches), `-3` (toolbar search). Upload the `en` set to the default listing and the `de`/`fr` sets to those localized listings; the `it` listing falls back to the English ones.
- Small promo tile (440×280): `promo-small-440x280.png`.
- Store icon: taken from the package (`icons/icon-128.png`).

Single purpose statement: *Look up Swiss companies in the commercial register by UID or name.*

Permission justifications:
- `contextMenus`: right-click "Look up in the Swiss commercial register" on selected text.
- `storage`: saves the highlight setting and caches lookups for one hour.
- Host `www.zefix.admin.ch`: fetches register entries from the public Zefix API.
- Content script on all sites: finds Swiss UIDs in page text to show the company card on hover. Page content stays in the browser.

---

## en

Look up any Swiss company in the commercial register without leaving the page.

UIDs on web pages: every Swiss UID (CHE-123.456.789) on a page gets a dotted underline. Hover it to see the company card:
• company name and UID
• status: active, in liquidation or deleted
• legal form, registered office and canton
• the latest SHAB publication (new registration, change of officers, capital change, liquidation…)

Right-click lookup: select a company name or a UID, right-click and choose "Look up in the Swiss commercial register".

Toolbar search: type a company name or paste a UID. Shortcut: Alt+Shift+U.

Every card links to the full company profile on Prospex and to the cantonal register excerpt.

Useful for checking the UID on an invoice, a supplier's imprint, a tender document or a VAT number (CHE-… MWST / TVA / IVA).

Data from Zefix and SHAB, the public sources of the Swiss commercial register. The card is not an official register excerpt. No account, no tracking.

## de

Handelsregister Schweiz direkt im Browser: Firmen per UID-Nummer oder Firmenname prüfen, ohne die Seite zu verlassen.

UID auf Webseiten: Jede Schweizer UID (CHE-123.456.789) auf einer Seite wird gepunktet unterstrichen. Mit der Maus darüberfahren zeigt die Firmenkarte:
• Firmenname und UID
• Status: aktiv, in Liquidation oder gelöscht
• Rechtsform, Sitz und Kanton
• die letzte SHAB-Publikation (Neueintragung, Änderung der Organe, Kapitaländerung, Liquidation…)

Rechtsklick: Firmenname oder UID markieren, rechts klicken und "Im Handelsregister nachschlagen" wählen.

Firmensuche in der Symbolleiste: Firmennamen eingeben oder UID einfügen. Tastenkürzel: Alt+Shift+U.

Jede Karte verlinkt auf das vollständige Firmenprofil bei Prospex und auf den kantonalen Handelsregisterauszug.

Praktisch, um die UID auf einer Rechnung, im Impressum eines Lieferanten, in einer Ausschreibung oder eine MWST-Nummer (CHE-… MWST) zu prüfen.

Daten aus Zefix und SHAB, den öffentlichen Quellen des Handelsregisters. Die Karte ist kein amtlicher Handelsregisterauszug. Kein Konto, kein Tracking.

## fr

Le registre du commerce suisse dans votre navigateur : vérifiez une entreprise par numéro IDE ou par nom sans quitter la page.

Numéros IDE sur les pages web : chaque numéro IDE suisse (CHE-123.456.789) est souligné en pointillé. Au survol, la fiche de l'entreprise s'affiche :
• raison sociale et numéro IDE
• statut : active, en liquidation ou radiée
• forme juridique, siège et canton
• la dernière publication FOSC (nouvelle inscription, mutation des organes, modification du capital, liquidation…)

Clic droit : sélectionnez un nom d'entreprise ou un numéro IDE, faites un clic droit et choisissez « Rechercher dans le registre du commerce ».

Recherche dans la barre d'outils : saisissez un nom ou collez un numéro IDE. Raccourci : Alt+Maj+U.

Chaque fiche renvoie au profil complet de l'entreprise sur Prospex et à l'extrait du registre cantonal.

Pratique pour vérifier le numéro IDE d'une facture, des mentions légales d'un fournisseur, d'un appel d'offres ou un numéro de TVA (CHE-… TVA).

Données issues de Zefix et de la FOSC, les sources publiques du registre du commerce. La fiche n'est pas un extrait officiel du registre. Sans compte, sans suivi.

## it

Il registro di commercio svizzero nel browser: verifica un'azienda per numero IDI o per nome senza lasciare la pagina.

Numeri IDI nelle pagine web: ogni numero IDI svizzero (CHE-123.456.789) viene sottolineato con una linea punteggiata. Passandoci sopra con il mouse compare la scheda dell'azienda:
• ragione sociale e numero IDI
• stato: attiva, in liquidazione o cancellata
• forma giuridica, sede e cantone
• l'ultima pubblicazione FUSC (nuova iscrizione, modifica degli organi, modifica del capitale, liquidazione…)

Clic destro: seleziona il nome di un'azienda o un numero IDI, fai clic destro e scegli "Cerca nel registro di commercio".

Ricerca nella barra degli strumenti: digita un nome o incolla un numero IDI. Scorciatoia: Alt+Maiusc+U.

Ogni scheda rimanda al profilo completo dell'azienda su Prospex e all'estratto del registro cantonale.

Utile per verificare il numero IDI su una fattura, nelle note legali di un fornitore, in un bando di gara o un numero IVA (CHE-… IVA).

Dati da Zefix e FUSC, le fonti pubbliche del registro di commercio. La scheda non è un estratto ufficiale del registro. Nessun account, nessun tracciamento.
