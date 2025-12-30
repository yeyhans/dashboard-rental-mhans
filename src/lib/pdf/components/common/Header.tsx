import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';

interface HeaderProps {
  title: string;
  subtitle?: string;
  logoUrl?: string;
  rightContent?: React.ReactNode;
}

/**
 * Common PDF header component with logo and title
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  logoUrl = 'https://media.mariohans.cl/logos/Recurso%2016%403x.png',
  rightContent,
}) => {
  return (
    <View
      style={{
        marginBottom: 20,
        paddingBottom: 15,
        borderBottom: '2pt solid #000000',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {logoUrl && (
          <Image src={logoUrl} style={{ width: 120, height: 'auto' }} />
        )}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ fontSize: 14, marginTop: 5, textAlign: 'center' }}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightContent && (
          <View style={{ textAlign: 'right' }}>{rightContent}</View>
        )}
      </View>
    </View>
  );
};
