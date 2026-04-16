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
        <View style={{ backgroundColor: '#f8f9fa', padding: 15, borderRadius: 6, border: '1pt solid #ffffff', marginBottom: 15 }}>
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
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Igualmente, la PARTE ARRENDATARIA se obliga a no realizar ningún uso o disposición del
            bien mueble que sea de contrariedad con lo anterior, la moral o el orden público, o bien de
            cualquier otro modo pueda causar lesiones o daños a terceros, personas, cosas o al propio
            bien mueble a su disposición.
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
            El presente Contrato se entenderá firmado en aquella fecha correspondiente a la creación
            de la cuenta de USUARIO en el Sitio web https://rental.mariohans.cl/, sin embargo,
            comenzará a regir desde la fecha de la aceptación de presupuesto realizada a través de
            dicho sitio web, fecha que constará en el (los) Anexo(s) del presente Contrato y se extenderá
            por el período de que se describe en dicho Anexo(s) contado desde la fecha de entrega de
            los equipos. EL ARRENDATARIO deberá devolver los equipos en la fecha y hora estipuladas
            en el(los) Anexos, salvo que las partes acuerden por escrito una extensión del plazo.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO deberá crearse una cuenta y un usuario a través del sitio web
            https://rental.mariohans.cl/, donde se encontrará identificado mediante su nombre, dirección
            de correo electrónico y datos necesarios para el presente Contrato, los cuales se solicitarán
            en el proceso de registro, quedando dicho registro como constancia fehaciente de la
            aceptación de los términos del presente Contrato. En los Anexos del presente Contrato
            constarán los presupuestos aprobados de acuerdo con la solicitud del usuario,
            ARRENDATARIO.
          </Text>
        </View>

        {/* CUARTA: ENTREGA */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            CUARTA: ENTREGA
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            La PARTE ARRENDADORA hará entrega del bien(es) mueble(s) objeto de este Contrato,
            poniéndolo en poder de la PARTE ARRENDATARIA, que lo recibe, en el horario y fecha
            estipulada en el Anexo(s) del presente Contrato en el domicilio señalado por el
            ARRENDADOR. A partir de esta entrega, la PARTE ARRENDATARIA se hace cargo de las
            responsabilidades derivadas de su tenencia y uso, así como de su limpieza y transporte.
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
            El precio del arriendo de los bienes individualizados en (los) Anexo(s) del presente Contrato
            será el establecido en el Anexo correspondiente, el cual deberá ser pagado por EL
            ARRENDATARIO, en las condiciones que el correspondiente Anexo determine.</Text>
          <Text style={{ fontSize: 9, marginBottom: 8, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO deberá pagar una reserva por el arriendo de los bienes, lo cual
            corresponde al 25% del valor total del arriendo establecido en el Anexo correspondiente,
            según la cotización proporcionada previamente, y aceptada por las partes. El monto restante
            deberá ser pagado al momento de la entrega de los bienes mediante el método de pago
            acordado y que consta en el Anexo.</Text>

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
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            La reserva deberá ser abonada antes del retiro de los bienes del domicilio acordado. El pago
            de la reserva asegura la disponibilidad de los equipos para la fecha solicitada y se procederá
            a retirarlos del stock. Sin el pago de la reserva, LA ARRENDADORA no garantiza la
            disponibilidad de los equipos, pudiendo estos ser puestos a disposición de terceros, sin
            previo aviso.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            El saldo restante, correspondiente al 75% del valor total del arriendo, deberá ser pagado en
            su totalidad antes o en el momento de la devolución por parte de la ARRENDATARIA de los
            bienes arrendados.</Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            El incumplimiento por la PARTE ARRENDATARIA de las obligaciones de pago de la renta en
            el plazo fijado será motivo de resolución del presente Contrato, debiendo en tal caso restituir
            inmediatamente el(los) bien(s) mueble(s) a la PARTE ARRENDADORA y perdiendo el monto
            pagado por concepto de reserva.
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
              3. La entrega y devolución de los equipos se realizará en el domicilio señalado por el ARRENDADOR, en horario previamente acordado con éste.
            </Text>
            <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
              4. Los bienes y sus accesorios deben ser entregados en las mismas condiciones en que
              fueron entregados, considerando su correcto funcionamiento y estado de
              conservación, limpios y secos.
            </Text>
          </View>
        </View>

        {/* SÉPTIMA: REPARACIONES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            SÉPTIMA: REPARACIONES Y RESPONSABILIDAD POR DAÑOS
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Los gastos inherentes a la utilización del bien mueble serán de cargo de la PARTE
            ARRENDATARIA</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            En el caso de las reparaciones al bien mueble que deban efectuarse durante la vigencia de
            este Contrato, serán de cargo de la PARTE ARRANDATARIA. Dichas reparaciones deberán
            realizarse en servicios técnicos autorizados por las marcas de cada bien arrendado, previa
            coordinación y autorización del ARRENDADOR</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Sin embargo, si existe una destrucción total de la cosa, una pérdida total de utilidad o existe
            una destrucción de más del 50% de los equipos y/o accesorios, que conste en informe de
            servicio técnico autorizado, si las reparaciones imposibilitan que la PARTE ARRENDADORA
            pueda hacer uso del bien(es) mueble(s) para el uso que fue(ron) arrendado(s) o cuando la
            reparación y los costos de la misma superen el valor del bien, LA PARTE ARRENDATARIA
            deberá pagar al ARRENDADOR del valor total de equipo, el cual podrá realizarse a través
            de entrega de un bien idéntico en calidad de nuevo o a través de transferencia bancaria.
            Para determinar el valor del bien que deberá reintegrarse, el ARRENDADOR le entregará un
            presupuesto en que incluirá un desglose de cómo se ha realizado la estimación del bien.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO deberá efectuar las reparaciones o el reemplazo del equipo dentro de
            un plazo máximo de 10 días hábiles. Dichas acciones no eximirán ni suspenderán el
            cumplimiento de las obligaciones contractuales vigentes.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            En caso de ocurrir daños físicos o de operabilidad en los bienes, el ARRENDADOR tiene
            derecho a realizar un chequeo previo de los bienes y emitirá un informe técnico para
            determinar la reparación y/o reemplazo de las partes dañadas o la reposición total de los
            bienes.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            En todo caso, la PARTE ARRENDATARIA no podrá, sin el consentimiento de la PARTE
            ARRENDADORA, hacer en el bien(es) mueble(s) otros trabajos o cambios que puedan
            turbar o disminuir el goce del bien.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            En todo caso, si las reparaciones necesarias no pueden postergarse sin comprometer la
            seguridad del bien mueble y afectan gravemente su uso o goce, serán de responsabilidad de
            la PARTE ARRENDADORA, si es que son de su imputabilidad. En dicho caso, la PARTE
            ARRENDATARIA tendrá derecho a que se le restituyan los días de arriendo en los que no
            haya podido hacer uso del bien mueble debido a dichas reparaciones, ajustando el plazo y
            las obligaciones contractuales en consecuencia.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Las reparaciones que se deban efectuar por una utilización del bien mueble indebida o
            contraria a lo dispuesto en este Contrato, son de cargo de la PARTE ARRENDATARIA. Por
            el contrario será de cargo de la PARTE ARRENDADORA las reparaciones cuyas causas
            eran conocidas o no pudieron ser controladas por la PARTE ARRENDADORA antes de
            entregar el(los) bien(es) mueble(s) en arriendo, y no comunicadas a la PARTE
            ARRENDATARIA.</Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            En relación con los elementos fungibles, tales como ampolletas, tubos de flash, fusibles y
            LED, si estos dejan de funcionar debido al término de su vida útil mientras estén en poder
            del ARRENDATARIO, la responsabilidad de este último se limitará al 50% del valor de
            reemplazo de dichos elementos. Por otro lado, en caso de rotura o daño atribuible al
            ARRENDATARIO, este será responsable del 100% del valor de reemplazo.</Text>
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
            Obligaciones del ARRENDADOR: La PARTE ARRENDADORA se obliga a:
          </Text>
          <View style={{ paddingLeft: 10, marginBottom: 8 }}>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              1. Entregar los equipos y sus accesorios objeto del Contrato en condiciones óptimas de
              uso.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              2. Mantener al bien mueble en estado de servir para el fin que ha sido arrendado.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              3.  Librar a la PARTE ARRENDATARIA de toda turbación o embarazo en el goce del bien
              mueble.</Text>
            <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
              4. Cubrir los gastos de las reparaciones al bien mueble que deban efectuarse durante la
              vigencia de este Contrato, cuyas causas eran conocidas o no pudieron ser controladas
              por la PARTE ARRENDADORA antes de entregar el(los) bien(es) mueble(s) en
              arriendo, y no comunicadas a la PARTE ARRENDATARIA.</Text>
          </View>

          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#000000' }}>
            Obligaciones de EL ARRENDATARIO: La PARTE ARRENDATARIO se obliga a:
          </Text>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              1. Verificar las condiciones físicas y de funcionamiento de todos los bienes que se
              entregan en arriendo, así como la cantidad y el modelo, ya sea el ARRENDATARIO
              una Empresa, Cliente directo y/o persona(s) designada(s) autorizada(s) para el retiro
              de los equipos. Una vez retirados los bienes y aceptada su conformidad, se entenderá
              que LA PARTE ARRENDATARIA no podrá alegar posteriormente respecto a la calidad
              ni estado de los bienes.</Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              2. Utilizar los equipos y accesorios exclusivamente para los fines declarados y conforme
              a las instrucciones proporcionadas, no pudiendo, en consecuencia, hacerlos servir a
              otros fines que los convenidos.</Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              3. Pagar oportunamente y de manera íntegra las rentas de arriendo.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              4. No subarrendar, transferir ni ceder los equipos a terceros, así como tampoco realizar
              cambios o mejoras al bien mueble sin consentimiento previo y escrito de la PARTE
              ARRENDADORA
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              5. No contraer compromisos económicos o legales que puedan ver afectados los
              intereses del ARRENDADOR. </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              6. Tomar las precauciones correspondientes para el transporte, armado y uso de cada
              uno de los bienes y sus accesorios. EL ARRENDATARIO debe siempre observar el
              cuidado en el correcto ensamblaje de partes, piezas y en el manejo apropiado de todos
              los bienes para conservar su funcionamiento e integridad física, so pena de indemnizar
              al ARRENDADOR de los daños que éste pueda causar en los bienes.</Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              7. Asumir la responsabilidad acerca de daños físicos y/o de operabilidad, sean hechos
              por causas directas o indirectas, causadas con o sin intencionalidad por personas
              pertenecientes a la empresa arrendadora o por terceros, en los bienes, accesorios,
              partes y piezas que estén en su poder.</Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              8. A asumir toda responsabilidad por las pérdidas, daños o perjuicios que puedan sufrir
              los bienes arrendados como consecuencia de caso fortuito o fuerza mayor,
              entendiéndose por tales los definidos en el artículo 45 del Código Civil. Esta
              responsabilidad incluirá, a modo enunciativo, pero no limitativo, eventos tales como
              incendios, inundaciones, terremotos o cualquier otro suceso de naturaleza imprevisible
              e inevitable, salvo que dichos eventos sean ocasionados por dolo o negligencia delARRENDATARIO. En caso de que ocurra un evento de caso fortuito o fuerza mayor, el
              ARRENDATARIO se compromete a reparar, reponer o indemnizar los bienes afectados
              dentro de un plazo no superior a 30 días hábiles, de conformidad con el avalúo
              realizado por el ARRENDADOR, que será aceptada por ambas partes.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              9. Restituir inmediatamente al bien mueble una vez terminado el presente Contrato,
              poniéndolo a disposición de la PARTE ARRENDADORA en los términos previamente
              estipulados.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              10. Notificar de inmediato a LA PARTE ARRENDADORA en caso de pérdida, daño o
              cualquier inconveniente que afecte a los equipos.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              11. Reparar los daños, gastos, pérdidas u otras lesiones que el uso del bien mueble haya
              ocasionado por descuido o culpa suya.
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 3, textAlign: 'justify', lineHeight: 1.4 }}>
              12. Devolver los bienes y sus accesorios en las mismas condiciones en que fueron
              entregados, considerando su estado de funcionamiento, de conservación y limpieza.</Text>

            <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
              Para efectos legales, las partes acuerdan elevar las obligaciones de la PARTE
              ARRENDATARIA a la calidad de esenciales, dejando explícita la facultad de la PARTE
              ARRENDADORA de invocar una infracción grave del Contrato y derecho de la PARTE
              ARRENDADORA a ponerle término al mismo.</Text>

          </View>
        </View>

        {/* NOVENA: GARANTÍAS Y MULTAS */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            NOVENA: GARANTÍAS Y MULTAS POR RETRASO EN LA ENTREGA DE
            LOS BIENES Y POR SU MAL ESTADO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            No se exigirá una garantía monetaria debido a que el Contrato formaliza el compromiso
            entre las partes. No obstante, EL ARRENDATARIO responderá por los daños o pérdidas que
            puedan sufrir los equipos durante el periodo de arriendo.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            EL ARRENDATARIO debe devolver los bienes en el domicilio señalado por el
            ARRENDADOR en el horario señalado en el Anexo. En caso de incumplimiento de dicho
            plazo, se aplicará una multa equivalente al valor de un día de arriendo por cada día de
            retraso en la devolución de los bienes, sin perjuicio de las demás acciones legales que
            pudiera ejercer LA ARRENDADORA.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO podrá notificar al ARRENDADOR, a través de correo electrónico, u otro
            medio idóneo, con al menos 48 horas de antelación a la fecha programada para el retiro de
            los bienes, indicada en el Anexo correspondiente, su decisión de desistir del arrendamiento.
            Dicha notificación deberá realizarse de manera expresa y textual, señalando que renuncia al
            arriendo de los bienes. En este caso, el monto pagado en concepto de reserva no será
            reembolsado.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            EL ARRENDATARIO se obliga a devolver los equipos y sus accesorios en las mismas
            condiciones en que fueron entregados, considerando su correcto funcionamiento y estado
            de conservación, salvo el desgaste normal por uso.</Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            Asimismo, los equipos deberán ser devueltos limpios y secos. En caso de que los bienes
            presenten suciedad, acumulación de polvo o humedad, LA ARRENDADORA procederá a
            una inspección técnica para evaluar posibles daños. Si se determina que el ingreso de
            polvo, agua u otros elementos ha afectado la operatividad de los equipos, EL
            ARRENDATARIO será responsable de los costos de limpieza especializada, reparación o,
            en caso de daño irreparable, de su reposición conforme al valor que determine el
            ARRENDATARIO conforme a informe técnico.</Text>
        </View>

        {/* DÉCIMA: RESPONSABILIDAD */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA: RESPONSABILIDAD
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            A partir del momento en que el ARRENDATARIO retire los bienes del lugar designado por el
            ARRENDADOR para su entrega, el ARRENDATARIO asumirá plena responsabilidad por la
            custodia, transporte, uso y conservación de los mismos y de sus accesorios.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO será responsable de cualquier daño, pérdida, deterioro o destrucción
            que sufran los equipos, incluyendo aquellos ocurridos durante el transporte, salvo que
            dichos daños sean consecuencia directa de defectos preexistentes en los equipos que
            puedan ser acreditados de manera fehaciente.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            El ARRENDATARIO deberá tomar todas las precauciones necesarias para garantizar la
            adecuada protección y seguridad de los equipos desde el momento de su retiro hasta su
            devolución al ARRENDADOR.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            La PARTE ARRENDATARIA se hace directa y exclusivamente responsable, eximiendo de
            toda responsabilidad a la PARTE ARRENDADORA, de todos los daños que pueda causar a
            sí misma, a terceras personas o a las cosas haciendo uso del bien mueble arrendado,
            personalmente o por aquellas personas que ella autorice a utilizar.</Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            La PARTE ARRENDADORA no responde por daños causados al equipo por negligencia o
            mal uso de la PARTE ARRENDATARIA o por daños producidos por situaciones imprevistas
            de responsabilidad de terceros. En cualquiera de estos casos la ARRENDADORA cobrará al
            ARRENDATARIO los gastos en que deba incurrir para su reparación.</Text>
        </View>
      </Page>

      {/* Page 5: Cláusulas finales + Firmas */}
      <Page size="A4" style={commonStyles.page}>
        {/* DÉCIMA PRIMERA: MODIFICACIONES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA PRIMERA: MODIFICACIONES AL CONTRATO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            LA ARRENDADORA se reserva el derecho de modificar los términos y condiciones del
            presente Contrato cuando ello sea necesario para la adecuada prestación del servicio, el
            cumplimiento de normativas legales o la actualización de sus políticas operativas.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Toda modificación será debidamente notificada a EL ARRENDATARIO a través de la
            plataforma https://rental.mariohans.cl/ y/o mediante correo electrónico registrado en su
            cuenta de usuario. Dichas modificaciones entrarán en vigor a partir de la fecha indicada en
            la notificación, y EL ARRENDADOR deberá aceptarlas expresamente para continuar
            utilizando el servicio.</Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            En caso de que EL ARRENDATARIO no acepte las modificaciones, podrá solicitar la
            terminación del Contrato sin penalización, siempre que no existan obligaciones pendientes
            derivadas del uso de los bienes arrendados.</Text>
        </View>

        {/* DÉCIMA SEGUNDA: RESOLUCIÓN */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA SEGUNDA: RESOLUCIÓN DEL CONTRATO
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Sin perjuicio de lo anterior, el incumplimiento de las obligaciones legales o contractuales
            dará derecho a la otra parte a resolver el Contrato sin previo aviso, aunque deberá notificar a
            la otra parte las causas de extinción.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            EL ARRENDATARIO reconoce y acepta que el presente Contrato se formaliza de manera
            digital a través de su cuenta de usuario en el sitio web https://rental.mariohans.cl/. En
            consecuencia, en caso de incumplimiento de cualquiera de las obligaciones establecidas en
            este Contrato, particularmente aquellas relacionadas con el pago de los arriendos o
            cualquier otra falta grave a los términos acordados, LA ARRENDADORA podrá, a su sola
            discreción, resolver el Contrato de manera inmediata y proceder a la eliminación de la
            cuenta de usuario del ARRENDATARIO en la plataforma, sin que ello genere derecho a
            reembolso o compensación alguna. Dicha eliminación no eximirá al ARRENDATARIO de sus
            obligaciones pendientes, incluyendo el pago de sumas adeudadas o la devolución de los
            bienes arrendados.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            En caso de que cualquiera de las partes incumpla alguna de las obligaciones establecidas
            en este Contrato, o las cumpla de manera defectuosa, la otra parte tendrá derecho a solicitar
            la resolución del mismo. Sin embargo, antes de proceder a la terminación, se deberá
            conceder un plazo razonable para que la parte incumplidora subsane dicho incumplimiento.
            Si el incumplimiento resulta grave o excede los límites establecidos en las disposiciones
            formales del Contrato, la parte afectada podrá optar directamente por la resolución del
            Contrato, notificando dicha decisión por correo electrónico u otro medio idóneo.</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, textAlign: 'justify', lineHeight: 1.4 }}>
            Se siga por exigir así el cumplimiento o la exclusión del Contrato, a la parte optante,
            además, tendrá derecho a ser indemnizada por los perjuicios que sean razonablemente
            justificados.</Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            En caso de que la parte afectada decida no resolver el Contrato, no se considerará como
            una renuncia a su derecho, y podrá ejercer tal facultad en cualquier momento del Contrato,
            incluso si las formas ajenas sus derechos para hacer cumplir sus obligaciones derivadas del
            presente Contrato.</Text>

        </View>

        {/* DÉCIMA TERCERA: TERMINACIÓN ANTICIPADA */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA TERCERA: TERMINACIÓN ANTICIPADA
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            El presente Contrato podrá darse por terminado de forma anticipada en los siguientes casos
          </Text>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>1. Por mutuo acuerdo de las partes.</Text>
            <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>2. Por incumplimiento de cualquiera de las obligaciones establecidas en este Contrato.</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.4 }}>3. Por la devolución anticipada de los equipos, previa notificación por escrito a LA ARRENDADORA.</Text>
          </View>
        </View>

        {/* DÉCIMA CUARTA: NOTIFICACIONES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA CUARTA: NOTIFICACIONES
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            Para realizar cualquier notificación entre las partes que tenga como origen el presente
            Contrato, éstas acuerdan que su domicilio para estos efectos serán las direcciones
            indicadas al principio de este Contrato. A falta de una designación expresa, se tendrá por
            válida aquella dirección que figure como domicilio principal de cada parte y en su defecto el
            domicilio señalado para efectos de este Contrato en el registro correspondiente.</Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            Asimismo, ambas partes declaran que están de acuerdo en que las notificaciones puedan
            ser realizadas mediante medios electrónicos, siempre que exista constancia de recepción.</Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            Cuando se opte por un medio electrónico, la parte que remite la comunicación deberá
            guardar el acuse de recibo por correo electrónico o una impresión de la notificación enviada
            y de su respuesta, según lo que se establezca.</Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            Para garantizar la autenticidad de las personas emisoras, la parte destinataria de una
            notificación tiene el derecho de mantener una comunicación fluida entre las partes,
            facilitando las siguientes direcciones de correo electrónico:</Text>
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
            DÉCIMA QUINTA: PROPIEDAD INDUSTRIAL E INTELECTUAL
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            Las partes reconocen y acuerdan que toda propiedad intelectual e industrial, incluyendo,
            pero sin limitarse a nombres comerciales, logotipos y marcas registradas, es de exclusiva
            propiedad de cada una de ellas. En virtud del presente contrato, ninguna de las partes podrá
            utilizar la propiedad intelectual o industrial de la otra en anuncios, materiales promocionales
            o cualquier otro medio sin la autorización previa y expresa por escrito de su titular.</Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            Asimismo, EL ARRENDATARIO reconoce y acepta que ni él ni ningún tercero adquieren
            derechos de propiedad sobre los bienes objeto de este contrato, ni sobre cualquier servicio
            asociado a estos. Esto incluye, sin limitación, cualquier desarrollo, mejora, modificación o
            material provisto o generado en relación con los bienes arrendados, los cuales seguirán
            siendo de exclusiva propiedad de LA ARRENDADORA</Text>
        </View>

        {/* DÉCIMA SEXTA: LEGISLACIÓN */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA SEXTA: LEGISLACIÓN
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            Para todos los efectos legales derivados del presente Contrato, las partes fijan domicilio en
            la ciudad de Santiago, y se someten a la jurisdicción de sus tribunales de justicia, conforme
            a la legislación vigente en la República de Chile</Text>
        </View>

        {/* DÉCIMA SEXTA: DECLARACIONES FINALES */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#000000' }}>
            DÉCIMA SEXTA: DECLARACIONES FINALES
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 4, textAlign: 'justify', lineHeight: 1.4 }}>
            Las partes declaran que han leído y comprendido la totalidad del presente Contrato,
            firmando en señal de conformidad. Este documento se firma en dos ejemplares de igual
            tenor, fecha y efecto, quedando uno en poder de cada parte.
          </Text>
          <Text style={{ fontSize: 9, textAlign: 'justify', lineHeight: 1.4 }}>
            Se faculta al portador de uno de los ejemplares originales del presente Contrato para
            requerir las anotaciones, inscripciones y subscripciones que procedan o sean pertinentes.
          </Text>
        </View>


        {/* Firmas */}
        <View style={{ marginTop: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 6, border: '1pt solid #ffffff' }}>
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
