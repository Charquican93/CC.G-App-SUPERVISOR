const express = require('express');
const app = express();
require('dotenv').config();
const mysql = require('mysql2');
const cors = require('cors');

// IMPORTANTE: Los middleware deben ir ANTES de las rutas para que req.body funcione
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- MIDDLEWARE DE LOGGING ---
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

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
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

// ==========================================
//      ENDPOINTS APP GUARDIA (EXISTENTES)
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

// Endpoint para actualizar el estado activo del guardia (PATCH)
app.patch('/guardias/activo', (req, res) => {
  const { rut, activo } = req.body;
  
  // Validación básica
  if (!rut || typeof activo === 'undefined') {
    return res.status(400).json({ error: 'Faltan datos para actualizar estado' });
  }

  db.query(
    'UPDATE guardias SET activo = ? WHERE rut = ?',
    [activo, rut],
    (err, result) => {
      if (err) {
        console.log('Error MySQL al actualizar activo:', err.message);
        return res.status(500).json({ error: 'Error al actualizar estado del guardia' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Guardia no encontrado' });
      }
      res.json({ success: true });
    }
  );
});

// Endpoint para obtener el estado del guardia (GET)
app.get('/guardias/estado', (req, res) => {
  const { rut } = req.query; // En GET usamos req.query, no req.body
  if (!rut) {
    return res.status(400).json({ error: 'Falta el RUT' });
  }
  // Buscamos el guardia y si está activo, buscamos su último turno abierto
  db.query('SELECT id_guardia, activo FROM guardias WHERE rut = ?', [rut], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener estado del guardia' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Guardia no encontrado' });
    }
    
    const guardia = results[0];
    
    if (guardia.activo) {
      // Si está activo, buscamos el id_turno correspondiente (el que no tenga hora_fin)
      db.query(
        'SELECT id_turno FROM turnos WHERE id_guardia = ? AND hora_fin IS NULL ORDER BY id_turno DESC LIMIT 1',
        [guardia.id_guardia],
        (errTurno, resTurno) => {
          if (errTurno) {
            console.error(errTurno);
            return res.status(500).json({ error: 'Error al buscar turno activo' });
          }
          
          const id_turno = resTurno.length > 0 ? resTurno[0].id_turno : null;
          res.json({ activo: 1, id_turno });
        }
      );
    } else {
      res.json({ activo: 0, id_turno: null });
    }
  });
});

// Endpoint para INICIAR turno (Registrar en tabla turnos)
app.post('/turnos', (req, res) => {
  const { id_guardia, id_puesto } = req.body;
  if (!id_guardia || !id_puesto) return res.status(400).json({ error: 'Faltan datos' });

  // Insertamos el turno con fecha y hora de inicio actuales
  const query = 'INSERT INTO turnos (id_guardia, id_puesto, fecha, hora_inicio) VALUES (?, ?, CURDATE(), CURTIME())';
  
  db.query(query, [id_guardia, id_puesto], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al iniciar turno' });
    }
    
    // Actualizamos el guardia a activo
    db.query('UPDATE guardias SET activo = 1 WHERE id_guardia = ?', [id_guardia]);
    
    res.json({ success: true, id_turno: result.insertId });
  });
});

// Endpoint para FINALIZAR turno
app.patch('/turnos/:id', (req, res) => {
  const { id } = req.params; // id_turno
  // Actualizamos hora_fin
  db.query('UPDATE turnos SET hora_fin = CURTIME() WHERE id_turno = ?', [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al finalizar turno' });
    }
    // El dashboard se encarga de llamar a /guardias/activo para ponerlo en 0, 
    // o podemos hacerlo aquí si pasamos el id_guardia. Por simplicidad, mantenemos la lógica del dashboard de desactivar guardia.
    res.json({ success: true });
  });
});

