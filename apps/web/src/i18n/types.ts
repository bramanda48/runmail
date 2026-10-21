import type en from "./locales/en";

export type MessageSchema = typeof en;

declare module "vue-i18n" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- typed schema augmentation
  export interface DefineLocaleMessage extends MessageSchema {}
}

export {};
