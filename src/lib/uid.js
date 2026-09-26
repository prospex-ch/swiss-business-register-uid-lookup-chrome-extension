// Swiss UID (Unternehmens-Identifikationsnummer / IDE / IDI) parsing.
//
// Classic script, no modules: the same file is loaded by the service worker
// (importScripts), the content script (manifest) and the popup (<script>).
(function (root) {
  const SBR = (root.SBR = root.SBR || {});

  const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4];

  // CHE-123.456.789, CHE123456789, CHE 123 456 789, CHE-123 456 789, with an
  // optional VAT/register suffix (MWST, TVA, IVA, VAT, HR, RC, RI) that stays
  // outside the match so it is not underlined.
  const SEP = "[\\s.\\u00A0\\u2019'\\-]?";
  const PATTERN_SOURCE = `\\bCHE[\\s\\-\\u2010-\\u2013.\\u00A0]?(\\d{3})${SEP}(\\d{3})${SEP}(\\d{3})(?!\\d)`;

  function checkDigit(first8) {
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += Number(first8[i]) * WEIGHTS[i];
    const rest = 11 - (sum % 11);
    if (rest === 11) return 0;
    if (rest === 10) return null; // never issued
    return rest;
  }

  function isValidDigits(digits) {
    if (!/^\d{9}$/.test(digits)) return false;
    const check = checkDigit(digits.slice(0, 8));
    return check !== null && check === Number(digits[8]);
  }

  /** "CHE-105.909.036 MWST" -> "CHE105909036", or "" if it is no valid UID. */
  function normalize(text) {
    if (!text) return "";
    const m = new RegExp(PATTERN_SOURCE, "i").exec(String(text).trim());
    if (!m) return "";
    const digits = m[1] + m[2] + m[3];
    return isValidDigits(digits) ? `CHE${digits}` : "";
  }

  /** True when the whole input is a UID (possibly with a suffix), not a name. */
  function looksLikeUid(text) {
    const t = String(text || "").trim();
    return /^CHE[\s\-.]?\d{3}[\s.]?\d{3}[\s.]?\d{3}(\s*(MWST|TVA|IVA|VAT|HR|RC|RI))?$/i.test(t);
  }

  function format(uid) {
    const d = String(uid || "").replace(/\D/g, "");
    if (d.length !== 9) return "";
    return `CHE-${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  }

  function slugPart(uid) {
    return format(uid).toLowerCase().replace(/\./g, "-");
  }

  /** Every valid UID in a string: [{ index, length, uid }]. */
  function findAll(text) {
    const out = [];
    if (!text || !/CHE/i.test(text)) return out;
    const re = new RegExp(PATTERN_SOURCE, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      const digits = m[1] + m[2] + m[3];
      if (isValidDigits(digits)) {
        out.push({ index: m.index, length: m[0].length, uid: `CHE${digits}` });
      }
    }
    return out;
  }

  SBR.uid = { normalize, looksLikeUid, format, slugPart, findAll, isValidDigits };
})(globalThis);
