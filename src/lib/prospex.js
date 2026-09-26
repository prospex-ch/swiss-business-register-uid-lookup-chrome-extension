// Links to prospex.ch company profiles.
(function (root) {
  const SBR = (root.SBR = root.SBR || {});

  const ORIGIN = "https://prospex.ch";

  /**
   * The profile URL for a UID. `/company/<uid>/` redirects to the canonical,
   * localized profile (`/fr/entreprises/nestle-sa-che-105-909-036/`).
   * `surface` is where the click came from: hover, context-menu or popup.
   */
  function profileUrl(uid, surface) {
    const slug = SBR.uid.slugPart(uid);
    if (!slug) return ORIGIN + "/";
    const params = new URLSearchParams({
      utm_source: "chrome-extension",
      utm_medium: "referral",
      utm_campaign: "uid-lookup",
    });
    if (surface) params.set("utm_content", surface);
    return `${ORIGIN}/company/${slug}/?${params}`;
  }

  function homeUrl(surface) {
    const params = new URLSearchParams({
      utm_source: "chrome-extension",
      utm_medium: "referral",
      utm_campaign: "uid-lookup",
    });
    if (surface) params.set("utm_content", surface);
    return `${ORIGIN}/?${params}`;
  }

  SBR.prospex = { profileUrl, homeUrl, ORIGIN };
})(globalThis);
