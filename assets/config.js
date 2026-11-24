/* ═══════════ YAHYA ALI ACADEMY · SETTINGS (edit these) ═══════════ */
window.ACADEMY = {
  /* Backend: "academy" section inside the ember-os Supabase project (acad_* tables). Move to its own project later by changing these two lines. */
  supabaseUrl: "https://dwfelduzybgtqbyuvlse.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZmVsZHV6eWJndHFieXV2bHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODQwODEsImV4cCI6MjEwNzQ2MDA4MX0.LFQqwnvmsyHlEtoOOqkixkmVRGR1IPW43QX7KeHfdds",
  coursePrice: 5000,
  instagram: "https://www.instagram.com/yahyaalii.bnb/",

  /* Contact: left empty on purpose until Yahya shares the numbers. Empty values are hidden on the site. */
  whatsapp: "",          // e.g. "923001234567"
  whatsappDisplay: "",
  email: "",

  /* Online gateway (Safepay / JazzCash / Easypaisa merchant). When set, students get a "Pay online" button
     and access unlocks automatically from the gateway webhook. Leave null to use manual verification only. */
  gateway: null,         // e.g. { name: "Safepay", checkoutFn: "safepay-checkout" }

  /* Manual payment accounts shown to students. Empty rows are hidden. */
  payments: {
    jazzcash: { "Account title": "", "JazzCash number": "" },
    easypaisa: { "Account title": "", "Easypaisa number": "" },
    bank: { "Bank": "", "Account title": "", "Account number": "", "IBAN": "" },
  },
};
