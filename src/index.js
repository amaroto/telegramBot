const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
require("dotenv").config();
const { Telegraf } = require("telegraf");
const cron = require("node-cron");
const axios = require("axios");
const Parser = require("rss-parser");
const { addFoodEntry, getFoodSummaryByDate, getCaloriesLastNDays, addWeightEntry, getRecentWeightEntries, getLatestWeightEntry, getUserProfile, saveUserProfile } = require("./db");
const { estimateFoodCalories, getFoodCatalog, formatFoodLookup, getDailyCalorieTarget, formatDayKey, formatCalories, formatWeightHistory } = require("./nutrition");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const parser = new Parser();
const userId = process.env.TELEGRAM_USER_ID;

// Only respond to the authorized Telegram user
bot.use((ctx, next) => {
  const fromId = String(ctx.from?.id || "");
  if (fromId !== String(userId)) {
    return;
  }
  return next();
});

// Función para autenticar con Google Calendar
async function authenticateGoogle() {
  try {
    const credentialsPath = path.join(__dirname, "credentials.json");
    const tokenPath = path.join(__dirname, "token.json");

    if (!fs.existsSync(credentialsPath)) {
      console.log(
        "⚠️  Google Calendar no configurado. Ejecuta: npm run setup-google",
      );
      return null;
    }

    const credentials = require("./credentials.json");
    const { client_secret, client_id, redirect_uris } = credentials.installed;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    if (!fs.existsSync(tokenPath)) {
      console.log(
        "⚠️  Token no encontrado. Ejecuta: npm run setup-google para autenticarte",
      );
      return null;
    }

    const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  } catch (error) {
    console.error("Error autenticando con Google:", error.message);
    return null;
  }
}

// RSS feeds de tecnología
const TECH_RSS_FEEDS = [
  "https://news.ycombinator.com/rss",
  "https://techcrunch.com/feed/",
  "https://www.theverge.com/rss/index.xml",
  "https://feeds.arstechnica.com/arstechnica/index",
];

// Función para obtener noticias de NewsAPI
async function getTechNewsFromAPI() {
  try {
    if (!process.env.NEWSAPI_KEY) {
      console.log("NEWSAPI_KEY no configurada, usando RSS feeds");
      return [];
    }

    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: "technology OR tech OR startup OR AI OR programming",
        sortBy: "publishedAt",
        language: "es",
        pageSize: 10,
        apiKey: process.env.NEWSAPI_KEY,
      },
    });

    const articles = response.data.articles || [];
    return articles.map((article) => ({
      title: article.title,
      link: article.url,
      source: article.source.name,
      pubDate: article.publishedAt,
      description: article.description,
      image: article.urlToImage,
    }));
  } catch (error) {
    console.error("Error getting news from NewsAPI:", error.message);
    return [];
  }
}

// Función para obtener noticias de RSS feeds
async function getTechNewsFromRSS() {
  try {
    const allNews = [];

    for (const feedUrl of TECH_RSS_FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const items = feed.items.slice(0, 2); // Top 2 de cada feed

        items.forEach((item) => {
          allNews.push({
            title: item.title,
            link: item.link,
            source: feed.title || "Tech News",
            pubDate: item.pubDate,
            description: item.content || item.summary,
          });
        });
      } catch (error) {
        console.error(`Error parsing feed ${feedUrl}:`, error.message);
      }
    }

    return allNews;
  } catch (error) {
    console.error("Error getting RSS news:", error);
    return [];
  }
}

