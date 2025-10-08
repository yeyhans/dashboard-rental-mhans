/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { User } from '@supabase/supabase-js';

declare namespace App {
  interface Locals {
    email: string;
    user?: User;
    adminRole?: string;
    isExtendedSession?: boolean;
  }
}


