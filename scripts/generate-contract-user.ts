import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { UserContractDocument, type UserContractData } from '../src/lib/pdf/components/contract/UserContractDocument';
import { generatePdfBuffer } from '../src/lib/pdf/core/pdfService';

try {
  (process as any).loadEnvFile('.env.local');
} catch {
  try {
    (process as any).loadEnvFile('.env');
  } catch {
    console.warn('⚠️  No .env.local or .env found — relying on process env');
  }
}

const argv = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : undefined;
};
const hasFlag = (name: string): boolean => argv.includes(`--${name}`);

const userIdRaw = getArg('user-id');
const fixData = hasFlag('fix-data');

if (!userIdRaw) {
  console.error('Usage: npx tsx scripts/generate-contract-user.ts --user-id <id> [--fix-data]');
  process.exit(1);
}
const userId = parseInt(userIdRaw, 10);
if (isNaN(userId)) {
  console.error(`Invalid user-id: ${userIdRaw}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_URL = process.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://workers.mariohans.cl';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log(`🌐 Target Supabase: ${SUPABASE_URL}`);
console.log(`☁️  Worker R2: ${WORKER_URL}`);
console.log(`👤 User ID: ${userId}${fixData ? ' (--fix-data)' : ''}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  if (fixData && userId === 196) {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        apellido: 'Letelier',
        rut: '10.942.312-2',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw new Error(`Data fix failed: ${error.message}`);
    console.log('✅ Data fixed: apellido=Letelier, rut=10.942.312-2');
  }

  const { data: profile, error: readErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (readErr || !profile) throw new Error(`User ${userId} not found: ${readErr?.message}`);

  if (!profile.email || !profile.nombre) {
    throw new Error('Profile missing required fields (email, nombre)');
  }

  const terminosAceptados =
    profile.terminos_aceptados === true ||
    profile.terminos_aceptados === '1' ||
    (profile.terminos_aceptados as any) === 1;

  const contractData: UserContractData = {
    user_id: profile.user_id,
    nombre: profile.nombre || '',
    apellido: profile.apellido || '',
    email: profile.email || '',
    rut: profile.rut || '',
    direccion: profile.direccion || '',
    ciudad: profile.ciudad || '',
    pais: profile.pais || 'Chile',
    telefono: profile.telefono || '',
    instagram: profile.instagram || undefined,
    fecha_nacimiento: profile.fecha_nacimiento || undefined,
    tipo_cliente: (profile.tipo_cliente as 'natural' | 'empresa') || 'natural',
    empresa_nombre: profile.empresa_nombre || undefined,
    empresa_rut: profile.empresa_rut || undefined,
    empresa_ciudad: profile.empresa_ciudad || undefined,
    empresa_direccion: profile.empresa_direccion || undefined,
    url_firma: profile.url_firma || undefined,
    url_rut_anverso: profile.url_rut_anverso || undefined,
    url_rut_reverso: profile.url_rut_reverso || undefined,
    url_empresa_erut: profile.url_empresa_erut || undefined,
    new_url_e_rut_empresa: profile.new_url_e_rut_empresa || undefined,
    terminos_aceptados: terminosAceptados,
  };

  console.log('📋 Contract data prepared:', {
    user_id: contractData.user_id,
    nombre: `${contractData.nombre} ${contractData.apellido}`,
    rut: contractData.rut,
    tipo_cliente: contractData.tipo_cliente,
    terminos_aceptados: contractData.terminos_aceptados,
  });

  const pdfBuffer = await generatePdfBuffer({
    document: React.createElement(UserContractDocument, { data: contractData }),
  });

  const header = String.fromCharCode(...new Uint8Array(pdfBuffer).slice(0, 4));
  if (!header.startsWith('%PDF')) {
    throw new Error(`Invalid PDF header: ${header}`);
  }
  console.log(`✅ PDF generated (${pdfBuffer.byteLength} bytes, header ${header})`);

  const timestamp = Date.now();
  const ymd = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `contract_${userId}_${ymd}_${timestamp}.pdf`;

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), filename);
  form.append('documentType', 'contract');
  form.append('userId', String(userId));

  const uploadRes = await fetch(`${WORKER_URL}/upload-file-only`, {
    method: 'POST',
    body: form,
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`R2 upload failed: ${uploadRes.status} — ${errText}`);
  }
  const uploadJson = (await uploadRes.json()) as { url?: string };
  const contractUrl = uploadJson.url;
  if (!contractUrl) throw new Error(`R2 upload returned no url: ${JSON.stringify(uploadJson)}`);
  console.log(`✅ Uploaded to R2: ${contractUrl}`);

  const { error: updateErr } = await supabase
    .from('user_profiles')
    .update({
      url_user_contrato: contractUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);
  console.log(`✅ DB updated: user_profiles.url_user_contrato`);
  console.log('⏭️  Email skipped (by design)');
  console.log('\n🎉 Done. Contract URL:', contractUrl);
}

main().catch((err) => {
  console.error('💥 Error:', err);
  process.exit(1);
});
