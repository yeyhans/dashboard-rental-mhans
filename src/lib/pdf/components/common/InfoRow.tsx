import React from 'react';
import { View, Text } from '@react-pdf/renderer';

interface InfoRowProps {
  label: string;
  value: string | number;
  labelWidth?: number;
}

/**
 * Simple label-value info row component
 */
export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  labelWidth = 120,
}) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          fontWeight: 'bold',
          minWidth: labelWidth,
          color: '#555555',
          fontSize: 11,
        }}
      >
        {label}:
      </Text>
      <Text
        style={{
          color: '#333333',
          fontSize: 11,
        }}
      >
        {value}
      </Text>
    </View>
  );
};
