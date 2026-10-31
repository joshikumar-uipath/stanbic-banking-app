// Public surface of the config layer.
export { ConfigProvider, useConfig, useConfigUpdater } from './ConfigContext';
export { defaultConfig } from './default';
export { BUILTIN_PRESETS, getPresetById, DEFAULT_PRESET_ID, UIPATH_PRESET_ID, STANBIC_PRESET_ID, stanbicConfig } from './presets';
export type { BuiltinPreset } from './presets';
export { migrate } from './migrate';
export { bankIdentity, activeBank, useBank } from './bank';
export type { BankIdentity } from './bank';
export { applyFavicon, generatedFavicon, brandMark } from './favicon';
export { SCHEMA_VERSION, LOGO_SIZES } from './types';
export type { LogoSize } from './types';
export {
  loadCachedConfig,
  saveCachedConfig,
  clearCachedConfigs,
  loadLocalConfig,
  saveLocalConfig,
  clearLocalConfig,
  listLocalProfiles,
  getActiveLocalProfileId,
  getActiveLocalProfile,
  setActiveLocalProfile,
  upsertLocalProfile,
  renameLocalProfile,
  deleteLocalProfile,
  fetchTenantConfig,
  useTenantConfigLoader,
} from './loader';
export type { LocalProfile } from './loader';
export type {
  TenantConfig,
  Branding,
  ConnectionConfig,
  AgentsConfig,
  ShowcaseItem,
  StringsConfig,
  AgentRunResult,
  AgentActionItem,
  MockActionCenterTask,
  MockAlert,
  MockAlertField,
  MockAlertReviewAction,
  MockAlertReviewDetail,
  DemoContent,
  NotificationsConfig,
  FeatureFlags,
  OperationsConfig,
  RoutingRule,
  EmployeeRole,
  EmployeeAppConfig,
} from './types';
