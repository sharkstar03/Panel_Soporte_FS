#!/bin/bash
# Script para diagnosticar y habilitar acceso en red local

echo "=========================================="
echo "  Panel Soporte - Acceso en Red Local"
echo "=========================================="
echo ""

# Detectar IP según el sistema operativo
if command -v ipconfig &> /dev/null; then
    # macOS
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
elif command -v ip &> /dev/null; then
    # Linux
    IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || hostname -I 2>/dev/null | awk '{print $1}')
else
    IP=""
fi

if [ -z "$IP" ]; then
    echo "❌ No se pudo detectar tu IP automáticamente."
    echo "   Buscá tu IPv4 manualmente:"
    echo "   - Mac: Preferencias del Sistema → Red → Verás la IP"
    echo "   - Windows: ipconfig en CMD"
    echo "   - Linux: ip addr"
    exit 1
fi

echo "✅ Tu IP local detectada: $IP"
echo ""

# Verificar si Docker está corriendo
if ! docker ps &> /dev/null; then
    echo "❌ Docker no está corriendo. Inicialo primero."
    exit 1
fi

echo "🔍 Verificando servicios..."
echo ""

# Verificar frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$IP:3000/" 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend responde en http://$IP:3000"
else
    echo "⚠️  Frontend NO responde en http://$IP:3000 (status: $FRONTEND_STATUS)"
fi

# Verificar API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$IP:8000/health" 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ]; then
    echo "✅ API responde en http://$IP:8000"
else
    echo "⚠️  API NO responde en http://$IP:8000 (status: $API_STATUS)"
fi

echo ""
echo "=========================================="
echo "  URLs para acceder desde tu red local:"
echo "=========================================="
echo ""
echo "   🌐 Panel (Frontend): http://$IP:3000"
echo "   🔌 API Directa:      http://$IP:8000"
echo ""
echo "   Compartí esta URL con tu equipo:"
echo "   http://$IP:3000"
echo ""
echo "=========================================="
echo "  Si NO funciona desde otra computadora:"
echo "=========================================="
echo ""
echo "1. Verificá que ambos dispositivos estén en la MISMA red WiFi/cable."
echo "2. En Mac: Desactivá el Firewall temporalmente para probar:"
echo "   Preferencias del Sistema → Seguridad y Privacidad → Firewall → Apagar"
echo "3. En Windows: Abrí el CMD como admin y ejecutá:"
echo "   netsh advfirewall firewall add rule name=PanelSoporte dir=in action=allow protocol=TCP localport=3000,8000"
echo ""
