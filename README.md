# Mapa compartido — servidor

Servidor Express + WebSocket (`server.js`) que recibe y difunde la
ubicación de cada usuario, y sirve la app web (`public/`) que también
es el código que corre dentro de la app Android (Capacitor).

## Qué incluye este repo

- `server.js` — backend (Node.js, `express` + `ws`).
- `public/` — cliente web (HTML/JS/CSS + Leaflet), el mismo que se
  empaqueta dentro del APK de Android.

> Nota: este repo **no incluye el proyecto nativo de Android/Capacitor**
> (gradle, `AndroidManifest.xml`, etc.), porque no formaba parte de lo
> que se usó para generar este repo — solo se tenía el APK ya compilado.
> Si en algún momento tenés el proyecto Capacitor original (carpeta
> `android/`, `capacitor.config.ts`, `package.json` del lado del
> cliente), se puede agregar `public/` como su `webDir` y reconstruir
> el APK desde ahí con Android Studio o `npx cap build android`.

## Correrlo localmente

```bash
npm install
npm start
```

Por defecto escucha en el puerto `3000` (configurable con la variable
de entorno `PORT`). Podés abrir `http://localhost:3000` en el
navegador para ver/probar el mapa, o apuntar la app Android a
`ws://TU-SERVIDOR:3000` (o `wss://...` si está detrás de HTTPS).

## Diagnóstico de usuarios

`server.js` deja logs en consola de cada posición recibida y avisa si
detecta que el mismo `id` de usuario llega desde dos conexiones
distintas al mismo tiempo (posible colisión de `localStorage`, por
ejemplo al probar con varias pestañas del navegador en la misma
compu en lugar de dispositivos distintos).
