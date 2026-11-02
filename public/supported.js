// Loaded as the first child of <body>, before anything renders, so GOV.UK
// components don't flash their no-JS styles. Replaces the inline script in
// GOV.UK Frontend's page template, which the CSP doesn't allow.
document.body.className +=
  " js-enabled" +
  ("noModule" in HTMLScriptElement.prototype
    ? " govuk-frontend-supported"
    : "");