// Función para obtener noticias de tech (combina NewsAPI + RSS)
async function getTechNews() {
  try {
    let allNews = [];

    // Intentar obtener de NewsAPI primero
    const apiNews = await getTechNewsFromAPI();
    if (apiNews.length > 0) {
      allNews.push(...apiNews);
      console.log(`📰 Obtenidas ${apiNews.length} noticias de NewsAPI`);
    } else {
      // Si NewsAPI falla o no está configurada, usar RSS
      const rssNews = await getTechNewsFromRSS();
      allNews.push(...rssNews);
      console.log(
        `📰 Obtenidas ${rssNews.length} noticias de RSS feeds (NewsAPI no disponible)`,
      );
    }

    // Eliminar duplicados por título similar
    const uniqueNews = allNews.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (t) => t.title.substring(0, 50) === item.title.substring(0, 50),
        ),
    );

    return uniqueNews.slice(0, 10); // Top 10 noticias únicas
  } catch (error) {
    console.error("Error getting tech news:", error);
    return [];
  }
}

// Función para obtener información del sistema
async function getServerStatus() {
  try {
    const si = require("systeminformation");

    const [cpu, mem, disk, osInfo, temp] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
      si.cpuTemperature(),
    ]);

    const diskInfo = disk[0];
    const cpuTemp = temp.main || temp.cores?.[0] || "N/A";

    const message = `
*Estado del Servidor*

*CPU:*
• Uso: ${cpu.currentLoad.toFixed(2)}%
• Temperatura: ${cpuTemp !== "N/A" ? cpuTemp + "°C" : "No disponible"}

*Memoria RAM:*
• Usada: ${(mem.used / 1024 / 1024 / 1024).toFixed(2)} GB
• Total: ${(mem.total / 1024 / 1024 / 1024).toFixed(2)} GB
• Uso: ${((mem.used / mem.total) * 100).toFixed(2)}%

*Almacenamiento:*
• Usado: ${(diskInfo.used / 1024 / 1024 / 1024).toFixed(2)} GB
• Total: ${(diskInfo.size / 1024 / 1024 / 1024).toFixed(2)} GB
• Uso: ${((diskInfo.used / diskInfo.size) * 100).toFixed(2)}%

*Sistema:*
• OS: ${osInfo.platform} ${osInfo.distro}
• Versión: ${osInfo.release}
• Uptime: ${(osInfo.uptime / 3600).toFixed(2)}h

_Actualizado a las ${new Date().toLocaleTimeString("es-ES")}_
    `.trim();

    return message;
  } catch (error) {
    console.error("Error getting server status:", error.message);
    return `Error al obtener información del servidor: ${error.message}`;
  }
}

// Función para obtener top 10 procesos
async function getTopProcesses() {
  try {
    const si = require("systeminformation");

    const processes = await si.processes();

    const sortedByMemory = [...processes.list]
      .sort((a, b) => (b.mem || 0) - (a.mem || 0))
      .slice(0, 10);

    const sortedByCpu = [...processes.list]
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 10);

    let message = `*Top 10 Procesos - Uso de Recursos*\n\n`;

    message += `*Top 10 por CPU:*\n`;
    sortedByCpu.forEach((proc, index) => {
      const cpuUsage = (proc.cpu || 0).toFixed(2);
      const memUsage = (proc.mem || 0).toFixed(2);
      message += `${index + 1}. ${proc.name.substring(0, 20).padEnd(20)} CPU: ${cpuUsage.padStart(6)}% RAM: ${memUsage.padStart(6)} MB\n`;
    });

    message += `\n*Top 10 por RAM:*\n`;
    sortedByMemory.forEach((proc, index) => {
      const memUsage = (proc.mem || 0).toFixed(2);
      const cpuUsage = (proc.cpu || 0).toFixed(2);
      message += `${index + 1}. ${proc.name.substring(0, 20).padEnd(20)} RAM: ${memUsage.padStart(6)} MB CPU: ${cpuUsage.padStart(6)}%\n`;
    });

    message += `\n_Actualizado a las ${new Date().toLocaleTimeString("es-ES")}_`;

    return message;
  } catch (error) {
    console.error("Error getting top processes:", error.message);
    return `Error al obtener procesos: ${error.message}`;
  }
}

function extractCommandPayload(ctx) {
  return (ctx.message?.text || "").replace(/^(\/\w+)(@\w+)?\s*/i, "").trim();
}

