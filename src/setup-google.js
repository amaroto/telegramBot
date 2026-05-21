const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

async function setupGoogle() {
  console.log('Iniciando autenticación con Google Calendar...\n');

  const credentialsPath = path.join(__dirname, 'credentials.json');
  if (!fs.existsSync(credentialsPath)) {
    console.error('Error: credentials.json no encontrado');
    console.log('\nPasos para obtener credentials.json:');
    console.log('1. Ve a https://console.cloud.google.com/');
    console.log('2. Selecciona o crea un nuevo proyecto');
    console.log('3. Ve a "APIs y servicios" > "Biblioteca"');
    console.log('4. Busca "Google Calendar API" y habilítala');
    console.log('5. Ve a "Credenciales" > "Crear credenciales"');
    console.log('6. Selecciona "OAuth 2.0 Client ID"');
    console.log('7. Elige "Aplicación de escritorio"');
    console.log('8. Descarga el JSON y guárdalo como src/credentials.json\n');
    process.exit(1);
  }

  const credentials = require(credentialsPath);
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const redirectUri = redirect_uris[0];
  const url = new URL(redirectUri);
  const hostname = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : 80;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    prompt: 'consent',
  });

  console.log('Abre esta URL en tu navegador:\n');
  console.log(authUrl);
  console.log('\n');

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, redirectUri);
      const code = requestUrl.searchParams.get('code');
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Error: no se recibió código de autorización.</h1>');
        return;
      }

      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      const tokenPath = path.join(__dirname, 'token.json');
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Autenticación completada. Puedes cerrar esta ventana.</h1>');
      console.log('\nAutenticación exitosa.');
      console.log('Token guardado en src/token.json');
      console.log('Ahora puedes ejecutar: npm start\n');
    } catch (error) {
      console.error('Error durante autenticación:', error.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>Error durante la autenticación. Revisa la terminal.</h1>');
    } finally {
      server.close();
      process.exit(0);
    }
  });

  server.on('error', (error) => {
    console.error('No se pudo iniciar el servidor local:', error.message);
    console.error('Asegúrate de que el redirect URI en credentials.json sea accesible y que no haya otro servicio usando ese puerto.');
    if (port === 80) {
      console.error('Si usas http://localhost, considera cambiar el redirect URI a http://localhost:3000 en Google Cloud y en src/credentials.json.');
    }
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    console.log(`Servidor de callback escuchando en ${redirectUri}`);
    console.log('Abre la URL de autorización y acepta los permisos.');
  });
}

setupGoogle();
