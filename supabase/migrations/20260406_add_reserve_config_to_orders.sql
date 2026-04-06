-- Agregar configuración de reserva personalizable por orden
-- reserve_type: 'percent' (porcentaje del total) o 'fixed' (monto fijo en CLP)
-- reserve_value: valor numérico (ej: 25 para 25%, o 50000 para $50.000 CLP)

ALTER TABLE orders
  ADD COLUMN reserve_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN reserve_value numeric NOT NULL DEFAULT 25;

COMMENT ON COLUMN orders.reserve_type IS 'Tipo de reserva: percent o fixed';
COMMENT ON COLUMN orders.reserve_value IS 'Valor de la reserva: porcentaje (ej: 25) o monto fijo en CLP';