async function buildDailyCaloriesReport(dateKey) {
  const summary = await getFoodSummaryByDate(dateKey);
  const profile = await getUserProfile();
  const latestWeight = await getLatestWeightEntry();

  let report = `📊 *Resumen de calorías del día* (${dateKey})\n\n`;
  report += `• Total consumido: ${Math.round(summary.totalCalories)} kcal\n`;

  if (latestWeight) {
    report += `• Último peso registrado: ${latestWeight.weight_kg.toFixed(1)} kg (${latestWeight.date})\n`;
  }

  if (profile.height_cm) {
    report += `• Altura registrada: ${profile.height_cm} cm\n`;
  }

  if (profile.age_years) {
    report += `• Edad registrada: ${profile.age_years} años\n`;
  }

  if (latestWeight && profile.height_cm) {
    const target = getDailyCalorieTarget(latestWeight.weight_kg, profile.height_cm, profile.age_years);
    report += `• Objetivo estimado: ${formatCalories(target.target)} (${target.activityLevel})\n`;
    const diff = Math.round(summary.totalCalories - target.target);
    report += `• Diferencia con objetivo: ${diff >= 0 ? `+${diff}` : diff} kcal\n`;
  }

  report += `\n`;

  if (summary.entries.length > 0) {
    report += `*Comidas registradas hoy:*\n`;
    summary.entries.forEach((entry) => {
      report += `• ${entry.quantity} ${entry.unit || "unidad"} de ${entry.original_name || entry.name} = ${Math.round(entry.calories)} kcal\n`;
    });
  } else {
    report += "No hay comidas registradas hoy. Usa /comida para añadir alimentos.";
  }

  return report;
}

async function buildWeeklyCaloriesReport() {
  const rows = await getCaloriesLastNDays(7);
  const profile = await getUserProfile();
  const latestWeight = await getLatestWeightEntry();

  let report = `📅 *Resumen de calorías - últimos 7 días*\n\n`;
  let total = 0;

  rows.forEach((day) => {
    report += `• ${day.date}: ${Math.round(day.total_calories)} kcal\n`;
    total += day.total_calories;
  });

  const average = rows.length ? Math.round(total / rows.length) : 0;
  report += `\n• Total 7 días: ${Math.round(total)} kcal\n`;
  report += `• Promedio diario: ${average} kcal\n`;

  if (latestWeight && profile.height_cm) {
    const target = getDailyCalorieTarget(latestWeight.weight_kg, profile.height_cm, profile.age_years);
    report += `• Objetivo estimado diario: ${formatCalories(target.target)}\n`;
  }

  return report;
}

async function fetchCalendarEvents(calendarId, calendar, now, endOfDay) {
  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = response.data.items || [];
    return items.map((event) => ({
      title: event.summary || "Sin título",
      time: new Date(
        event.start.dateTime || event.start.date,
      ).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      description: event.description || "Sin descripción",
      link: event.htmlLink,
      calendarId,
    }));
  } catch (error) {
    console.error(
      `Error getting events for calendar ${calendarId}:`,
      error.message,
    );
    return [];
  }
}

// Función para obtener eventos de Google Calendar
async function getEvents() {
  try {
    const auth = await authenticateGoogle();
    if (!auth) {
      console.log(
        "📅 Google Calendar no disponible, usando eventos de ejemplo",
      );
      return [
        {
          title: "Daily Standup",
          time: "09:00",
          description: "Team standup meeting",
        },
        {
          title: "Project Review",
          time: "14:00",
          description: "Quarterly project review",
        },
      ];
    }

    const calendar = google.calendar({ version: "v3", auth });
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const ids = (
      process.env.GOOGLE_CALENDAR_IDS ||
      process.env.GOOGLE_CALENDAR_ID ||
      "primary"
    )
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const allEvents = [];
    for (const calendarId of ids) {
      const events = await fetchCalendarEvents(
        calendarId,
        calendar,
        now,
        endOfDay,
      );
      allEvents.push(...events);
    }

    if (allEvents.length === 0) {
      return [
        {
          title: "No hay eventos para hoy",
          time: "",
          description:
            "No se encontraron eventos en los calendarios configurados.",
        },
      ];
    }

    const uniqueEvents = allEvents.filter(
      (event, index, self) =>
        index ===
        self.findIndex(
          (t) =>
            t.title === event.title &&
            t.time === event.time &&
            t.calendarId === event.calendarId,
        ),
    );

    return uniqueEvents.sort((a, b) => a.time.localeCompare(b.time));
  } catch (error) {
    console.error("Error getting Google Calendar events:", error.message);
    return [
      {
        title: "Daily Standup",
        time: "09:00",
        description: "Team standup meeting",
      },
    ];
  }
}

