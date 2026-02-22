/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Admin from './pages/Admin';
import Calendar from './pages/Calendar';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import Financials from './pages/Financials';
import Gym from './pages/Gym';
import Habits from './pages/Habits';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Pomodoro from './pages/Pomodoro';
import Progress from './pages/Progress';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "Calendar": Calendar,
    "Chat": Chat,
    "Dashboard": Dashboard,
    "Financials": Financials,
    "Gym": Gym,
    "Habits": Habits,
    "Onboarding": Onboarding,
    "Pomodoro": Pomodoro,
    "Progress": Progress,
    "Projects": Projects,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};