// Endpoint para login de guardias
app.post('/login', (req, res) => {
  console.log('POST /login recibido');
  const { rut, contrasena } = req.body;
  
  if (!rut || !contrasena) {
    console.log('Faltan datos de acceso');
    return res.status(400).json({ error: 'Faltan datos de acceso' });
  }

  db.query(
    'SELECT * FROM guardias WHERE rut = ? AND contrasena = ?',
    [rut, contrasena],
    (err, results) => {
      if (err) {
        console.log('Error MySQL:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      if (results.length === 0) {
        console.log('Credenciales inválidas o guardia inactivo');
        return res.status(401).json({ error: 'Credenciales inválidas o guardia inactivo' });
      }
      
      // Preparar respuesta
      const guardiaDB = { ...results[0] };
      delete guardiaDB.contrasena;
      
      const guardia = {
        ...guardiaDB,
        isActive: !!guardiaDB.activo,
      };
      delete guardia.activo;
      
      // Si el guardia está activo, buscamos su turno abierto para devolver el puesto
      if (guardia.isActive) {
        db.query(
          'SELECT id_turno, id_puesto FROM turnos WHERE id_guardia = ? AND hora_fin IS NULL ORDER BY id_turno DESC LIMIT 1',
          [guardia.id_guardia],
          (errTurno, resultsTurno) => {
            if (errTurno) {
              console.log('Error al buscar turno activo:', errTurno.message);
              return res.json({ guardia }); // Fallback en caso de error
            }
            const activeTurn = resultsTurno.length > 0 ? resultsTurno[0] : null;
            res.json({ guardia, activeTurn });
          }
        );
      } else {
        // PLAN A: Si no está activo, buscar si tiene rondas para hoy y sugerir el puesto.
        const findRondasQuery = `
          SELECT ru.id_puesto, p.puesto, p.instalaciones 
          FROM rondas r
          JOIN rutas ru ON r.id_ruta = ru.id_ruta
          JOIN puestos p ON ru.id_puesto = p.id_puesto
          WHERE r.id_guardia = ? AND r.fecha = CURDATE() 
          LIMIT 1`;

        db.query(findRondasQuery, [guardia.id_guardia], (errRondas, resultsRondas) => {
          if (errRondas) {
            console.log('Error al buscar rondas para sugerencia de puesto:', errRondas.message);
            return res.json({ guardia }); // Fallback, solo devuelve el guardia
          }

          if (resultsRondas.length > 0) {
            // Encontramos una ronda para hoy, sugerimos este puesto
            const puestoSugerido = resultsRondas[0];
            console.log('Login exitoso para RUT:', rut, 'con puesto sugerido:', puestoSugerido.id_puesto);
            res.json({ guardia, puestoSugerido });
          } else {
            // No hay rondas para hoy, no hay sugerencia. La app deberá pedir que elija.
            console.log('Login exitoso para RUT:', rut, 'sin puesto sugerido.');
            res.json({ guardia });
          }
        });
      }
    }
  );
});

// Endpoint para obtener bitácoras de un guardia (GET)
app.get('/bitacoras', (req, res) => {
  const { id_guardia } = req.query;
  if (!id_guardia) {
    return res.status(400).json({ error: 'Falta id_guardia' });
  }

  const query = 'SELECT * FROM bitacoras WHERE id_guardia = ? ORDER BY id_bitacora DESC';
  
  db.query(query, [id_guardia], (err, results) => {
    if (err) {
      console.error('Error al obtener bitácoras:', err);
      return res.status(500).json({ error: 'Error al obtener bitácoras' });
    }

    const logs = results.map(row => {
      let type = 'NOTIFICACION';
      let description = '';
      
      if (row.incidencias) {
        type = 'INCIDENCIA';
        description = row.incidencias;
      } else if (row.observaciones) {
        type = 'OBSERVACION';
        description = row.observaciones;
      } else {
        description = row.notificaciones;
      }

      // Intentar obtener fecha de alguna columna probable (fecha, fecha_hora, created_at) o usar fecha actual
      const dbDate = row.fecha || row.fecha_hora || row.created_at || row.timestamp;
      const dateObj = dbDate ? new Date(dbDate) : new Date();

      return {
        id: `log-${row.id_bitacora}`,
        timestamp: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: dateObj.toLocaleDateString(),
        rawDate: dateObj.toISOString(), // Agregamos fecha ISO para filtrar en frontend
        type,
        description: description || '',
        author: 'Guardia' // Se reemplaza en el frontend
      };
    });
    res.json(logs);
  });
});

// --- NUEVO: Endpoints de Notificaciones para el Guardia ---

// Obtener notificaciones (para la campana)
app.get('/guardias/notificaciones', async (req, res) => {
  const { id_guardia } = req.query;
  if (!id_guardia) return res.status(400).json({ error: 'Falta id_guardia' });

  try {
    const [notificaciones] = await db.promise().query(
      'SELECT * FROM notificaciones WHERE id_guardia = ? ORDER BY fecha DESC LIMIT 50',
      [id_guardia]
    );
    res.json(notificaciones);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Marcar notificación como leída (Acuse de recibo)
app.patch('/guardias/notificaciones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.promise().query('UPDATE notificaciones SET leido = 1 WHERE id_notificacion = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar como leída' });
  }
});

// Endpoint para guardar en bitácora (POST)
app.post('/bitacoras', (req, res) => {
  const { rut, tipo, descripcion, foto } = req.body;

  if (!rut || !tipo || !descripcion) {
    return res.status(400).json({ error: 'Faltan datos para la bitácora' });
  }

  // 1. Obtener id_guardia desde el RUT
  db.query('SELECT id_guardia FROM guardias WHERE rut = ?', [rut], (err, results) => {
    if (err) {
      console.error('Error al buscar guardia:', err);
      return res.status(500).json({ error: 'Error al buscar guardia' });
    }
    if (results.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });

    const id_guardia = results[0].id_guardia;
    
    // 2. Determinar en qué columna guardar según el tipo
    // Normalizamos a mayúsculas para evitar errores si envían 'observacion' o 'incidencia'
    const tipoNormalizado = tipo.toUpperCase();
    let columna = 'notificaciones'; // Por defecto (para NOTIFICACION u otros)
    if (tipoNormalizado === 'OBSERVACION') columna = 'observaciones';
    else if (tipoNormalizado === 'INCIDENCIA') columna = 'incidencias';
    
    console.log(`Guardando bitácora -> Tipo: ${tipo}, Columna destino: ${columna}`);

    // 3. Insertar en la tabla bitacoras
    // Asumimos que existe una columna 'foto' en la tabla. Si no, debes crearla: ALTER TABLE bitacoras ADD COLUMN foto LONGTEXT;
    const query = `INSERT INTO bitacoras (id_guardia, ${columna}, foto) VALUES (?, ?, ?)`;
    
    db.query(query, [id_guardia, descripcion, foto || null], (err, result) => {
      if (err) {
        console.error(`Error MySQL al guardar en columna '${columna}':`, err.message);
        return res.status(500).json({ error: 'Error al guardar en bitácora' });
      }
      res.json({ success: true, id_bitacora: result.insertId });
    });
  });
});

// Endpoint para registrar check de presencia
app.post('/checks', (req, res) => {
  const { id_guardia, id_puesto, latitud, longitud } = req.body;

  if (!id_guardia || !id_puesto) {
    return res.status(400).json({ error: 'Faltan datos para el check de presencia' });
  }

  const query = 'INSERT INTO checks_presencia (id_guardia, id_puesto, latitud, longitud) VALUES (?, ?, ?, ?)';
  
  db.query(query, [id_guardia, id_puesto, latitud, longitud], (err, result) => {
    if (err) {
      console.error('Error MySQL al guardar check:', err.message);
      return res.status(500).json({ error: 'Error al registrar check' });
    }
    res.json({ success: true, id_presencia: result.insertId });
  });
});

// Endpoint para registrar marcaje de punto QR
app.post('/marcajes', (req, res) => {
  console.log('Intento de marcaje recibido:', req.body);
  const { id_ronda, id_punto, latitud, longitud } = req.body;

  if (!id_ronda || !id_punto) {
    return res.status(400).json({ error: 'Faltan datos del marcaje' });
  }

  // 1. Buscar el ID real del punto (permite que el QR tenga el ID "1" o el nombre "E1-P1")
  const findPointQuery = 'SELECT id_punto, id_ruta, latitud_esperada, longitud_esperada, radio_tolerancia FROM puntos_control WHERE id_punto = ? OR nombre = ? LIMIT 1';

  db.query(findPointQuery, [id_punto, id_punto], (err, results) => {
    if (err) {
      console.error('Error al buscar punto:', err.message);
      return res.status(500).json({ error: 'Error al buscar punto de control' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Punto de control no válido o no encontrado en BD' });
    }

    const point = results[0];
    const realIdPunto = point.id_punto;
    const pointRouteId = point.id_ruta;

    // Validación de geolocalización (si el punto tiene coordenadas esperadas configuradas)
    if (point.latitud_esperada != null && point.longitud_esperada != null) {
      if (!latitud || !longitud) {
        return res.status(400).json({ error: 'Se requiere ubicación GPS para validar este punto.' });
      }
      
      const dist = getDistanceFromLatLonInMeters(latitud, longitud, point.latitud_esperada, point.longitud_esperada);
      const tolerance = point.radio_tolerancia || 30; // Usar tolerancia de la BD o 30m por defecto

      if (dist > tolerance) {
        return res.status(400).json({ error: `Estás fuera del rango permitido (${Math.round(dist)}m). Acércate al punto.` });
      }
    }

    // 2. Obtener la ruta de la ronda para validar
    db.query('SELECT id_ruta FROM rondas WHERE id_ronda = ?', [id_ronda], (errRonda, resRonda) => {
      if (errRonda) {
        console.error(errRonda);
        return res.status(500).json({ error: 'Error al buscar información de la ronda' });
      }
      if (resRonda.length === 0) return res.status(404).json({ error: 'Ronda no encontrada' });

      const roundRouteId = resRonda[0].id_ruta;

      // VALIDACIÓN 1: El punto debe pertenecer a la ruta de la ronda
      if (pointRouteId !== roundRouteId) {
        return res.status(400).json({ error: 'Este punto no corresponde a la ronda actual.' });
      }

      // VALIDACIÓN 2: Verificar orden secuencial
      db.query('SELECT id_punto FROM puntos_control WHERE id_ruta = ? ORDER BY id_punto ASC', [roundRouteId], (errSeq, pointsInRoute) => {
        if (errSeq) {
          console.error(errSeq);
          return res.status(500).json({ error: 'Error al verificar secuencia de puntos' });
        }

        const currentIndex = pointsInRoute.findIndex(p => p.id_punto === realIdPunto);
        
        const checkPreviousAndProceed = () => {
          // VALIDACIÓN 3: El punto no debe haber sido escaneado previamente en esta ronda
          db.query('SELECT id_marcaje FROM marcajes_puntos WHERE id_ronda = ? AND id_punto = ?', [id_ronda, realIdPunto], (errDup, resDup) => {
            if (errDup) {
              console.error(errDup);
              return res.status(500).json({ error: 'Error al verificar duplicados' });
            }
            if (resDup.length > 0) {
              return res.status(400).json({ error: 'Este punto ya fue escaneado en esta ronda.' });
            }

            // 4. Insertar marcaje
            const insertQuery = 'INSERT INTO marcajes_puntos (id_ronda, id_punto, latitud, longitud) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [id_ronda, realIdPunto, latitud, longitud], (errInsert, resultInsert) => {
              if (errInsert) {
                console.error('Error MySQL al guardar marcaje:', errInsert.message);
                return res.status(500).json({ error: 'Error al guardar el marcaje' });
              }

              // 5. Calcular progreso
              const idRuta = roundRouteId;

              // Contar total puntos de la ruta
              db.query('SELECT COUNT(*) as total FROM puntos_control WHERE id_ruta = ?', [idRuta], (errTotal, resTotal) => {
                if (errTotal) return res.json({ success: true, id_marcaje: resultInsert.insertId, roundCompleted: false });
                const totalPuntos = resTotal[0].total;

                // Contar cuántos puntos ÚNICOS ha marcado el guardia en esta ronda
                db.query('SELECT COUNT(DISTINCT id_punto) as marcados FROM marcajes_puntos WHERE id_ronda = ?', [id_ronda], (errMarcados, resMarcados) => {
                  if (errMarcados) return res.json({ success: true, id_marcaje: resultInsert.insertId, roundCompleted: false });
                  const puntosMarcados = resMarcados[0].marcados;

                  const roundCompleted = puntosMarcados >= totalPuntos;
                  if (roundCompleted) {
                    db.query('UPDATE rondas SET estado = "COMPLETADA" WHERE id_ronda = ?', [id_ronda]);
                  } else {
                    db.query('UPDATE rondas SET estado = "EN_PROGRESO" WHERE id_ronda = ? AND estado = "PENDIENTE"', [id_ronda]);
                  }
                  res.json({ success: true, id_marcaje: resultInsert.insertId, roundCompleted, progress: { current: puntosMarcados, total: totalPuntos } });
                });
              });
            });
          });
        };

        // Si no es el primer punto de la lista, verificar que el anterior esté marcado
        if (currentIndex > 0) {
          const previousPointId = pointsInRoute[currentIndex - 1].id_punto;
          db.query('SELECT id_marcaje FROM marcajes_puntos WHERE id_ronda = ? AND id_punto = ?', [id_ronda, previousPointId], (errPrev, resPrev) => {
            if (errPrev) {
              console.error(errPrev);
              return res.status(500).json({ error: 'Error al verificar punto anterior' });
            }
            
            if (resPrev.length === 0) {
              return res.status(400).json({ error: 'Orden incorrecto: Debes marcar el punto anterior primero.' });
            }
            checkPreviousAndProceed();
          });
        } else {
          // Es el primer punto, proceder
          checkPreviousAndProceed();
        }
      });
    });
  });
});

// Endpoint para obtener rondas asignadas
app.get('/rondas', (req, res) => {
  const { id_guardia, id_puesto } = req.query;
  
  let query = `
    SELECT 
      r.*, 
      ru.nombre as nombre_ruta, 
      ru.descripcion,
      (SELECT COUNT(*) FROM puntos_control pc WHERE pc.id_ruta = r.id_ruta) as total_puntos,
      (SELECT COUNT(DISTINCT mp.id_punto) FROM marcajes_puntos mp WHERE mp.id_ronda = r.id_ronda) as puntos_marcados
    FROM rondas r
    LEFT JOIN rutas ru ON r.id_ruta = ru.id_ruta
  `;
  
  const params = [];
  const conditions = [];

  if (id_guardia) {
    conditions.push('r.id_guardia = ?');
    params.push(id_guardia);
  }
  if (id_puesto) {
    conditions.push('ru.id_puesto = ?');
    params.push(id_puesto);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY r.hora ASC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error al obtener rondas:', err);
      return res.status(500).json({ error: 'Error al obtener rondas' });
    }
    res.json(results);
  });
});