// Función para enviar mensaje diario
async function sendDailyMessage() {
  try {
    const news = await getTechNews();
    const events = await getEvents();

    let message = `📅 *Eventos y Noticias Tech del Día* ${new Date().toLocaleDateString("es-ES")}\n\n`;

    // Agregar eventos
    if (events.length > 0) {
      message += `📌 *Eventos del Día:*\n`;
      events.forEach((event) => {
        message += `• ${event.time} - ${event.title}\n`;
      });
      message += "\n";
    }

    // Agregar noticias
    if (news.length > 0) {
      message += `📰 *Noticias de Tecnología:*\n`;
      news.slice(0, 5).forEach((item, index) => {
        message += `${index + 1}. ${item.title}\n`;
        message += `   🔗 [Leer más](${item.link})\n\n`;
      });
    } else {
      message += `No se pudieron cargar las noticias en este momento.`;
    }

    message += `\n_Bot actualizado a las ${new Date().toLocaleTimeString("es-ES")}_`;

    await bot.telegram.sendMessage(userId, message, { parse_mode: "Markdown" });
    console.log(`[${new Date().toISOString()}] Mensaje diario enviado`);
  } catch (error) {
    console.error("Error sending daily message:", error);
  }
}

// Comandos del bot
bot.command("start", (ctx) => {
  ctx.reply(
    `¡Hola! 👋 Soy tu bot de noticias tech, eventos y nutrición.\n\nComandos disponibles:\n/noticias - Obtener noticias ahora\n/eventos - Ver eventos de hoy\n/status - Ver estado del servidor\n/top - Ver top 10 procesos\n/comida - Registrar una comida\n/peso - Registrar tu peso\n/calorias - Consultar calorías consumidas hoy\n/semanal - Ver consumo semanal\n/historialpeso - Ver tu historial de peso\n/help - Ayuda`,
  );
});

bot.command("noticias", async (ctx) => {
  ctx.sendChatAction("typing");
  const news = await getTechNews();

  if (news.length === 0) {
    ctx.reply("No se pudieron cargar las noticias.");
    return;
  }

  let message = `📰 *Últimas Noticias Tech:*\n\n`;
  news.forEach((item, index) => {
    message += `${index + 1}. ${item.title}\n`;
    message += `   📌 ${item.source}\n`;
    message += `   🔗 [Leer más](${item.link})\n\n`;
  });

  ctx.reply(message, { parse_mode: "Markdown" });
});

bot.command("eventos", async (ctx) => {
  const events = await getEvents();

  if (events.length === 0) {
    ctx.reply("No hay eventos programados para hoy.");
    return;
  }

  let message = `📅 *Eventos de Hoy:*\n\n`;
  events.forEach((event) => {
    message += `⏰ ${event.time} - ${event.title}\n`;
    message += `   ${event.description}\n\n`;
  });

  ctx.reply(message, { parse_mode: "Markdown" });
});

