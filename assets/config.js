/* ═══════════ YAHYA ALI ACADEMY · SETTINGS (edit these) ═══════════ */
window.ACADEMY = {
  supabaseUrl: "https://ebvrmxxfxujqlbxcigmo.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnJteHhmeHVqcWxieGNpZ21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDU2NjksImV4cCI6MjEwODE4MTY2OX0.X4PM9MtPrszEps5MG0rOGrqRKHYpU_ppvUXkddPqmp4",
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
