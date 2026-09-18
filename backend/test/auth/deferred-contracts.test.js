import test from "node:test";

test.todo(
  "malformed JSON final response awaits an approved centralized JSON error contract",
);
test.todo(
  "unexpected HTTP error final response awaits an approved centralized JSON error contract",
);
test.todo(
  "credentialed CORS policy awaits approved deployment origins and topology",
);
test.todo("CSRF behavior awaits an approved cross-site policy and mechanism");
test.todo("session cookie SameSite awaits approved deployment topology");
test.todo("session cookie Domain awaits approved deployment topology");