bot.command("help", (ctx) => {
  ctx.reply(
    `
*Ayuda - Comandos Disponibles:*

/start - Iniciar el bot
/noticias - Obtener noticias de tecnología
/eventos - Ver eventos del día
/status - Ver estado del servidor
/top - Ver top 10 procesos por CPU y RAM
/comida <cantidad> <alimento> - Registrar una comida. Ej: /comida 2 huevos
/alimento <cantidad> <alimento> - Consultar calorías estimadas sin registrar. Ej: /alimento 1 manzana
/alimentos - Ver algunos alimentos conocidos por el bot
/peso <kg> - Registrar tu peso actual. Ej: /peso 72.5
/altura <cm> - Registrar tu altura. Ej: /altura 175
/edad <años> - Registrar tu edad. Ej: /edad 30
/perfil <altura_cm> <edad> - Registrar altura y edad juntos. Ej: /perfil 175 30
/calorias - Ver las calorías consumidas hoy y tu objetivo estimado
/semanal - Ver el resumen de calorías de los últimos 7 días
/historialpeso - Ver el historial reciente de peso
/help - Mostrar esta ayuda

El bot te enviará automáticamente un resumen diario de noticias y eventos a las ${process.env.SCHEDULE_HOUR}:${process.env.SCHEDULE_MINUTE} cada día.
  `,
    { parse_mode: "Markdown" },
  );
});

bot.command("calorias", async (ctx) => {
  ctx.sendChatAction("typing");
  const report = await buildDailyCaloriesReport(formatDayKey(new Date()));
  ctx.reply(report, { parse_mode: "Markdown" });
});

bot.command("calorias_hoy", async (ctx) => {
  ctx.sendChatAction("typing");
  const report = await buildDailyCaloriesReport(formatDayKey(new Date()));
  ctx.reply(report, { parse_mode: "Markdown" });
});

bot.command("alimento", async (ctx) => {
  const payload = extractCommandPayload(ctx);
  if (!payload) {
    return ctx.reply("Usa /alimento <cantidad> <alimento>. Ejemplo: /alimento 1 manzana");
  }

  const parts = payload.split(/\s+/);
  let quantity = parseFloat(parts[0].replace(",", "."));
  let foodName = parts.slice(1).join(" ").trim();

  if (Number.isNaN(quantity) || !foodName) {
    quantity = 1;
    foodName = payload;
  }

  const estimate = estimateFoodCalories(foodName, quantity);
  const response = formatFoodLookup(foodName, quantity);
  ctx.reply(`🔎 ${response}\n\nUsa /comida para registrar esta entrada si quieres guardarla.`, {
    parse_mode: "Markdown",
  });
});

bot.command("alimentos", async (ctx) => {
  const foods = getFoodCatalog(50);
  ctx.reply(
    `🍽️ *Alimentos conocidos por el bot:*\n\n${foods.join(" · ")}\n\nUsa /alimento <cantidad> <alimento> para consultar calorías.`,
    { parse_mode: "Markdown" },
  );
});

bot.command("comida", async (ctx) => {
  const payload = extractCommandPayload(ctx);
  if (!payload) {
    return ctx.reply(
      "Usa /comida <cantidad> <alimento>. Ejemplo: /comida 2 huevos",
    );
  }

  const parts = payload.split(/\s+/);
  let quantity = parseFloat(parts[0].replace(",", "."));
  let foodName = parts.slice(1).join(" ").trim();

  if (Number.isNaN(quantity) || !foodName) {
    quantity = 1;
    foodName = payload;
  }

  const estimate = estimateFoodCalories(foodName, quantity);
  await addFoodEntry({
    date: formatDayKey(new Date()),
    name: estimate.name,
    quantity,
    calories: estimate.calories,
    unit: estimate.unit,
    originalName: foodName,
  });

  const dailyReport = await buildDailyCaloriesReport(formatDayKey(new Date()));
  ctx.reply(
    `✅ Registrado: ${quantity} ${foodName}\nCalorías estimadas: ${estimate.calories} kcal\n\n${dailyReport}`,
    { parse_mode: "Markdown" },
  );
});

