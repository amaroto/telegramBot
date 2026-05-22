# 🤖 Tech Events & News Bot

Un bot de Telegram que te envía diariamente a las 8am los eventos del día y las noticias más relevantes del mundo tech.

## 📋 Características

- 📰 Obtiene noticias de las principales fuentes tech (HackerNews, TechCrunch, The Verge, Ars Technica)
- 📅 Integración con eventos del día
- ⏰ Envío automático diario a las 8am
- 💬 Comandos interactivos para obtener noticias y eventos bajo demanda
- 🐳 Fácil despliegue con Docker
- 🥗 Registro local de comidas, calorías y peso en SQLite

## 🚀 Instalación Rápida

### Requisitos

- Node.js 18+ (si ejecutas localmente)
- Docker y Docker Compose (si usas Docker)
- Telegram Bot Token (obtén uno en [@BotFather](https://t.me/botfather))
- Tu ID de usuario en Telegram

### Obtener credenciales

1. **Token del Bot:**
   - Abre [@BotFather](https://t.me/botfather) en Telegram
   - Envía `/newbot`
   - Sigue las instrucciones
   - Copia el token

2. **Tu ID de Telegram:**
   - Abre [@userinfobot](https://t.me/userinfobot) en Telegram
   - Tu ID aparecerá en el mensaje

3. **API Key (Opcional - para noticias avanzadas):**
   - Regístrate en [NewsAPI](https://newsapi.org/)
   - Obtén tu API key gratuita

### Configuración

1. **Copia el archivo de ejemplo:**
   ```bash
   cp .env.example .env
   ```

2. **Edita `.env` con tus credenciales:**
   ```env
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_USER_ID=your_user_id_here
   NEWSAPI_KEY=your_newsapi_key_here
   SCHEDULE_HOUR=8
   SCHEDULE_MINUTE=0
   NODE_ENV=production
   ```

## 🏃 Ejecución

### Opción 1: Localmente con Node.js

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo (con hot reload)
npm run dev

# Ejecutar en producción
npm start
```

### Opción 2: Con Docker Compose (Recomendado)

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f bot

# Detener
docker-compose down
```

### Opción 3: Con Docker manual

```bash
# Construir imagen
docker build -t tech-bot .

# Ejecutar contenedor
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e TELEGRAM_USER_ID=your_id \
  --name tech-bot \
  tech-bot
```

## 📞 Comandos del Bot

- `/start` - Inicia el bot y muestra información
- `/noticias` - Obtiene las últimas noticias tech
- `/eventos` - Muestra los eventos de hoy
- `/status` - Ver estado del servidor
- `/top` - Ver top 10 procesos por CPU y RAM
- `/comida <cantidad> <alimento>` - Registrar una comida. Ej: `/comida 2 huevos`
- `/peso <kg>` - Registrar tu peso actual. Ej: `/peso 72.3`
- `/altura <cm>` - Registrar tu altura. Ej: `/altura 175`
- `/edad <años>` - Registrar tu edad. Ej: `/edad 30`
- `/perfil <altura_cm> <edad>` - Registrar altura y edad juntos. Ej: `/perfil 175 30`
- `/calorias` - Ver las calorías consumidas hoy y el objetivo estimado
- `/semanal` - Ver el resumen de calorías de los últimos 7 días
- `/historialpeso` - Ver tu historial reciente de peso
- `/help` - Muestra la ayuda

## 📝 Estructura del Proyecto

```
.
├── src/
│   └── index.js           # Código principal del bot
├── Dockerfile             # Configuración Docker
├── docker-compose.yml     # Orquestación con Docker
├── package.json           # Dependencias Node.js
├── .env.example           # Ejemplo de variables de entorno
├── .gitignore             # Archivos ignorados por Git
├── data/                  # Base de datos SQLite creada en tiempo de ejecución
└── README.md              # Este archivo
```

## 🔧 Personalización

### Cambiar hora del envío

Edita `.env`:
```env
SCHEDULE_HOUR=14
SCHEDULE_MINUTE=30
```

### Agregar más fuentes de noticias

Edita `src/index.js` y añade feeds RSS a `TECH_RSS_FEEDS`:
```javascript
const TECH_RSS_FEEDS = [
  'https://ejemplo.com/rss',
  // ... más feeds
];
```

### Integrar con Google Calendar

Para obtener eventos reales de Google Calendar, necesitarás:
1. Crear un proyecto en Google Cloud Console
2. Habilitar Google Calendar API
3. Descargar credenciales JSON
4. Instalar: `npm install google-auth-library google-calendar`

## 🐛 Solución de problemas

### El bot no responde
- Verifica que `TELEGRAM_BOT_TOKEN` sea correcto
- Asegúrate de que el bot tiene permisos en Telegram

### No llegan las noticias
- Verifica tu conexión a internet
- Comprueba que los RSS feeds estén disponibles
- Revisa los logs: `npm run dev`

### Errores de tiempo de zona
- Edita `docker-compose.yml` y cambia `TZ` a tu zona horaria
- Para Linux: `TZ=America/Mexico_City`

## 📚 Dependencias

- **telegraf** - Framework Telegram
- **node-cron** - Scheduler de tareas
- **axios** - Cliente HTTP
- **rss-parser** - Parser de feeds RSS
- **dotenv** - Gestión de variables de entorno

## 📄 Licencia

MIT

## 💡 Ideas para mejoras

- [ ] Integración con Google Calendar
- [ ] Base de datos para guardar historial
- [ ] Panel web para configuración
- [ ] Filtros personalizados de noticias
- [ ] Notificaciones push adicionales
- [ ] Soporte para múltiples usuarios
- [ ] Análisis de sentimientos en noticias

---

**¿Preguntas o problemas?** Abre un issue o contáctame en Telegram.