// Endpoint para actualizar estado de una ronda
app.patch('/rondas/:id', (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  
  console.log(`[PATCH] Solicitud para actualizar ronda ID: ${id} a estado: ${estado}`);

  if (!estado) {
    return res.status(400).json({ error: 'Falta el estado' });
  }

  db.query('UPDATE rondas SET estado = ? WHERE id_ronda = ?', [estado, id], (err, result) => {
    if (err) {
      console.error('Error al actualizar ronda:', err);
      return res.status(500).json({ error: 'Error al actualizar estado de la ronda' });
    }
    
    if (result.affectedRows === 0) {
      console.warn(`[PATCH] Alerta: No se encontró la ronda ID ${id} o ya tenía el estado ${estado}. Filas afectadas: 0`);
    } else {
      console.log(`[PATCH] Éxito: Ronda ID ${id} actualizada correctamente.`);
    }
    res.json({ success: true, affected: result.affectedRows });
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


// Endpoint para registrar alerta de pánico
app.post('/panic', async (req, res) => {
  try {
    const { id_guardia, id_puesto, latitud, longitud } = req.body;

    console.log(`[ALERTA DE PÁNICO] Recibida del guardia ID: ${id_guardia}`);

    if (!id_guardia || typeof latitud === 'undefined' || typeof longitud === 'undefined') {
      return res.status(400).json({ error: 'Faltan datos esenciales para la alerta (guardia, latitud, longitud).' });
    }

    const query = 'INSERT INTO alertas_panico (id_guardia, id_puesto, latitud, longitud) VALUES (?, ?, ?, ?)';
    
    // Usamos la versión de promesas de la librería para un mejor manejo de errores con async/await
    const [result] = await db.promise().query(query, [id_guardia, id_puesto || null, latitud, longitud]);

    console.log('******************************************************');
    console.log(`** SIMULACIÓN: Notificando al supervisor sobre alerta **`);
    console.log(`** Guardia: ${id_guardia}, Puesto: ${id_puesto || 'N/A'} **`);
    console.log(`** Ubicación: https://www.google.com/maps?q=${latitud},${longitud} **`);
    console.log('******************************************************');

    if (result && 'insertId' in result) {
      res.status(201).json({ success: true, id_alerta: result.insertId, message: 'Alerta registrada y supervisor notificado.' });
    } else {
      throw new Error('La consulta de inserción no devolvió un ID.');
    }
  } catch (err) {
    console.error('Error en endpoint /panic:', err.message);
    res.status(500).json({ error: 'Error interno del servidor al registrar la alerta.' });
  }
});

app.get('/', (req, res) => {
  res.send('API funcionando');
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor backend escuchando en puerto ${port} en TODAS las interfaces`);
});

// Funciones auxiliares para cálculo de distancia (Fórmula de Haversine)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la tierra en metros
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
