import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { commonStyles, budgetStyles } from '../../utils/styles';
import { getCurrentDateFormatted } from '../../utils/formatters';
import { CompanyInfo } from '../common/CompanyInfo';

/**
 * User Contract PDF Document Component
 * For generating standalone user contracts (without orders)
 * Used when users sign up and accept terms & conditions
 * Based on frontend/src/pages/contract-pdf/[userId].astro
 */

export interface UserContractData {
  user_id: number;
  nombre: string;
  apellido: string;
  email: string;
  rut: string;
  direccion: string;
  ciudad: string;
  pais?: string;
  telefono: string;
  instagram?: string;
  fecha_nacimiento?: string;
  tipo_cliente?: 'natural' | 'empresa';
  empresa_nombre?: string;
  empresa_rut?: string;
  empresa_ciudad?: string;
  empresa_direccion?: string;
  url_firma?: string;
  url_rut_anverso?: string;
  url_rut_reverso?: string;
  url_empresa_erut?: string;
  new_url_e_rut_empresa?: string;
  terminos_aceptados?: boolean;
}

export const UserContractDocument: React.FC<{ data: UserContractData }> = ({ data }) => {
  const isCompany = data.tipo_cliente === 'empresa';
  const contractNumber = `${data.user_id}-${Date.now().toString().slice(-6)}`;

  return (
    <Document>
      {/* Page 1: Header + Client Info + Contract Introduction */}
      <Page size="A4" style={commonStyles.page}>
        {/* Header with logo and title */}
        <View style={budgetStyles.budgetHeader}>
          <Image
            src="https://media.mariohans.cl/logos/Recurso%2016%403x.png"
            style={{ width: 120, height: 'auto' }}
          />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold' }}>
              CONTRATO DE ARRIENDO
            </Text>
            <Text style={{ fontSize: 11, marginTop: 5 }}>
              N° {contractNumber}
            </Text>
            <Text style={{ fontSize: 11, marginTop: 3 }}>
              {getCurrentDateFormatted()}
            </Text>
          </View>
        </View>

        {/* Client Information */}
        <View style={{ backgroundColor: '#f8f9fa', padding: 15, borderRadius: 6, border: '1pt solid #000000', marginBottom: 15 }}>
          <View style={{ flexDirection: 'row', gap: 15 }}>
            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Nombre:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.nombre} {data.apellido}</Text>
              </View>
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>RUT:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.rut}</Text>
              </View>
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Email:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.email}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Teléfono:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.telefono}</Text>
              </View>
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Dirección:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.direccion}</Text>
              </View>
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Ciudad:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.ciudad}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              {isCompany && (
                <>
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Empresa:</Text>
                    <Text style={{ fontSize: 9, color: '#000000' }}>{data.empresa_nombre}</Text>
                  </View>
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>RUT Empresa:</Text>
                    <Text style={{ fontSize: 9, color: '#000000' }}>{data.empresa_rut}</Text>
                  </View>
                </>
              )}
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Tipo Cliente:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{isCompany ? 'Empresa' : 'Persona Natural'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contract Introduction */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10, color: '#000000' }}>
            CONTRATO DE ARRIENDO DE BIENES MUEBLES
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 8, textAlign: 'justify', lineHeight: 1.4 }}>
            En Santiago de Chile, a {getCurrentDateFormatted()}, comparecen por una parte Hans Salinas SpA, Rol Único Tributario N° 77.892.569-9, representada legalmente por Mario Alberto Hans Salinas, cédula de identidad nacional N° 16.135.586-0, ambos con domicilio para estos efectos en Jose Victorino Lastarria 394, departamento N° 83, comuna de Santiago, ciudad de Santiago, en adelante "LA PARTE ARRENDADORA" o "LA ARRENDADORA"; y por la otra, {isCompany ? `${data.empresa_nombre}, Rol Único Tributario N° ${data.empresa_rut}, representada legalmente por ` : ''}{data.nombre} {data.apellido}, cédula de identidad nacional N° {data.rut}, {isCompany ? 'ambos ' : ''}con domicilio en {data.direccion}, en adelante "LA PARTE ARRENDATARIA" o "EL ARRENDATARIO"
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            La parte ARRENDADORA y la parte ARRENDATARIA, que en adelante podrán ser denominadas individualmente como "la parte" y conjuntamente como "las partes", reconociéndose capacidad legal suficiente para contratar y obligarse recíprocamente, y siendo responsable de la veracidad de sus declaraciones.
          </Text>
        </View>

        {/* EXPONEN Section */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#000000' }}>EXPONEN</Text>
          <View style={{ paddingLeft: 15 }}>
            <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
              1. Que la PARTE ARRENDADORA es propietaria del bien mueble o conjunto de bienes muebles, en adelante, "el bien mueble", que se individualiza en el (los) Anexo(s) del presente Contrato.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
              2. Que el(los) bien(es) mueble(s) se encuentra(n) en perfecto estado de conservación.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
              3. Que ambas partes conocen y aceptan las características y el estado de uso y conservación del bien mueble, de acuerdo con lo declarado.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
              4. Que la PARTE ARRENDATARIA está interesada en el arrendamiento de dicho bien mueble por los usos y disfrutes, y la PARTE ARRENDADORA consiente dicha cesión.
            </Text>
            <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
              5. Y que, habiendo llegado las partes a un entendimiento pleno y perfecto sobre la materia de sus voluntades, formalizan su acuerdo respecto al arrendamiento de este(os) bien(s) mueble(s), en adelante, el "Contrato", con el objeto de constituir y regular su acuerdo, el cual se rige por las siguientes:
            </Text>
          </View>
        </View>
      </Page>

      {/* Page 2: Cláusulas (Primera a Cuarta) */}
      <Page size="A4" style={commonStyles.page}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#000000' }}>CLÁUSULAS</Text>

        {/* PRIMERA: OBJETO DEL CONTRATO */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            PRIMERA: OBJETO DEL CONTRATO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            LA ARRENDADORA entrega en arriendo al ARRENDATARIO, quien acepta, el (los) bien(es) mueble(s) descrito(s) en el(los) Anexo(s) de este contrato, con cuanto lo sea inherente y accesorio, el (los) cual forma(n) parte integrante del mismo.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            La PARTE ARRENDATARIA declara que ha revisado suficientemente dicho(s) bien(es) mueble(s), confirmando que se encuentra(n) en perfecto estado para el uso que consistirá su destino.
          </Text>
        </View>

        {/* SEGUNDA: USO O DESTINO */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            SEGUNDA: USO O DESTINO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            La PARTE ARRENDATARIA se obliga a darle uso al bien(es) mueble(s), única y exclusivamente, en actividades relacionadas con la fotografía y producción audiovisual.
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Dicho uso no podrá ser modificado por la PARTE ARRENDATARIA sin el consentimiento previo, expreso y por escrito de la PARTE ARRENDADORA.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El incumplimiento de cualquiera de estos requisitos será motivo de resolución del Contrato.
          </Text>
        </View>

        {/* TERCERA: DURACIÓN DEL ARRIENDO */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            TERCERA: DURACIÓN DEL ARRIENDO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            El presente Contrato se entenderá firmado en aquella fecha correspondiente a la creación de la cuenta de USUARIO en el Sitio web https://rental.mariohans.cl/, sin embargo, comenzará a regir desde la fecha de la aceptación de presupuesto realizada a través de dicho sitio web, fecha que constará en el (los) Anexo(s) del presente Contrato.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO deberá crearse una cuenta y un usuario a través del sitio web https://rental.mariohans.cl/, donde se encontrará identificado mediante su nombre, dirección de correo electrónico y datos necesarios para el presente Contrato.
          </Text>
        </View>

        {/* CUARTA: ENTREGA */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            CUARTA: ENTREGA
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            La PARTE ARRENDADORA hará entrega del bien(es) mueble(s) objeto de este Contrato, poniéndolo en poder de la PARTE ARRENDATARIA, en el horario y fecha estipulada en el Anexo(s) del presente Contrato en el domicilio señalado por el ARRENDADOR. A partir de esta entrega, la PARTE ARRENDATARIA se hace cargo de las responsabilidades derivadas de su tenencia y uso.
          </Text>
        </View>
      </Page>

      {/* Page 3: Cláusulas (Quinta a Séptima) */}
      <Page size="A4" style={commonStyles.page}>
        {/* QUINTA: PRECIO Y FORMA DE PAGO */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            QUINTA: PRECIO Y FORMA DE PAGO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            El precio del arriendo de los bienes individualizados en (los) Anexo(s) del presente Contrato será el establecido en el Anexo correspondiente, el cual deberá ser pagado por EL ARRENDATARIO, en las condiciones que el correspondiente Anexo determine.
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 8, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO deberá pagar una reserva por el arriendo de los bienes, lo cual corresponde al 25% del valor total del arriendo. El monto restante deberá ser pagado al momento de la entrega de los bienes.
          </Text>

          {/* Bank Info */}
          <View style={{ backgroundColor: '#f8f9fa', padding: 10, borderRadius: 4, marginBottom: 8 }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>
              El monto correspondiente a la reserva deberá ser pagado mediante transferencia bancaria a:
            </Text>
            <CompanyInfo />
          </View>

          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            o a través del sistema de pago que se encuentre disponible en el sitio web https://rental.mariohans.cl/
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El saldo restante, correspondiente al 75% del valor total del arriendo, deberá ser pagado en su totalidad antes o en el momento de la devolución por parte de la ARRENDATARIA de los bienes arrendados.
          </Text>
        </View>

        {/* SEXTA: ENTREGA Y DEVOLUCIÓN DE LOS EQUIPOS */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            SEXTA: ENTREGA Y DEVOLUCIÓN DE LOS EQUIPOS
          </Text>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
              1. LA ARRENDADORA entregará los equipos al ARRENDATARIO en el estado descrito en el(los) Anexo(s), previa revisión conjunta.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
              2. EL ARRENDATARIO se compromete a devolver los equipos en las mismas condiciones en que fueron entregados, salvo el desgaste normal por uso.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
              3. La entrega y devolución de los equipos se realizará en el domicilio señalado por el ARRENDADOR, en horario previamente acordado.
            </Text>
            <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
              4. Los bienes deben ser entregados limpios y secos. En caso contrario, LA ARRENDADORA podrá cobrar costos de limpieza especializada y reparación.
            </Text>
          </View>
        </View>

        {/* SÉPTIMA: REPARACIONES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            SÉPTIMA: REPARACIONES Y RESPONSABILIDAD POR DAÑOS
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            En el caso de las reparaciones al bien mueble que deban efectuarse durante la vigencia de este Contrato, serán de cargo de la PARTE ARRENDATARIA. Dichas reparaciones deberán realizarse en servicios técnicos autorizados.
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Si existe una destrucción total de la cosa, una pérdida total de utilidad o destrucción de más del 50% de los equipos, LA PARTE ARRENDATARIA deberá pagar al ARRENDADOR el valor total del equipo.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO deberá efectuar las reparaciones o el reemplazo del equipo dentro de un plazo máximo de 10 días hábiles.
          </Text>
        </View>
      </Page>

      {/* Page 4: Cláusulas (Octava a Décima) */}
      <Page size="A4" style={commonStyles.page}>
        {/* OCTAVA: OBLIGACIONES DE LAS PARTES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            OCTAVA: OBLIGACIONES DE LAS PARTES
          </Text>

          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#000000' }}>
            Obligaciones del ARRENDADOR:
          </Text>
          <View style={{ paddingLeft: 10, marginBottom: 8 }}>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              1. Entregar los equipos en condiciones óptimas de uso.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              2. Mantener al bien mueble en estado de servir para el fin que ha sido arrendado.
            </Text>
            <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
              3. Librar a la PARTE ARRENDATARIA de toda turbación o embarazo en el goce del bien mueble.
            </Text>
          </View>

          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#000000' }}>
            Obligaciones del ARRENDATARIO:
          </Text>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              1. Verificar las condiciones físicas y de funcionamiento de todos los bienes al momento del retiro.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              2. Utilizar los equipos exclusivamente para los fines declarados.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              3. Pagar oportunamente las rentas de arriendo.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              4. No subarrendar, transferir ni ceder los equipos a terceros.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              5. Asumir la responsabilidad por daños físicos y/o de operabilidad.
            </Text>
            <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
              6. Restituir inmediatamente el bien mueble una vez terminado el presente Contrato.
            </Text>
          </View>
        </View>

        {/* NOVENA: GARANTÍAS Y MULTAS */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            NOVENA: GARANTÍAS Y MULTAS POR RETRASO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            No se exigirá una garantía monetaria debido a que el Contrato formaliza el compromiso entre las partes. No obstante, EL ARRENDATARIO responderá por los daños o pérdidas que puedan sufrir los equipos durante el periodo de arriendo.
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            En caso de incumplimiento del plazo de devolución, se aplicará una multa equivalente al valor de un día de arriendo por cada día de retraso.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            EL ARRENDATARIO podrá desistir del arrendamiento notificando con al menos 48 horas de antelación. En este caso, el monto pagado en concepto de reserva no será reembolsado.
          </Text>
        </View>

        {/* DÉCIMA: RESPONSABILIDAD */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA: RESPONSABILIDAD
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            A partir del momento en que el ARRENDATARIO retire los bienes, asumirá plena responsabilidad por la custodia, transporte, uso y conservación de los mismos.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO será responsable de cualquier daño, pérdida, deterioro o destrucción que sufran los equipos, incluyendo aquellos ocurridos durante el transporte.
          </Text>
        </View>
      </Page>

      {/* Page 5: Cláusulas finales + Firmas */}
      <Page size="A4" style={commonStyles.page}>
        {/* DÉCIMA PRIMERA: MODIFICACIONES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA PRIMERA: MODIFICACIONES AL CONTRATO
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            LA ARRENDADORA se reserva el derecho de modificar los términos y condiciones del presente Contrato cuando ello sea necesario. Toda modificación será notificada a través de la plataforma https://rental.mariohans.cl/.
          </Text>
        </View>

        {/* DÉCIMA SEGUNDA: RESOLUCIÓN */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA SEGUNDA: RESOLUCIÓN DEL CONTRATO
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El incumplimiento de las obligaciones legales o contractuales dará derecho a la otra parte a resolver el Contrato. En caso de incumplimiento grave, LA ARRENDADORA podrá proceder a la eliminación de la cuenta de usuario del ARRENDATARIO en la plataforma.
          </Text>
        </View>

        {/* DÉCIMA TERCERA: TERMINACIÓN ANTICIPADA */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA TERCERA: TERMINACIÓN ANTICIPADA
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            El presente Contrato podrá darse por terminado:
          </Text>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>1. Por mutuo acuerdo de las partes.</Text>
            <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>2. Por incumplimiento de obligaciones.</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.4 }}>3. Por devolución anticipada de los equipos.</Text>
          </View>
        </View>

        {/* DÉCIMA CUARTA: NOTIFICACIONES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA CUARTA: NOTIFICACIONES
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            Las notificaciones puedan ser realizadas mediante medios electrónicos a las siguientes direcciones:
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 2 }}>
            <Text style={{ fontWeight: 'bold' }}>ARRENDADORA:</Text> rental.mariohans@gmail.com
          </Text>
          <Text style={{ fontSize: 9 }}>
            <Text style={{ fontWeight: 'bold' }}>ARRENDATARIO:</Text> {data.email}
          </Text>
        </View>

        {/* DÉCIMA QUINTA: LEGISLACIÓN */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA QUINTA: LEGISLACIÓN APLICABLE
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            Para todos los efectos legales derivados del presente Contrato, las partes fijan domicilio en la ciudad de Santiago, y se someten a la jurisdicción de sus tribunales de justicia, conforme a la legislación vigente en la República de Chile.
          </Text>
        </View>

        {/* Firmas */}
        <View style={{ marginTop: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 6, border: '1pt solid #000000' }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#000000' }}>
            FIRMAS
          </Text>

          <View style={{ flexDirection: 'row', gap: 30 }}>
            {/* Arrendador Signature */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 8, color: '#000000' }}>ARRENDADOR</Text>
              <Image
                src="https://media.mariohans.cl/firmas/firma_mario_hans.png"
                style={{ width: 120, height: 60, marginBottom: 10 }}
              />
              <View style={{
                borderTop: '1pt solid #000000',
                width: '100%',
                paddingTop: 8,
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000', marginBottom: 2 }}>
                  Mario Alberto Hans Salinas
                </Text>
                <Text style={{ fontSize: 8, color: '#000000', marginBottom: 2 }}>
                  RUT: 16.135.586-0
                </Text>
                <Text style={{ fontSize: 7, color: '#000000', marginBottom: 2 }}>
                  EN REPRESENTACIÓN DE
                </Text>
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#000000' }}>
                  Hans Salinas SpA
                </Text>
                <Text style={{ fontSize: 8, color: '#000000', marginTop: 2 }}>
                  RUT: 77.892.569-9
                </Text>
              </View>
            </View>

            {/* Arrendatario Signature */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 8, color: '#000000' }}>ARRENDATARIO</Text>
              {data.url_firma && (
                <Image
                  src={data.url_firma}
                  style={{ width: 120, height: 60, marginBottom: 10 }}
                />
              )}
              {!data.url_firma && (
                <View style={{ width: 120, height: 60, marginBottom: 10, backgroundColor: '#e9ecef', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, color: '#666' }}>Firma Pendiente</Text>
                </View>
              )}
              <View style={{
                borderTop: '1pt solid #000000',
                width: '100%',
                paddingTop: 8,
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000', marginBottom: 2 }}>
                  {data.nombre} {data.apellido}
                </Text>
                <Text style={{ fontSize: 8, color: '#000000', marginBottom: 2 }}>
                  RUT: {data.rut}
                </Text>
                {isCompany && data.empresa_nombre && (
                  <>
                    <Text style={{ fontSize: 7, color: '#000000', marginBottom: 2 }}>
                      EN REPRESENTACIÓN DE
                    </Text>
                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#000000' }}>
                      {data.empresa_nombre}
                    </Text>
                    <Text style={{ fontSize: 8, color: '#000000', marginTop: 2 }}>
                      RUT: {data.empresa_rut}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={{
          position: 'absolute',
          bottom: 20,
          left: 30,
          right: 30,
          textAlign: 'center',
          fontSize: 8,
          color: '#666666',
        }}>
          Contrato generado automáticamente • Mario Hans Rental • www.mariohans.cl • Usuario ID: {data.user_id}
        </Text>
      </Page>

      {/* Page 6: Documentos Adjuntos */}
      <Page size="A4" style={commonStyles.page}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 15, color: '#000000' }}>
          DOCUMENTOS ADJUNTOS
        </Text>

        <Text style={{ fontSize: 10, marginBottom: 12, color: '#000000' }}>
          Documentos incluidos en este contrato:
        </Text>

        {/* RUT Anverso */}
        {data.url_rut_anverso && (
          <View style={{ marginBottom: 15, padding: 12, backgroundColor: '#ffffff', borderRadius: 4, border: '1pt solid #e8e7e7' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', marginBottom: 6 }}>
              1. Carnet de Identidad (Anverso)
            </Text>
            <Text style={{ fontSize: 7, color: '#666', marginBottom: 8, wordWrap: 'break-word' }}>
              URL: {data.url_rut_anverso}
            </Text>
            <Image
              src={data.url_rut_anverso}
              style={{ width: '100%', maxHeight: 150, objectFit: 'contain', border: '1pt solid #e8e7e7', borderRadius: 3 }}
            />
          </View>
        )}

        {/* RUT Reverso */}
        {data.url_rut_reverso && (
          <View style={{ marginBottom: 15, padding: 12, backgroundColor: '#ffffff', borderRadius: 4, border: '1pt solid #e8e7e7' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', marginBottom: 6 }}>
              2. Carnet de Identidad (Reverso)
            </Text>
            <Text style={{ fontSize: 7, color: '#666', marginBottom: 8, wordWrap: 'break-word' }}>
              URL: {data.url_rut_reverso}
            </Text>
            <Image
              src={data.url_rut_reverso}
              style={{ width: '100%', maxHeight: 150, objectFit: 'contain', border: '1pt solid #e8e7e7', borderRadius: 3 }}
            />
          </View>
        )}

        {/* Firma Digital */}
        {data.url_firma && (
          <View style={{ marginBottom: 15, padding: 12, backgroundColor: '#ffffff', borderRadius: 4, border: '1pt solid #e8e7e7' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', marginBottom: 6 }}>
              3. Firma Digital
            </Text>
            <Text style={{ fontSize: 7, color: '#666', marginBottom: 8, wordWrap: 'break-word' }}>
              URL: {data.url_firma}
            </Text>
            <Image
              src={data.url_firma}
              style={{ width: 200, height: 100, objectFit: 'contain', border: '1pt solid #e8e7e7', borderRadius: 3 }}
            />
          </View>
        )}

        {/* E-RUT Empresa */}
        {(data.new_url_e_rut_empresa || data.url_empresa_erut) && (
          <View style={{ marginBottom: 15, padding: 12, backgroundColor: '#ffffff', borderRadius: 4, border: '1pt solid #e8e7e7' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', marginBottom: 6 }}>
              4. E-RUT Empresa
            </Text>
            <Text style={{ fontSize: 7, color: '#666', marginBottom: 8, wordWrap: 'break-word' }}>
              URL: {data.new_url_e_rut_empresa || data.url_empresa_erut}
            </Text>
            <Image
              src={data.new_url_e_rut_empresa || data.url_empresa_erut || ''}
              style={{ width: '100%', maxHeight: 150, objectFit: 'contain', border: '1pt solid #e8e7e7', borderRadius: 3 }}
            />
          </View>
        )}

        {/* No documents message */}
        {!data.url_rut_anverso && !data.url_rut_reverso && !data.url_firma && !data.new_url_e_rut_empresa && !data.url_empresa_erut && (
          <View style={{ padding: 15, backgroundColor: '#f8f9fa', borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#666', textAlign: 'center' }}>
              No hay documentos adjuntos al contrato.
            </Text>
          </View>
        )}

        {/* Contract Status */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10, color: '#000000' }}>
            ESTADO DEL CONTRATO
          </Text>
          <View style={{
            padding: 12,
            borderRadius: 4,
            backgroundColor: data.terminos_aceptados ? '#d4edda' : '#f8d7da',
            border: data.terminos_aceptados ? '2pt solid #c3e6cb' : '2pt solid #f5c6cb'
          }}>
            <Text style={{
              fontSize: 11,
              fontWeight: 'bold',
              textAlign: 'center',
              color: data.terminos_aceptados ? '#155724' : '#721c24'
            }}>
              {data.terminos_aceptados ? '✅ TÉRMINOS ACEPTADOS' : '⏳ PENDIENTE DE ACEPTACIÓN'}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
