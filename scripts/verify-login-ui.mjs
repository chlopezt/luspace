import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true},appType:'custom'});
const savedLocation=globalThis.location;
try{
 globalThis.location={pathname:'/login',search:''};
 const {Auth}=await server.ssrLoadModule('/src/App.tsx');
 const props={setup:false,local:true,registration:true,google:true,guestToken:'',onDone:()=>{}};
 const login=renderToStaticMarkup(React.createElement(Auth,props));
 for(const expected of ['Inicia sesión','Accede a tu espacio familiar','name="correo"','name="password"','name="remember"','¿Olvidaste tu contraseña?','Continuar con Google','/registro','/terminos','/privacidad'])assert.ok(login.includes(expected),expected);
 assert.ok(login.indexOf('type="email"')<login.indexOf('Continuar con Google'));
 globalThis.location={pathname:'/registro',search:''};
 const registration=renderToStaticMarkup(React.createElement(Auth,props));
 for(const name of ['nombre','familia','correo','password','password_confirmation'])assert.ok(registration.includes(`name="${name}"`));
 assert.ok(!registration.includes('auth-login-showcase'));
 assert.ok(!registration.includes('name="remember"'));
 assert.ok(registration.includes('Comenzar prueba GRATIS de 14 días'));
 console.log('Acceso verificado: campos, Google, enlaces, orden y registro sin cambios.');
}finally{globalThis.location=savedLocation;await server.close();}
