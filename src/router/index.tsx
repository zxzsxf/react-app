import { RouteObject } from 'react-router-dom';
import TestPage from '../pages/TestPage';
import { menuItems } from './TestPage';

export const routes: any[] = [
    {
        path: '/',
        element: <TestPage />
    },
    ...menuItems
]