bot.command("peso", async (ctx) => {
  const payload = extractCommandPayload(ctx);
  const weight = parseFloat(payload.replace(",", "."));

  if (!weight || weight <= 0) {
    return ctx.reply("Usa /peso <valor-en-kg>. Ejemplo: /peso 72.3");
  }

  await addWeightEntry(weight, formatDayKey(new Date()));
  ctx.reply(
    `✅ Peso registrado: ${weight.toFixed(1)} kg\nUsa /calorias para ver tu consumo diario y /historialpeso para ver la evolución de tu peso.`,
    { parse_mode: "Markdown" },
  );
});

bot.command("altura", async (ctx) => {
  const payload = extractCommandPayload(ctx);
  const height = parseFloat(payload.replace(",", "."));

  if (!height || height <= 0) {
    return ctx.reply("Usa /altura <cm>. Ejemplo: /altura 175");
  }

  await saveUserProfile({ height_cm: height });
  ctx.reply(`✅ Altura registrada: ${height.toFixed(0)} cm`, {
    parse_mode: "Markdown",
  });
});

bot.command("edad", async (ctx) => {
  const payload = extractCommandPayload(ctx);
  const age = parseInt(payload, 10);

  if (!age || age <= 0) {
    return ctx.reply("Usa /edad <años>. Ejemplo: /edad 30");
  }

  await saveUserProfile({ age_years: age });
  ctx.reply(`✅ Edad registrada: ${age} años`, {
    parse_mode: "Markdown",
  });
});

bot.command("perfil", async (ctx) => {
  const payload = extractCommandPayload(ctx);
  const parts = payload.split(/\s+/).filter(Boolean);

  if (parts.length < 1) {
    return ctx.reply(
      "Usa /perfil <altura_cm> <edad>. Ejemplo: /perfil 175 30",
    );
  }

  const height = parseFloat(parts[0].replace(",", "."));
  const age = parts[1] ? parseInt(parts[1], 10) : null;

  if (!height || height <= 0) {
    return ctx.reply("Altura inválida. Usa un valor en cm, por ejemplo: /perfil 175 30");
  }

  await saveUserProfile({ height_cm: height, age_years: age });
  ctx.reply(`✅ Perfil actualizado. Altura: ${height.toFixed(0)} cm${age ? `, Edad: ${age} años` : ""}`,
    { parse_mode: "Markdown" },
  );
});

bot.command("semanal", async (ctx) => {
  ctx.sendChatAction("typing");
  const report = await buildWeeklyCaloriesReport();
  ctx.reply(report, { parse_mode: "Markdown" });
});

bot.command("historialpeso", async (ctx) => {
  const history = await getRecentWeightEntries(10);

  if (!history || history.length === 0) {
    return ctx.reply("No hay registros de peso aún. Usa /peso para guardar tu primer valor.");
  }

  const lines = history
    .map((entry) => `• ${entry.date}: ${entry.weight_kg.toFixed(1)} kg`)
    .join("\n");

  ctx.reply(`📈 *Historial de peso:*
${lines}`, { parse_mode: "Markdown" });
});

bot.command("status", async (ctx) => {
  ctx.sendChatAction("typing");
  const status = await getServerStatus();
  ctx.reply(status, { parse_mode: "Markdown" });
});

bot.command("top", async (ctx) => {
  ctx.sendChatAction("typing");
  const topProcesses = await getTopProcesses();
  ctx.reply(topProcesses, { parse_mode: "Markdown" });
});

// Configurar scheduler para enviar mensaje diario
const scheduleHour = parseInt(process.env.SCHEDULE_HOUR) || 8;
const scheduleMinute = parseInt(process.env.SCHEDULE_MINUTE) || 0;

cron.schedule(`${scheduleMinute} ${scheduleHour} * * *`, () => {
  console.log(
    `⏰ Enviando mensaje diario a las ${scheduleHour}:${scheduleMinute}`,
  );
  sendDailyMessage();
});

// Iniciar el bot
bot.launch();
console.log("🤖 Bot iniciado...");
console.log(
  `📅 Mensaje diario programado para las ${scheduleHour}:${scheduleMinute}`,
);

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
