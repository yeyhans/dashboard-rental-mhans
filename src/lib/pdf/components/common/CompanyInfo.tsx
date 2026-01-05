import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';

/**
 * Company information block (HANS SALINAS SpA)
 * Used in Budget and Processing PDFs
 */
export const CompanyInfo: React.FC = () => {
  return (
    <View
      style={{
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 6,
        border: '1pt solid #ffffff',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Image
          src="https://media.mariohans.cl/logos/Recurso%2010%403x.png"
          style={{ width: 60, height: 60, marginRight: 15 }}
        />
        <View>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
            HANS SALINAS SpA
          </Text>
          <Text style={{ fontSize: 11, marginBottom: 2 }}>RUT: 77.892.569-9</Text>
          <Text style={{ fontSize: 11, marginBottom: 2 }}>Banco de Chile</Text>
          <Text style={{ fontSize: 11, marginBottom: 2 }}>Cuenta Corriente</Text>
          <Text style={{ fontSize: 11, marginBottom: 2 }}>8140915407</Text>
          <Text style={{ fontSize: 11 }}>Email: pagos@mariohans.cl</Text>
        </View>
      </View>
    </View>
  );
};
