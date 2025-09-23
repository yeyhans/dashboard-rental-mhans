/**
 * Test básico para verificar la funcionalidad de detección de conflictos
 * Este archivo puede ser ejecutado manualmente para probar el endpoint
 */

// Función para probar el endpoint de conflictos
async function testConflictDetection() {
  const testData = {
    currentOrderId: 1,
    productIds: [1, 2, 3],
    startDate: '2024-01-15',
    endDate: '2024-01-20'
  };

  try {
    console.log('🧪 Iniciando test de detección de conflictos...');
    console.log('📤 Datos de prueba:', testData);

    const response = await fetch('/api/orders/check-conflicts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log('📡 Status de respuesta:', response.status);

    const result = await response.json();
    console.log('📥 Respuesta del servidor:', result);

    if (result.success) {
      console.log('✅ Test exitoso!');
      console.log(`📊 Conflictos encontrados: ${result.data.length}`);
      
      if (result.data.length > 0) {
        console.log('⚠️ Detalles de conflictos:');
        result.data.forEach((conflict, index) => {
          console.log(`  ${index + 1}. Orden #${conflict.orderId} - ${conflict.orderProject}`);
          console.log(`     Cliente: ${conflict.customerName}`);
          console.log(`     Fechas: ${conflict.startDate} - ${conflict.endDate}`);
          console.log(`     Productos en conflicto: ${conflict.conflictingProducts.length}`);
        });
      } else {
        console.log('🟢 No se encontraron conflictos');
      }
    } else {
      console.log('❌ Test falló:', result.message);
    }

  } catch (error) {
    console.error('💥 Error durante el test:', error);
  }
}

// Función para probar validación de parámetros
async function testParameterValidation() {
  console.log('\n🧪 Probando validación de parámetros...');

  const invalidTests = [
    {
      name: 'Sin parámetros',
      data: {}
    },
    {
      name: 'Sin productIds',
      data: {
        currentOrderId: 1,
        startDate: '2024-01-15',
        endDate: '2024-01-20'
      }
    },
    {
      name: 'productIds no es array',
      data: {
        currentOrderId: 1,
        productIds: 'invalid',
        startDate: '2024-01-15',
        endDate: '2024-01-20'
      }
    },
    {
      name: 'Sin fechas',
      data: {
        currentOrderId: 1,
        productIds: [1, 2, 3]
      }
    }
  ];

  for (const test of invalidTests) {
    try {
      console.log(`\n📤 Probando: ${test.name}`);
      
      const response = await fetch('/api/orders/check-conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.data)
      });

      const result = await response.json();
      
      if (response.status === 400 && !result.success) {
        console.log('✅ Validación correcta - Error 400 esperado');
        console.log(`   Mensaje: ${result.message}`);
      } else {
        console.log('❌ Validación falló - Se esperaba error 400');
        console.log(`   Status: ${response.status}, Success: ${result.success}`);
      }

    } catch (error) {
      console.error(`💥 Error en test "${test.name}":`, error);
    }
  }
}

// Función para probar el OrderService directamente (si está disponible)
async function testOrderService() {
  console.log('\n🧪 Probando OrderService directamente...');
  
  try {
    // Esta parte requeriría importar el OrderService
    // const { OrderService } = require('../services/orderService');
    
    console.log('⚠️ Test de OrderService requiere configuración adicional');
    console.log('   Para probar directamente, importar OrderService y configurar base de datos');
    
  } catch (error) {
    console.log('ℹ️ OrderService no disponible en este contexto');
  }
}

// Función principal para ejecutar todos los tests
async function runAllTests() {
  console.log('🚀 Iniciando suite de tests para detección de conflictos\n');
  
  await testConflictDetection();
  await testParameterValidation();
  await testOrderService();
  
  console.log('\n🏁 Tests completados');
}

// Exportar funciones para uso en otros contextos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testConflictDetection,
    testParameterValidation,
    testOrderService,
    runAllTests
  };
}

// Si se ejecuta directamente en el navegador
if (typeof window !== 'undefined') {
  window.conflictTests = {
    testConflictDetection,
    testParameterValidation,
    runAllTests
  };
  
  console.log('🌐 Tests disponibles en window.conflictTests');
  console.log('   Ejecutar: window.conflictTests.runAllTests()');
}

// Ejemplo de uso en consola del navegador:
/*
// Ejecutar test completo
await window.conflictTests.runAllTests();

// Ejecutar test individual
await window.conflictTests.testConflictDetection();

// Probar con datos específicos
await fetch('/api/orders/check-conflicts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    currentOrderId: 123,
    productIds: [1, 2],
    startDate: '2024-01-15',
    endDate: '2024-01-20'
  })
}).then(r => r.json()).then(console.log);
*/
