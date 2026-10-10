import { createContext } from 'react';
import type { Row } from './lib';

export const AccessActor = createContext<Row>({ rol: 'lector', permisos_json: '{}' });
