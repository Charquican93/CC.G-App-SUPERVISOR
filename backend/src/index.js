const express = require('express');
const app = express();
require('dotenv').config();
const mysql = require('mysql2');
const cors = require('cors');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware para ver en consola si la App está logrando conectar
app.use((req, res, next) => {
  console.log(`[CONEXIÓN ENTRANTE] ${req.method} ${req.url} desde ${req.ip}`);
  next();
});

const db = mysql.createConnection({
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE,
  port: process.env.DB_PORT || process.env.MYSQLPORT || 3306
});

let dbStatus = 'Desconectada 🔴';

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    console.error('⚠️ ERROR CRÍTICO: No se pudo conectar a la BD. Revisa las variables en Railway.');
    dbStatus = 'Error de conexión ❌: ' + err.message;
  }
  console.log('Connected to MySQL database');
  dbStatus = 'Conectada 🟢';
});

// ==========================================
//      ENDPOINTS SUPERVISOR (NUEVOS)
// ==========================================

// 1. Login de Supervisor
app.post('/supervisor/login', async (req, res) => {
  const { rut, password } = req.body; // O usuario/password según tu tabla
  
  if (!rut || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  try {
    // Tabla 'supervisores' con columnas: id_supervisor, rut, contrasena, nombre...
    const [rows] = await db.promise().query(
      'SELECT * FROM supervisores WHERE rut = ? AND contrasena = ?', 
      [rut, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const supervisor = rows[0];
    delete supervisor.contrasena; // No devolver password
    
    res.json({ success: true, supervisor });
  } catch (err) {
    console.error('Error login supervisor:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// 2. Dashboard: Lista de Guardias con Estado, Ubicación y Progreso
app.get('/supervisor/guardias', async (req, res) => {
  try {
    // Obtenemos todos los guardias y su puesto actual (subconsulta al último turno activo)
    const [guardias] = await db.promise().query(`
      SELECT g.id_guardia, g.nombre, g.apellido, g.rut, g.activo, 
      (SELECT id_puesto FROM turnos WHERE id_guardia = g.id_guardia AND hora_fin IS NULL ORDER BY id_turno DESC LIMIT 1) as id_puesto
      FROM guardias g
    `);

    // Para cada guardia, buscamos su info en paralelo
    const listaDetallada = await Promise.all(guardias.map(async (g) => {
      
      // A. Última ubicación conocida (desde checks de presencia)
      // Usamos SELECT * para ser más flexibles con el nombre de la columna de fecha
      const [checks] = await db.promise().query(
        'SELECT * FROM checks_presencia WHERE id_guardia = ? ORDER BY id_presencia DESC LIMIT 1',
        [g.id_guardia]
      );
      
      let ultimaUbicacion = null;
      if (checks.length > 0) {
        const c = checks[0];
        // Intentamos encontrar la fecha en varias columnas comunes
        ultimaUbicacion = { latitud: c.latitud, longitud: c.longitud, fecha: c.created_at || c.fecha || c.timestamp || c.fecha_hora };
      }

      // B. Progreso de Ronda (si está activo)
      let progreso = null;
      if (g.activo) {
        // Buscar ronda activa (En Progreso) o Pendiente (Por cumplir)
        const [rondas] = await db.promise().query(
          `SELECT id_ronda, id_ruta, estado FROM rondas WHERE id_guardia = ? AND estado IN ('EN_PROGRESO', 'PENDIENTE') 
           ORDER BY CASE WHEN estado = 'EN_PROGRESO' THEN 1 ELSE 2 END, id_ronda ASC LIMIT 1`,
          [g.id_guardia]
        );

        if (rondas.length > 0) {
          const ronda = rondas[0];
          // Contar puntos totales vs marcados
          const [totalRes] = await db.promise().query('SELECT COUNT(*) as total FROM puntos_control WHERE id_ruta = ?', [ronda.id_ruta]);
          const [marcadosRes] = await db.promise().query('SELECT COUNT(DISTINCT id_punto) as marcados FROM marcajes_puntos WHERE id_ronda = ?', [ronda.id_ronda]);
          
          const total = totalRes[0].total;
          const marcados = marcadosRes[0].marcados;
          const porcentaje = total > 0 ? Math.round((marcados / total) * 100) : 0;

          let texto = `${marcados}/${total} puntos`;
          if (ronda.estado === 'PENDIENTE') {
            texto = `Por iniciar (${total} ptos)`;
          }

          progreso = {
            texto: texto,
            porcentaje: porcentaje,
            id_ronda: ronda.id_ronda,
            estado: ronda.estado
          };
        }
      }

      return {
        ...g,
        ultimaUbicacion,
        progreso: progreso || { texto: "Sin ronda activa", porcentaje: 0 }
      };
    }));

    res.json(listaDetallada);
  } catch (err) {
    console.error('Error dashboard supervisor:', err);
    res.status(500).json({ error: 'Error al obtener datos del dashboard', details: err.message });
  }
});

// 3. Enviar Notificación al Guardia
app.post('/supervisor/notificaciones', async (req, res) => {
  const { id_guardia, mensaje } = req.body;
  
  if (!id_guardia || !mensaje) return res.status(400).json({ error: 'Faltan datos' });

  try {
    // Requiere tabla 'notificaciones' (id, id_guardia, mensaje, leido, fecha)
    const [result] = await db.promise().query(
      'INSERT INTO notificaciones (id_guardia, mensaje, leido, fecha) VALUES (?, ?, 0, NOW())',
      [id_guardia, mensaje]
    );
    res.json({ success: true, id_notificacion: result.insertId });
  } catch (err) {
    console.error('Error enviando notificación:', err);
    res.status(500).json({ error: 'Error al enviar notificación' });
  }
});

// 4. Perfil del Guardia (Detalle)
app.get('/supervisor/guardias/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [guardia] = await db.promise().query('SELECT * FROM guardias WHERE id_guardia = ?', [id]);
    if (guardia.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });

    // Historial reciente de checks
    const [checks] = await db.promise().query('SELECT * FROM checks_presencia WHERE id_guardia = ? ORDER BY id_presencia DESC LIMIT 20', [id]);

    res.json({ guardia: guardia[0], historialChecks: checks });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
});

// 5. Historial Global de Bitácoras (Supervisor)
app.get('/supervisor/bitacoras', async (req, res) => {
  try {
    // 1. Obtener Bitácoras (Normales)
    // Usamos SELECT * para ser flexibles con los nombres de columnas (fecha vs created_at)
    const [bitacoras] = await db.promise().query(`
      SELECT b.*, g.nombre, g.apellido 
      FROM bitacoras b
      JOIN guardias g ON b.id_guardia = g.id_guardia
      ORDER BY b.id_bitacora DESC LIMIT 100
    `);

    // 2. Obtener Alertas de Pánico (si la tabla existe)
    let alertas = [];
    try {
      const [rows] = await db.promise().query(`
        SELECT a.*, g.nombre, g.apellido 
        FROM alertas_panico a
        JOIN guardias g ON a.id_guardia = g.id_guardia
        ORDER BY a.id_alerta DESC LIMIT 100
      `);
      alertas = rows;
    } catch (err) {
      console.warn('Advertencia: No se pudo obtener alertas de pánico (¿Tabla inexistente?):', err.message);
    }

    console.log(`[HISTORIAL] Bitácoras encontradas: ${bitacoras.length}, Alertas encontradas: ${alertas.length}`);

    // 3. Unificar y Formatear en JavaScript
    const combinedLogs = [];

    // Función para extraer la fecha real de cualquier formato de tabla
    const getValidDate = (row) => {
      // 1. Caso especial: Fecha y Hora en columnas separadas
      if (row.fecha && row.hora) {
        try {
          const datePart = row.fecha instanceof Date ? row.fecha.toISOString().split('T')[0] : row.fecha;
          return new Date(`${datePart}T${row.hora}`);
        } catch (e) { /* Ignorar error y probar siguiente método */ }
      }

      // 2. Buscar columna de timestamp/datetime (prioridad a nombres comunes)
      const val = row.fecha_creacion || row.created_at || row.fecha_hora || row.timestamp || row.fecha_registro || row.fecha;
      if (val) return new Date(val);

      // 3. Fallback (esto es lo que causa que todas sean "hoy")
      return new Date();
    };

    // Procesar Bitácoras
    bitacoras.forEach(row => {
      // Detectar tipo
      let type = 'NOTIFICACION';
      let description = '';
      
      if (row.incidencias) { type = 'INCIDENCIA'; description = row.incidencias; }
      else if (row.observaciones) { type = 'OBSERVACION'; description = row.observaciones; }
      else { description = row.notificaciones; }

      const dateObj = getValidDate(row);
      
      combinedLogs.push({
        id: `BITACORA-${row.id_bitacora}`,
        rawDate: dateObj,
        type,
        description: description || 'Sin descripción',
        author: `${row.nombre} ${row.apellido}`
      });
    });

    // Procesar Alertas
    alertas.forEach(row => {
      const dateObj = getValidDate(row);
      combinedLogs.push({
        id: `PANICO-${row.id_alerta}`,
        rawDate: dateObj,
        type: 'PANICO',
        description: `¡ALERTA DE PÁNICO! Coordenadas: ${row.latitud}, ${row.longitud}`,
        author: `${row.nombre} ${row.apellido}`
      });
    });

    // 4. Ordenar por fecha descendente (más reciente primero)
    combinedLogs.sort((a, b) => b.rawDate - a.rawDate);

    // 5. Formatear para el frontend
    const finalLogs = combinedLogs.slice(0, 200).map(log => ({
      id: log.id,
      timestamp: log.rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: log.rawDate.toLocaleDateString(),
      type: log.type,
      description: log.description,
      author: log.author
    }));

    res.json(finalLogs);
  } catch (err) {
    console.error('Error crítico en /supervisor/bitacoras:', err);
    res.status(500).json({ error: 'Error al obtener bitácoras' });
  }
});

// ==========================================
//      ENDPOINTS COMPARTIDOS / UTILITARIOS
// ==========================================

// Endpoint para obtener lista de puestos
app.get('/puestos', (req, res) => {
  db.query('SELECT * FROM puestos', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener puestos' });
    }
    res.json(results);
  });
});

// Endpoint para obtener puntos de una ronda específica (con estado de marcaje)
app.get('/rondas/:id/puntos', (req, res) => {
  const { id } = req.params;
  
  // 1. Obtener id_ruta de la ronda
  db.query('SELECT id_ruta FROM rondas WHERE id_ronda = ?', [id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener ruta de la ronda' });
    }
    if (results.length === 0) return res.status(404).json({ error: 'Ronda no encontrada' });
    
    const id_ruta = results[0].id_ruta;
    
    // 2. Obtener puntos y estado de marcaje
    const query = `
      SELECT 
        pc.id_punto,
        pc.nombre,
        pc.descripcion,
        CASE WHEN mp.id_marcaje IS NOT NULL THEN 1 ELSE 0 END as marcado,
        mp.fecha_hora as hora_marcaje
      FROM puntos_control pc
      LEFT JOIN marcajes_puntos mp ON pc.id_punto = mp.id_punto AND mp.id_ronda = ?
      WHERE pc.id_ruta = ?
      ORDER BY pc.id_punto ASC
    `;
    
    db.query(query, [id, id_ruta], (errPoints, points) => {
      if (errPoints) {
        console.error(errPoints);
        return res.status(500).json({ error: 'Error al obtener puntos de control' });
      }
      res.json(points);
    });
  });
});

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Supervisor funcionando',
    base_de_datos: dbStatus,
    diagnostico_variables: {
      host: process.env.DB_HOST || process.env.MYSQLHOST ? 'OK' : 'Falta',
      user: process.env.DB_USER || process.env.MYSQLUSER ? 'OK' : 'Falta',
      db: process.env.DB_NAME || process.env.MYSQLDATABASE ? 'OK' : 'Falta'
    }
  });
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor backend escuchando en puerto ${port} en TODAS las interfaces`);
});
