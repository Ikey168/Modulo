import { createContext } from 'react';
import type { LifeOsEntity } from './lifeOs';
export const WorkspaceEntityContext = createContext<LifeOsEntity[] | null>(
  null,
);
