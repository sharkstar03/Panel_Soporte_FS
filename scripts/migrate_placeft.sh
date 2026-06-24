#!/usr/bin/env bash
# Migra los datos del proyecto PlaceFT (placeft-postgres) a la base del Panel de
# Soporte (tablas fiscal*). Idempotente: vacía las tablas destino antes de copiar.
#
# Uso:  ./scripts/migrate_placeft.sh
#
# Requiere que ambos contenedores estén corriendo:
#   - origen:  placeft-postgres            (db placeft / user placeft)
#   - destino: panel_soporteqc-main-db-1   (db soporte / user soporte)
set -euo pipefail

SRC="${SRC_CONTAINER:-placeft-postgres}"
SRC_DB="${SRC_DB:-placeft}"; SRC_USER="${SRC_USER:-placeft}"
DST="${DST_CONTAINER:-panel_soporteqc-main-db-1}"
DST_DB="${DST_DB:-soporte}"; DST_USER="${DST_USER:-soporte}"

copy_table() {
  local select_sql="$1" dst_table="$2" cols="$3"
  echo "→ Migrando ${dst_table}…"
  docker exec "$DST" psql -U "$DST_USER" -d "$DST_DB" -c "TRUNCATE ${dst_table};" >/dev/null
  docker exec "$SRC" psql -U "$SRC_USER" -d "$SRC_DB" \
    -c "\copy (${select_sql}) TO STDOUT WITH CSV" \
  | docker exec -i "$DST" psql -U "$DST_USER" -d "$DST_DB" \
    -c "\copy ${dst_table}(${cols}) FROM STDIN WITH CSV"
}

MAP_COLS="serie, sucursal, caja, sistema, detalle, z_nota, estado_interno, anydesk_id, anydesk_password, mantenimiento_ultimo, mantenimiento_proximo, alerta_nota, manual_diagnosis, imagenes, updated_at"
copy_table "SELECT ${MAP_COLS} FROM mappings" "fiscal_mapeo" "${MAP_COLS}"

MI_COLS="serie, machine_id, taxpayer_id, updated_at"
copy_table "SELECT ${MI_COLS} FROM machine_index" "fiscal_indice_maquina" "${MI_COLS}"

Z_COLS="serie, datez, numz, transmission_date, updated_at"
copy_table "SELECT ${Z_COLS} FROM zcache" "fiscal_cache_z" "${Z_COLS}"

copy_table "SELECT option FROM diagnostic_options" "fiscal_opcion_diagnostico" "option"

echo ""
echo "✅ Migración completa. Conteos en el destino:"
docker exec "$DST" psql -U "$DST_USER" -d "$DST_DB" -c \
  "SELECT 'fiscal_mapeo' t, count(*) FROM fiscal_mapeo
   UNION ALL SELECT 'fiscal_indice_maquina', count(*) FROM fiscal_indice_maquina
   UNION ALL SELECT 'fiscal_cache_z', count(*) FROM fiscal_cache_z
   UNION ALL SELECT 'fiscal_opcion_diagnostico', count(*) FROM fiscal_opcion_diagnostico;"
