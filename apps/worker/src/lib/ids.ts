import { init } from "@paralleldrive/cuid2";

// Lazy: init({ length: 32 }) panggil crypto.getRandomValues - haram di global
// scope Workers (Disallowed operation ... within global scope). Ditunda sampai
// pemanggilan pertama yang selalu terjadi di dalam request handler.
let generate: (() => string) | null = null;

export function createId(): string {
  generate ??= init({ length: 32 });
  return generate();
}
