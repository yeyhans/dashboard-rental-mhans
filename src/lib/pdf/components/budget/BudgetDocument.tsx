import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import type { BudgetDocumentData } from '../../core/types';
import { commonStyles, budgetStyles } from '../../utils/styles';
import { formatCLP, getCurrentDateFormatted } from '../../utils/formatters';
import { CompanyInfo } from '../common/CompanyInfo';

/**
 * Budget PDF Document Component
 * Replaces /src/pages/budget-pdf/[orderId].astro
 * Layout: 3 columns with complete order information
 */
export const BudgetDocument: React.FC<{ data: BudgetDocumentData }> = ({
  data,
}) => {
  // Calculate PRODUCTS SUBTOTAL (matches ProcessOrder.tsx logic)
  // Formula: Σ(price × quantity × numJornadas)
  const productsSubtotal = data.lineItems.reduce((sum, item) => {
    return sum + (item.price * item.quantity * data.project.numJornadas);
  }, 0);

  // Calculate subtotal after discount (for shipping and IVA)
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
              Presupuesto #{data.orderId}
            </Text>
            <Text style={{ fontSize: 11, marginTop: 5 }}>
              Fecha: {getCurrentDateFormatted()}
            </Text>
            <Text style={{ fontSize: 10, marginTop: 3, color: '#666' }}>
              Estado: {data.status}
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
                {data.billing.firstName} {data.billing.lastName}
              </Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Email:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.billing.email}</Text>
            </View>

            {data.billing.rut && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>RUT:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.billing.rut}</Text>
              </View>
            )}

            {data.billing.company && (
              <>
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Empresa:</Text>
                  <Text style={{ fontSize: 9, color: '#000000' }}>{data.billing.company}</Text>
                </View>
                {data.project.companyRut && (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>RUT Empresa:</Text>
                    <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.companyRut}</Text>
                  </View>
                )}
              </>
            )}

            {data.billing.phone && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Teléfono:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.billing.phone}</Text>
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
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.name}</Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>N° Jornadas:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.numJornadas}</Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Fecha Inicio:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.startDate}</Text>
            </View>

            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Fecha Término:</Text>
              <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.endDate}</Text>
            </View>
          </View>

          {/* Column 3: Additional Information (Retire/Comments/Delivery) */}
          <View style={{ flex: 1, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 6, border: '1pt solid #ffffff' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#000000' }}>
              INFORMACIÓN ADICIONAL
            </Text>

            {data.project.comments && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Comentarios:</Text>
                <Text style={{ fontSize: 8, color: '#000000' }}>{data.project.comments}</Text>
              </View>
            )}

            {/* Información de Retiro */}
            {data.project.retireName && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Retira:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.retireName}</Text>
              </View>
            )}

            {data.project.retirePhone && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>Tel. Retiro:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.retirePhone}</Text>
              </View>
            )}

            {data.project.retireRut && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000000' }}>RUT Retiro:</Text>
                <Text style={{ fontSize: 9, color: '#000000' }}>{data.project.retireRut}</Text>
              </View>
            )}

            {/* Información de Envío (solo si no hay datos de retiro) */}
            {!data.project.retireName && !data.project.retirePhone && data.shippingInfo && (
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

            {!data.project.comments && !data.project.retireName && !data.project.retirePhone && !data.project.retireRut && !data.shippingInfo && (
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
            const neto = item.price * item.quantity * data.project.numJornadas;
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
                  {data.project.numJornadas}
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

          {/* IVA (19%) - Calculated on subtotal after discount + delivery */}
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

        {/* Warning Box */}
        <View style={budgetStyles.warningBox}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5, color: '#000000' }}>
            IMPORTANTE
          </Text>
          <Text style={{ color: '#000000' }}>
            Estamos revisando la disponibilidad de los equipos seleccionados.
            Muy pronto te confirmaremos su disponibilidad.
          </Text>
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
          Presupuesto generado con Rental Mario Hans • www.mariohans.cl
        </Text>
      </Page>
    </Document>
  );
};
