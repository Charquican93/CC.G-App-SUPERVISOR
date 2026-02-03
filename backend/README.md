# G-App Backend (Versión Supervisor)

Backend API en Node.js + Express para conectar tu base de datos MySQL y servir datos a tu app móvil.

## Instalación

1. Ve a la carpeta `backend`:
   ```sh
   cd backend
   ```
2. Instala las dependencias:
   ```sh
   npm install
   ```
3. Configura tu archivo `.env` con los datos de tu base MySQL.

## Uso

- Inicia el servidor:
  ```sh
  npm start
  ```
- El backend estará disponible en el puerto definido en `.env` (por defecto 3001).

## Endpoints básicos
- `/` — Prueba de funcionamiento
- `/users` — Ejemplo para obtener usuarios (requiere tabla `users` en tu base de datos)

## Personalización
Agrega más endpoints en `src/index.js` según tus necesidades.

---

Este backend puede conectarse a cualquier base de datos MySQL (local o en la nube) cambiando los datos en `.env`.
