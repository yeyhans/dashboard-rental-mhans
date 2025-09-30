/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    email: string;
    user?: {
      id: string;
      email?: string;
      [key: string]: any;
    };
  }
}


