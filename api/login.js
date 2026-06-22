import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { passkey } = req.body;

  if (!passkey) {
    return res.status(400).json({ error: 'Passkey is required' });
  }

  try {
    // Leer el archivo de playlist sincronamente (al ser Serverless, es seguro hacerlo así)
    const playlistPath = path.join(process.cwd(), 'playlist.json');
    const fileContents = fs.readFileSync(playlistPath, 'utf8');
    const masterPlaylist = JSON.parse(fileContents);

    const key = passkey.toLowerCase().trim();

    if (key === 'noise') {
      // Remover el primer elemento
      const playlist = masterPlaylist.slice(1);
      return res.status(200).json({ success: true, playlist });
    } else if (key === 'awake') {
      // Retornar toda la lista
      return res.status(200).json({ success: true, playlist: masterPlaylist });
    } else {
      // Contraseña incorrecta
      return res.status(401).json({ success: false, error: 'ACCESS DENIED' });
    }
  } catch (error) {
    console.error('Error reading playlist:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
