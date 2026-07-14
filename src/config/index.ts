// Public surface of the config layer.
export { ConfigProvider, useConfig, useConfigUpdater } from './ConfigContext';
export { defaultConfig } from './default';
export { BUILTIN_PRESETS, getPresetById, DEFAULT_PRESET_ID, UIPATH_PRESET_ID } from './presets';
export type { BuiltinPreset } from './presets';
export { migrate } from './migrate';
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
} from './types';
