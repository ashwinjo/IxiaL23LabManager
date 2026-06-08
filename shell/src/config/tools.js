/** Central registry for tool URLs, ports, and API bases. */

const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

export const SHELL_PORT = 9000
export const BRIAN_PORT = 9010

export const TOOLS = [
  {
    id: 't1',
    name: 'IxiaInventoryExplorer',
    shortName: 'Inventory',
    uiUrl: `http://${host}:5174`,
    backendUrl: `http://${host}:3001`,
    healthUrl: `http://${host}:3001/health`,
    popOutPort: 5174,
  },
  {
    id: 't2',
    name: 'IxNetworkSessionsExplorer',
    shortName: 'Sessions',
    uiUrl: `http://${host}:3000`,
    backendUrl: `http://${host}:8080`,
    healthUrl: `http://${host}:8080/health/`,
    popOutPort: 3000,
  },
  {
    id: 't3',
    name: 'IxPortUtilizationAuditor',
    shortName: 'Port Util',
    uiUrl: `http://${host}:8890`,
    backendUrl: `http://${host}:8890`,
    healthUrl: `http://${host}:8890/docs`,
    popOutPort: 8890,
  },
]

export const BRIAN = {
  id: 'brian',
  name: 'Brian (LabAssistant)',
  shortName: 'Brian',
  backendUrl: `http://${host}:${BRIAN_PORT}`,
  healthUrl: `http://${host}:${BRIAN_PORT}/health`,
}

export const NAV_ITEMS = [
  { id: 'home', label: 'Home / Config', type: 'config' },
  ...TOOLS.map((t) => ({ id: t.id, label: t.shortName, type: 'tool', tool: t })),
  { id: BRIAN.id, label: BRIAN.name, type: 'assistant' },
]

export function getToolById(id) {
  return TOOLS.find((t) => t.id === id)
}

export function isBrian(id) {
  return id === BRIAN.id
}
