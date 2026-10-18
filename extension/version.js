// A compile-time value identifies the loaded bundle even if files were replaced
// on disk without reloading Chrome. Source previews deliberately say development.
export const buildVersion=typeof __PAPERTRADE_VERSION__==='undefined'?'development':__PAPERTRADE_VERSION__;
export const versionLabel=buildVersion==='development'?'Development preview':'Extension v'+buildVersion;
