import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import type { ProcessingDocumentData } from '../../core/types';
import { commonStyles, budgetStyles } from '../../utils/styles';
import { formatCLP, getCurrentDateFormatted } from '../../utils/formatters';
import { CompanyInfo } from '../common/CompanyInfo';

/**
 * Processing PDF Document Component
 * Generates the processing/contract PDF for orders
 * Matches BudgetDocument design
 */
export const ProcessingDocument: React.FC<{ data: ProcessingDocumentData }> = ({ data }) => {
  // Calculate PRODUCTS SUBTOTAL
  const productsSubtotal = data.lineItems.reduce((sum, item) => {
    return sum + (item.price * item.quantity * data.numJornadas);
  }, 0);

  // Calculate subtotal after discount
  const subtotalAfterDiscount = productsSubtotal - data.totals.discount;

  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        {/* Header with logo and order number */}
        <View style={budgetStyles.budgetHeader}>
          <Image
            src="https://media.mariohans.cl/logos/Recurso%2016%403x.png"
            style={{ width: 150, height: 'auto' }}
          />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold' }}>
              Pedido #{data.orderId}
            </Text>
            <Text style={{ fontSize: 11, marginTop: 5 }}>
              Fecha: {getCurrentDateFormatted()}
            </Text>
          </View>
        </View>

        {/* Three Column Layout */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {/* Column 1: Client Information */}
          <View style={{ flex: 1, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 6, border: '1pt solid #ffffff' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#000000' }}>
              INFORMACIÓN DEL CLIENTE
            </Text>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Nombre:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>
                {data.customerName}
              </Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Email:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.customerEmail}</Text>
            </View>

            {data.customerRut && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>RUT:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.customerRut}</Text>
              </View>
            )}

            {data.customerCompany && (
              <>
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Empresa:</Text>
                  <Text style={{ fontSize: 9, color: '#000000' }}>{data.customerCompany}</Text>
                </View>
                {data.companyRut && (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>RUT Empresa:</Text>
                    <Text style={{ fontSize: 9, color: '#000000' }}>{data.companyRut}</Text>
                  </View>
                )}
              </>
            )}

            {data.customerPhone && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Teléfono:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.customerPhone}</Text>
              </View>
            )}
          </View>

          {/* Column 2: Project Information */}
          <View style={{ flex: 1, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 6, border: '1pt solid #ffffff' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#000000' }}>
              INFORMACIÓN DEL PROYECTO
            </Text>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Nombre Proyecto:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.projectName}</Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>N° Jornadas:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.numJornadas}</Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Fecha Inicio:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.startDate}</Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Fecha Término:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.endDate}</Text>
            </View>
          </View>

          {/* Column 3: Additional Information */}
          <View style={{ flex: 1, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 6, border: '1pt solid #ffffff' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#000000' }}>
              INFORMACIÓN ADICIONAL
            </Text>

            {data.comments && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Comentarios:</Text>
                <Text style={{ fontSize: 8, color: '#000000' }}>{data.comments}</Text>
              </View>
            )}

            {data.retireName && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Retira:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.retireName}</Text>
              </View>
            )}

            {data.shippingInfo && (
              <>
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Método de Entrega:</Text>
                  <Text style={{ fontSize: 9, color: '#000000' }}>
                    {data.shippingInfo.deliveryMethod === 'pickup' ? 'Retiro en tienda' : 'Envío a domicilio'}
                  </Text>
                </View>

                {data.shippingInfo.deliveryMethod === 'shipping' && data.shippingInfo.shippingAddress && (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Dirección de Envío:</Text>
                    <Text style={{ fontSize: 8, color: '#000000' }}>{data.shippingInfo.shippingAddress}</Text>
                  </View>
                )}

                {data.shippingInfo.deliveryMethod === 'shipping' && data.shippingInfo.shippingPhone && (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Teléfono de Contacto:</Text>
                    <Text style={{ fontSize: 9, color: '#000000' }}>{data.shippingInfo.shippingPhone}</Text>
                  </View>
                )}
              </>
            )}

            {!data.comments && !data.retireName && !data.shippingInfo && (
              <Text style={{ fontSize: 9, color: '#666666', fontStyle: 'italic' }}>
                No hay información adicional
              </Text>
            )}
          </View>
        </View>

        {/* Detailed Product Table */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10 }}>
            DETALLE DE PRODUCTOS
          </Text>

          {/* Table Header */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: '#000000',
            padding: 6,
            borderRadius: 4,
          }}>
            <Text style={{ flex: 3, fontSize: 9, fontWeight: 'bold', color: '#ffffff' }}>
              PRODUCTO
            </Text>
            <Text style={{ flex: 1.2, fontSize: 9, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
              VALOR DIARIO
            </Text>
            <Text style={{ flex: 0.8, fontSize: 9, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
              CANT.
            </Text>
            <Text style={{ flex: 0.8, fontSize: 9, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
              DÍAS
            </Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' }}>
              NETO
            </Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' }}>
              IVA 19%
            </Text>
            <Text style={{ flex: 1.2, fontSize: 9, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' }}>
              TOTAL BRUTO
            </Text>
          </View>

          {/* Table Rows */}
          {data.lineItems.map((item, index) => {
            const neto = item.price * item.quantity * data.numJornadas;
            const iva = neto * 0.19;
            const totalBruto = neto + iva;

            return (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  padding: 6,
                  borderBottom: '1pt solid #cccccc',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                }}
              >
                <Text style={{ flex: 3, fontSize: 8, color: '#000000' }}>
                  {item.name}
                </Text>
                <Text style={{ flex: 1.2, fontSize: 8, color: '#000000', textAlign: 'center' }}>
                  {formatCLP(item.price)}
                </Text>
                <Text style={{ flex: 0.8, fontSize: 8, color: '#000000', textAlign: 'center' }}>
                  {item.quantity}
                </Text>
                <Text style={{ flex: 0.8, fontSize: 8, color: '#000000', textAlign: 'center' }}>
                  {data.numJornadas}
                </Text>
                <Text style={{ flex: 1, fontSize: 8, color: '#000000', textAlign: 'right' }}>
                  {formatCLP(neto)}
                </Text>
                <Text style={{ flex: 1, fontSize: 8, color: '#000000', textAlign: 'right' }}>
                  {formatCLP(iva)}
                </Text>
                <Text style={{ flex: 1.2, fontSize: 8, fontWeight: 'bold', color: '#000000', textAlign: 'right' }}>
                  {formatCLP(totalBruto)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Summary Table - Right Aligned */}
        <View style={{ marginLeft: 'auto', width: '60%', marginBottom: 20 }}>
          {/* Subtotal Productos */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 8,
            borderBottom: '1pt solid #cccccc',
            backgroundColor: '#ffffff',
          }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000000' }}>SUBTOTAL PRODUCTOS</Text>
            <Text style={{ fontSize: 11, color: '#000000' }}>{formatCLP(productsSubtotal)}</Text>
          </View>

          {/* Discount (Cupón) */}
          {data.couponCode && data.totals.discount > 0 && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: 8,
              borderBottom: '1pt solid #cccccc',
              backgroundColor: '#f8f9fa',
            }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000000' }}>
                DESCUENTO CUPÓN ({data.couponCode})
              </Text>
              <Text style={{ fontSize: 11, color: '#000000' }}>
                -{formatCLP(data.totals.discount)}
              </Text>
            </View>
          )}

          {/* Subtotal after discount */}
          {data.totals.discount > 0 && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: 8,
              borderBottom: '1pt solid #cccccc',
              backgroundColor: '#f8f9fa',
            }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000000' }}>SUBTOTAL CON DESCUENTO</Text>
              <Text style={{ fontSize: 11, color: '#000000' }}>{formatCLP(subtotalAfterDiscount)}</Text>
            </View>
          )}

          {/* Delivery / Shipping */}
          {data.shippingInfo && data.shippingInfo.total > 0 && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: 8,
              borderBottom: '1pt solid #cccccc',
              backgroundColor: '#f8f9fa',
            }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000000' }}>
                DELIVERY ({data.shippingInfo.method})
              </Text>
              <Text style={{ fontSize: 11, color: '#000000' }}>{formatCLP(data.shippingInfo.total)}</Text>
            </View>
          )}

          {/* IVA (19%) */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 8,
            borderBottom: '2pt solid #000000',
            backgroundColor: '#ffffff',
          }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000000' }}>IVA (19%)</Text>
            <Text style={{ fontSize: 11, color: '#000000' }}>{formatCLP(data.totals.iva)}</Text>
          </View>

          {/* TOTAL */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 12,
            backgroundColor: '#000000',
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#ffffff' }}>
              TOTAL
            </Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#ffffff' }}>
              {formatCLP(data.totals.total)}
            </Text>
          </View>

          {/* RESERVA 25% */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 10,
            backgroundColor: '#666666',
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>
              RESERVA 25% (Anticipo)
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>
              {formatCLP(data.totals.reserve)}
            </Text>
          </View>

          {/* Saldo Pendiente */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 8,
            backgroundColor: '#f8f9fa',
            borderBottom: '1pt solid #cccccc',
          }}>
            <Text style={{ fontSize: 10, color: '#000000' }}>
              Saldo Pendiente (75%)
            </Text>
            <Text style={{ fontSize: 10, color: '#000000' }}>
              {formatCLP(data.totals.total - data.totals.reserve)}
            </Text>
          </View>
        </View>

        {/* Company Information & Terms - 2 Column Layout */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {/* Column 1: Company Info */}
          <View style={{ flex: 1 }}>
            <CompanyInfo />
          </View>

          {/* Column 2: Terms & Conditions */}
          <View style={{
            flex: 1,
            backgroundColor: '#f8f9fa',
            padding: 15,
            borderRadius: 6,
            border: '1pt solid #ffffff'
          }}>
            <Text style={{
              fontSize: 11,
              fontWeight: 'bold',
              marginBottom: 8,
              textAlign: 'center'
            }}>
              ACEPTACIÓN DE CONDICIONES
            </Text>
            <Text style={{
              fontSize: 9,
              lineHeight: 1.5,
              textAlign: 'justify'
            }}>
              Al aceptar el valor del presupuesto y realizar el abono de reserva, el arrendatario acepta plenamente todas las condiciones de arriendo y la política por daño
            </Text>
          </View>
        </View>

        {/* Contract Annex - Replaces Warning Box */}
        <View style={budgetStyles.warningBox}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 10, textAlign: 'center', color: '#000000' }}>
            ANEXO, Pedido #{data.orderId}
          </Text>

          <View style={{ fontSize: 7, lineHeight: 1.5, textAlign: 'justify', color: '#000000' }}>
            <Text style={{ marginBottom: 4 }}>
              El presente Contrato comenzará a regir con fecha {data.startDate} y finalizará el {data.endDate},
              salvo las partes acuerden su extensión, lo que debe constar en Anexo del presente Contrato.
            </Text>

            <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>
              Salvo las partes expresamente acuerden otra cosa:
            </Text>

            <Text style={{ marginBottom: 4 }}>
              Los bienes muebles objeto del presente contrato serán entregados por el ARRENDADOR a partir de las
              15:00 horas del día anterior al inicio del período de arriendo, en Purísima 25, Recoleta.
              El ARRENDATARIO deberá devolver los equipos y sus accesorios a más tardar a la 1:00 PM del día
              siguiente a la finalizada su jornada de arriendo, en el mismo lugar de entrega.
            </Text>

            <Text style={{ marginBottom: 4 }}>
              Valor total del arriendo {formatCLP(data.totals.subtotal)} + {formatCLP(data.totals.iva)} IVA.
              {formatCLP(data.totals.total)} es la reserva por el arriendo de los bienes, lo cual corresponde
              al 25% del valor total del arriendo.
            </Text>

            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Uso del Equipo:</Text>
            <Text style={{ marginBottom: 4 }}>
              No se permite subarrendar, modificar ni ceder los equipos sin autorización del arrendador.
            </Text>

            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Entrega y Devolución:</Text>
            <Text style={{ marginBottom: 4 }}>
              Los equipos deben ser devueltos en el mismo estado en que fueron entregados, limpios y secos.
              Horario atención: 8:00 a 20:00 los 7 días de la semana, en Purísima 25, Recoleta.
            </Text>

            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Multa por retraso:</Text>
            <Text style={{ marginBottom: 4 }}>
              En caso de incumplimiento de devolución en fecha acordada, se aplicará una multa equivalente al
              valor de un día de arriendo por cada día de retraso.
            </Text>

            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Pago y Reserva:</Text>
            <Text style={{ marginBottom: 4 }}>
              Se debe pagar una reserva del 25% al confirmar el arriendo. El saldo restante (75%) deberá ser pagado
              antes o en el momento de la devolución. Si cancela con menos de 48 horas de anticipación, no se reembolsa la reserva.
            </Text>

            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Responsabilidad por Daños:</Text>
            <Text style={{ marginBottom: 4 }}>
              El arrendatario es responsable de los equipos desde su retiro hasta su devolución.
              En caso de daños, debe pagar la reparación o reponer el equipo. Plazo: Máximo 10 días hábiles.
            </Text>
          </View>

          {/* Signatures - 2 Column Layout integrated within contract annex */}
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 15 }}>
            {/* Rental Signature */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Image
                src="https://media.mariohans.cl/firmas/firma_mario_hans.png"
                style={{ width: 100, height: 50, marginBottom: 8 }}
              />
              <View style={{
                borderTop: '1pt solid #000000',
                width: '90%',
                paddingTop: 6,
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 7, fontWeight: 'bold', marginBottom: 1 }}>
                  Mario Alberto Hans Salinas
                </Text>
                <Text style={{ fontSize: 6, marginBottom: 1 }}>16.135.586-0</Text>
                <Text style={{ fontSize: 5, marginBottom: 1 }}>EN REPRESENTACIÓN DE</Text>
                <Text style={{ fontSize: 6, fontWeight: 'bold', marginBottom: 1 }}>Hans Salinas SpA</Text>
                <Text style={{ fontSize: 6 }}>77.892.569-9</Text>
              </View>
            </View>

            {/* Customer Signature */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              {/* Placeholder for customer signature */}
              <View style={{ height: 50, marginBottom: 8 }} />
              <View style={{
                borderTop: '1pt solid #000000',
                width: '90%',
                paddingTop: 6,
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 7, fontWeight: 'bold', marginBottom: 1 }}>
                  {data.customerName}
                </Text>
                <Text style={{ fontSize: 6 }}>{data.customerRut}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={{
          position: 'absolute',
          bottom: 30,
          left: 30,
          right: 30,
          textAlign: 'center',
          fontSize: 9,
          color: '#000000',
        }}>
          Pedido generado con Rental Mario Hans • www.mariohans.cl
        </Text>
      </Page>
    </Document>
  );
};
